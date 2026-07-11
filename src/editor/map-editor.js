import { EditorCamera } from './camera.js';
import {
    createEmptyMap,
    downloadMapJson,
    loadDraft,
    PLAYTEST_LEVEL_ID,
    saveDraft,
    serializeMap,
    syncGoalsFromZones,
    parseMapJson,
} from './map-document.js';
import { validateMap } from './map-validator.js';
import { createZoneFromStamp, EDITOR_STAMPS, STAMP_BY_ID } from './stamps.js';
import { registerCustomLevel } from '../levels/catalog.js';
import { quatFromEuler, quaternionToMat4 } from '../math.js';

const ROTATE_STEP = Math.PI / 12;

export class MapEditor {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.isPlaytesting = false;
        this.map = createEmptyMap();
        this.tool = 'place';
        this.activeStampId = 'floor';
        this.selectedIndex = -1;
        this.camera = new EditorCamera(game);
        this.spawnMarkerEntity = null;
        this._boundHandlers = null;
        this.ui = {};
    }

    async start() {
        this.isActive = true;
        this.isPlaytesting = false;
        this._bindUi();
        this._bindInput();
        this._showPanel();
        await this.rebuildPreview();
        this._syncUi();
    }

    async rebuildPreview() {
        const game = this.game;
        if (!game.engine || !window.__FILAMENT_FULLY_READY__) return;

        game.clearLevel();
        game.currentLevel = null;
        game.levelComplete = false;

        for (const zone of this.map.zones) {
            await game.createZone(zone);
        }
        game.flushStaticBatches?.();
        this._updateSpawnMarker();
        this.camera.apply();
    }

    async playtest() {
        syncGoalsFromZones(this.map);
        const payload = serializeMap(this.map);
        const result = validateMap(payload);
        if (!result.valid) {
            this._setStatus(`Cannot playtest: ${result.errors[0]}`, true);
            return;
        }

        registerCustomLevel({ ...payload, id: PLAYTEST_LEVEL_ID, name: `${this.map.name} (Playtest)` });

        this.isPlaytesting = true;
        this._hidePanel();
        document.getElementById('ui').style.display = 'block';

        await this.game.loadLevel(PLAYTEST_LEVEL_ID);
        this._setStatus('Playtest running — press M to return to editor');
    }

    async exitPlaytest() {
        this.isPlaytesting = false;
        this.game.clearLevel();
        this.game.currentLevel = null;
        this.game.isPaused = false;
        document.getElementById('ui').style.display = 'none';
        this._showPanel();
        await this.rebuildPreview();
        this._setStatus('Back in editor');
    }

    exportJson() {
        syncGoalsFromZones(this.map);
        const payload = serializeMap(this.map);
        const result = validateMap(payload);
        if (!result.valid) {
            this._setStatus(`Export failed: ${result.errors[0]}`, true);
            return;
        }
        downloadMapJson(payload);
        this._setStatus('Map exported');
    }

    saveDraftToStorage() {
        syncGoalsFromZones(this.map);
        saveDraft(this.map);
        this._setStatus('Draft saved locally');
    }

    async loadDraftFromStorage() {
        const draft = loadDraft();
        if (!draft) {
            this._setStatus('No draft found', true);
            return;
        }
        this.map = draft;
        this.selectedIndex = -1;
        await this.rebuildPreview();
        this._syncUi();
        this._setStatus('Draft loaded');
    }

    importJsonFile(file) {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                this.map = parseMapJson(/** @type {string} */ (reader.result));
                syncGoalsFromZones(this.map);
                this.selectedIndex = -1;
                await this.rebuildPreview();
                this._syncUi();
                this._setStatus(`Loaded ${file.name}`);
            } catch (err) {
                this._setStatus(`Import failed: ${err.message}`, true);
            }
        };
        reader.readAsText(file);
    }

    tick() {
        this.camera.apply();
        this._handleHeldKeys();
    }

    /** @param {number} index */
    selectZone(index) {
        this.selectedIndex = index;
        this.tool = 'select';
        this._syncUi();
    }

    deleteSelected() {
        if (this.selectedIndex < 0) return;
        this.map.zones.splice(this.selectedIndex, 1);
        this.selectedIndex = -1;
        syncGoalsFromZones(this.map);
        this.rebuildPreview();
        this._syncUi();
    }

    rotateSelected() {
        const zone = this.map.zones[this.selectedIndex];
        if (!zone) return;
        zone.rotY = ((zone.rotY || 0) + ROTATE_STEP) % (Math.PI * 2);
        this.rebuildPreview();
        this._syncUi();
    }

    /**
     * @param {{ x: number, y: number, z: number }} pos
     */
    async placeAt(pos) {
        if (this.tool === 'spawn') {
            this.map.spawn = { x: pos.x, y: Math.max(2, pos.y + 2), z: pos.z };
            this._updateSpawnMarker();
            this._syncUi();
            return;
        }

        if (this.tool === 'goal') {
            const stamp = STAMP_BY_ID.goal;
            const zone = createZoneFromStamp(stamp, { x: pos.x, y: 0.25, z: pos.z });
            this.map.zones.push(zone);
            syncGoalsFromZones(this.map);
            await this.rebuildPreview();
            this._syncUi();
            return;
        }

        const stamp = STAMP_BY_ID[this.activeStampId] || STAMP_BY_ID.floor;
        const zone = createZoneFromStamp(stamp, pos);
        if (stamp.type === 'floor') {
            zone.pos.y = pos.y + (zone.size?.y || 0.5) / 2 - 0.25;
        }
        this.map.zones.push(zone);
        this.selectedIndex = this.map.zones.length - 1;
        if (stamp.type === 'goal') syncGoalsFromZones(this.map);
        await this.rebuildPreview();
        this._syncUi();
    }

    _handleHeldKeys() {
        if (this.tool !== 'select' || this.selectedIndex < 0) return;
        const zone = this.map.zones[this.selectedIndex];
        if (!zone) return;

        const keys = this.game.keys || {};
        let moved = false;
        const step = keys['ShiftLeft'] || keys['ShiftRight'] ? 2 : 0.5;
        if (keys['ArrowLeft'] || keys['KeyA']) { zone.pos.x -= step; moved = true; }
        if (keys['ArrowRight'] || keys['KeyD']) { zone.pos.x += step; moved = true; }
        if (keys['ArrowUp'] || keys['KeyW']) { zone.pos.z -= step; moved = true; }
        if (keys['ArrowDown'] || keys['KeyS']) { zone.pos.z += step; moved = true; }
        if (keys['PageUp'] || keys['KeyQ']) { zone.pos.y += step; moved = true; }
        if (keys['PageDown'] || keys['KeyE']) { zone.pos.y -= step; moved = true; }

        if (moved) {
            if (zone.type === 'goal') syncGoalsFromZones(this.map);
            if (!this._moveRebuildTimer) {
                this._moveRebuildTimer = setTimeout(async () => {
                    this._moveRebuildTimer = null;
                    await this.rebuildPreview();
                    this._syncUi();
                }, 80);
            }
        }
    }

    _bindUi() {
        const panel = document.getElementById('map-editor');
        if (!panel) return;

        this.ui = {
            panel,
            status: document.getElementById('editor-status'),
            zoneList: document.getElementById('editor-zone-list'),
            stampList: document.getElementById('editor-stamp-list'),
            mapId: document.getElementById('editor-map-id'),
            mapName: document.getElementById('editor-map-name'),
            spawnFields: {
                x: document.getElementById('editor-spawn-x'),
                y: document.getElementById('editor-spawn-y'),
                z: document.getElementById('editor-spawn-z'),
            },
            selectionFields: {
                x: document.getElementById('editor-sel-x'),
                y: document.getElementById('editor-sel-y'),
                z: document.getElementById('editor-sel-z'),
                rot: document.getElementById('editor-sel-rot'),
            },
        };

        if (this.ui.stampList && !this.ui.stampList.childElementCount) {
            for (const stamp of EDITOR_STAMPS) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'editor-stamp-btn';
                btn.dataset.stampId = stamp.id;
                btn.textContent = `${stamp.icon} ${stamp.label}`;
                btn.addEventListener('click', () => {
                    this.activeStampId = stamp.id;
                    this.tool = 'place';
                    this._highlightStampButtons();
                    this._setStatus(`Place: ${stamp.label}`);
                });
                this.ui.stampList.appendChild(btn);
            }
        }

        document.getElementById('editor-tool-place')?.addEventListener('click', () => {
            this.tool = 'place';
            this._setStatus('Click canvas to place stamp');
        });
        document.getElementById('editor-tool-select')?.addEventListener('click', () => {
            this.tool = 'select';
            this._setStatus('Select a zone from the list');
        });
        document.getElementById('editor-tool-spawn')?.addEventListener('click', () => {
            this.tool = 'spawn';
            this._setStatus('Click canvas to set spawn');
        });
        document.getElementById('editor-tool-goal')?.addEventListener('click', () => {
            this.tool = 'goal';
            this._setStatus('Click canvas to place goal');
        });
        document.getElementById('editor-rotate')?.addEventListener('click', () => this.rotateSelected());
        document.getElementById('editor-delete')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('editor-export')?.addEventListener('click', () => this.exportJson());
        document.getElementById('editor-save-draft')?.addEventListener('click', () => this.saveDraftToStorage());
        document.getElementById('editor-load-draft')?.addEventListener('click', () => this.loadDraftFromStorage());
        document.getElementById('editor-playtest')?.addEventListener('click', () => this.playtest());
        document.getElementById('editor-exit')?.addEventListener('click', () => {
            window.location.search = '';
        });
        document.getElementById('editor-camera-toggle')?.addEventListener('click', () => {
            this.camera.toggleMode();
            this._setStatus(`Camera: ${this.camera.mode}`);
        });
        document.getElementById('editor-import')?.addEventListener('change', (e) => {
            const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
            if (file) this.importJsonFile(file);
        });

        for (const [axis, el] of Object.entries(this.ui.spawnFields)) {
            el?.addEventListener('change', () => {
                const value = parseFloat(el.value);
                if (!Number.isNaN(value)) {
                    this.map.spawn[axis] = value;
                    this._updateSpawnMarker();
                }
            });
        }

        for (const [axis, el] of Object.entries(this.ui.selectionFields)) {
            if (axis === 'rot') {
                el?.addEventListener('change', () => {
                    const zone = this.map.zones[this.selectedIndex];
                    if (!zone) return;
                    const deg = parseFloat(el.value);
                    if (!Number.isNaN(deg)) {
                        zone.rotY = (deg * Math.PI) / 180;
                        this.rebuildPreview();
                    }
                });
                continue;
            }
            el?.addEventListener('change', () => {
                const zone = this.map.zones[this.selectedIndex];
                if (!zone) return;
                const value = parseFloat(el.value);
                if (!Number.isNaN(value)) {
                    zone.pos[axis] = value;
                    if (zone.type === 'goal') syncGoalsFromZones(this.map);
                    this.rebuildPreview();
                }
            });
        }

        this.ui.mapId?.addEventListener('change', () => {
            this.map.id = this.ui.mapId.value.trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'my_map';
            this.ui.mapId.value = this.map.id;
        });
        this.ui.mapName?.addEventListener('change', () => {
            this.map.name = this.ui.mapName.value.trim() || 'Untitled Map';
        });
    }

    _bindInput() {
        const canvas = this.game.canvas;
        if (!canvas || this._boundHandlers) return;

        const onClick = async (e) => {
            if (!this.isActive || this.isPlaytesting) return;
            if (e.target !== canvas) return;
            const pos = this.camera.screenToWorld(e.clientX, e.clientY, canvas, 0);
            if (this.tool === 'select') {
                const hit = this._pickZoneIndex(pos);
                this.selectZone(hit);
                return;
            }
            await this.placeAt(pos);
        };

        const onMouseDown = (e) => this.camera.onMouseDown(e, canvas);
        const onMouseMove = (e) => this.camera.onMouseMove(e);
        const onMouseUp = () => this.camera.onMouseUp();
        const onWheel = (e) => this.camera.onWheel(e);
        const onKeyDown = (e) => {
            if (!this.isActive || this.isPlaytesting) return;
            if (e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                this.deleteSelected();
            }
            if (e.code === 'KeyR') this.rotateSelected();
            if (e.code === 'KeyC') this.camera.toggleMode();
        };

        canvas.addEventListener('click', onClick);
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKeyDown);

        this._boundHandlers = { onClick, onMouseDown, onMouseMove, onMouseUp, onWheel, onKeyDown };
    }

    /**
     * @param {{ x: number, z: number }} pos
     */
    _pickZoneIndex(pos) {
        let best = -1;
        let bestDist = Infinity;
        this.map.zones.forEach((zone, index) => {
            const dx = zone.pos.x - pos.x;
            const dz = zone.pos.z - pos.z;
            const dist = dx * dx + dz * dz;
            if (dist < bestDist) {
                bestDist = dist;
                best = index;
            }
        });
        return bestDist < 36 ? best : -1;
    }

    _updateSpawnMarker() {
        const game = this.game;
        if (!game.engine || !game.Filament || game.rendererType === 'simple-webgl') return;

        const pos = this.map.spawn;
        const color = [0.2, 0.9, 1.0];

        if (!this.spawnMarkerEntity) {
            this.spawnMarkerEntity = game.Filament.EntityManager.get().create();
            const mat = game.material.createInstance();
            mat.setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, color);
            mat.setFloatParameter('roughness', 0.2);
            game.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
                .material(0, mat)
                .geometry(0, game.Filament.RenderableManager$PrimitiveType.TRIANGLES, game.sphereVb, game.sphereIb)
                .build(game.engine, this.spawnMarkerEntity);
            game.scene.addEntity(this.spawnMarkerEntity);
            this._spawnMat = mat;
        }

        const tcm = game.engine.getTransformManager();
        const mat4 = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
        const s = 0.8;
        mat4[0] *= s; mat4[1] *= s; mat4[2] *= s;
        mat4[4] *= s; mat4[5] *= s; mat4[6] *= s;
        mat4[8] *= s; mat4[9] *= s; mat4[10] *= s;
        tcm.setTransform(tcm.getInstance(this.spawnMarkerEntity), mat4);
    }

    _syncUi() {
        if (this.ui.mapId) this.ui.mapId.value = this.map.id;
        if (this.ui.mapName) this.ui.mapName.value = this.map.name;
        if (this.ui.spawnFields.x) this.ui.spawnFields.x.value = String(this.map.spawn.x);
        if (this.ui.spawnFields.y) this.ui.spawnFields.y.value = String(this.map.spawn.y);
        if (this.ui.spawnFields.z) this.ui.spawnFields.z.value = String(this.map.spawn.z);

        const zone = this.map.zones[this.selectedIndex];
        const sel = this.ui.selectionFields;
        if (sel.x) sel.x.value = zone ? String(zone.pos.x) : '';
        if (sel.y) sel.y.value = zone ? String(zone.pos.y) : '';
        if (sel.z) sel.z.value = zone ? String(zone.pos.z) : '';
        if (sel.rot) {
            sel.rot.value = zone?.rotY !== undefined
                ? String(Math.round((zone.rotY * 180) / Math.PI))
                : '0';
        }

        if (this.ui.zoneList) {
            this.ui.zoneList.innerHTML = '';
            this.map.zones.forEach((z, i) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'editor-zone-item' + (i === this.selectedIndex ? ' selected' : '');
                item.textContent = `${i + 1}. ${z.type} (${z.pos.x.toFixed(1)}, ${z.pos.y.toFixed(1)}, ${z.pos.z.toFixed(1)})`;
                item.addEventListener('click', () => this.selectZone(i));
                this.ui.zoneList.appendChild(item);
            });
        }
        this._highlightStampButtons();
    }

    _highlightStampButtons() {
        this.ui.stampList?.querySelectorAll('.editor-stamp-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.stampId === this.activeStampId && this.tool === 'place');
        });
    }

    _showPanel() {
        document.getElementById('level-menu')?.classList.add('menu-hidden');
        document.getElementById('ui').style.display = 'none';
        this.ui.panel?.classList.remove('menu-hidden');
        this.ui.panel?.classList.add('editor-visible');
    }

    _hidePanel() {
        this.ui.panel?.classList.add('menu-hidden');
        this.ui.panel?.classList.remove('editor-visible');
    }

    /** @param {string} message @param {boolean} [isError] */
    _setStatus(message, isError = false) {
        if (!this.ui.status) return;
        this.ui.status.textContent = message;
        this.ui.status.classList.toggle('error', isError);
    }
}

/**
 * @param {object} game
 */
export async function bootMapEditor(game) {
    if (!game.mapEditor) {
        game.mapEditor = new MapEditor(game);
    }
    await game.mapEditor.start();
}

export default MapEditor;
