import { EditorCamera } from './camera.js';
import {
    MapDocument,
    createEmptyMap,
    downloadMapJson,
    loadDraft,
    PLAYTEST_LEVEL_ID,
    saveDraft,
    serializeMap,
    syncGoalsFromZones,
    parseMapJson,
} from './map-document.js';
import {
    cmdDeleteZones,
    cmdMoveZones,
    cmdPlaceZone,
    cmdReplaceMap,
    cmdRotateZones,
    cmdSetSpawn,
    cmdUpdateMapMeta,
    cmdUpdateZoneProps,
} from './map-commands.js';
import { savePlaytestSession, restorePlaytestSession } from './editor-session.js';
import { validateMap } from './map-validator.js';
import {
    createZoneFromStamp,
    EDITOR_BUILTIN_STAMPS,
    EDITOR_FACTORY_STAMPS,
    EDITOR_GAMEPLAY_STAMPS,
    EDITOR_MODEL_STAMPS,
    STAMP_BY_ID,
} from './stamps.js';
import {
    loadSnapSettings,
    rotationStepRad,
    saveSnapSettings,
    snapPosition,
    snapRotation,
    snapScalar,
} from './snap.js';
import { downloadWorkshopZip } from './workshop-export.js';
import { registerCustomLevel } from '../levels/catalog.js';
import { quaternionToMat4 } from '../math.js';

export class MapEditor {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.isPlaytesting = false;
        this.doc = new MapDocument(createEmptyMap());
        this.tool = 'place';
        this.activeStampId = 'floor';
        /** @type {number[]} */
        this.selectedIndices = [];
        this.camera = new EditorCamera(game);
        this.spawnMarkerEntity = null;
        this._boundHandlers = null;
        this.snap = loadSnapSettings();
        this._movePendingDelta = null;
        this._moveRebuildTimer = null;
        this.ui = {};
    }

    get map() {
        return this.doc.map;
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

    _afterMutation() {
        this._syncUi();
    }

    _execute(command) {
        this.doc.execute(command);
        this._afterMutation();
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

        savePlaytestSession(this);

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

        restorePlaytestSession(this);

        this._showPanel();
        await this.rebuildPreview();
        this._syncUi();
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

    async exportWorkshop() {
        syncGoalsFromZones(this.map);
        const payload = serializeMap(this.map);
        const result = validateMap(payload);
        if (!result.valid) {
            this._setStatus(`Workshop export failed: ${result.errors[0]}`, true);
            return;
        }
        await downloadWorkshopZip(payload);
        this._setStatus('Workshop ZIP downloaded');
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
        this._execute(cmdReplaceMap(this.map, draft));
        this.selectedIndices = [];
        await this.rebuildPreview();
        this._setStatus('Draft loaded');
    }

    importJsonFile(file) {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const imported = parseMapJson(/** @type {string} */ (reader.result));
                syncGoalsFromZones(imported);
                this._execute(cmdReplaceMap(this.map, imported));
                this.selectedIndices = [];
                await this.rebuildPreview();
                this._setStatus(`Loaded ${file.name}`);
            } catch (err) {
                this._setStatus(`Import failed: ${err.message}`, true);
            }
        };
        reader.readAsText(file);
    }

    undo() {
        if (this.doc.undo()) {
            this.rebuildPreview();
            this._afterMutation();
            this._setStatus('Undo');
        }
    }

    redo() {
        if (this.doc.redo()) {
            this.rebuildPreview();
            this._afterMutation();
            this._setStatus('Redo');
        }
    }

    tick() {
        this.camera.apply();
        this._handleHeldKeys();
    }

    /** @param {number} index @param {MouseEvent} [e] */
    selectZone(index, e) {
        if (index < 0) {
            this.selectedIndices = [];
        } else if (e?.shiftKey) {
            const set = new Set(this.selectedIndices);
            if (set.has(index)) set.delete(index);
            else set.add(index);
            this.selectedIndices = [...set].sort((a, b) => a - b);
        } else if (e?.ctrlKey || e?.metaKey) {
            const set = new Set(this.selectedIndices);
            set.add(index);
            this.selectedIndices = [...set].sort((a, b) => a - b);
        } else {
            this.selectedIndices = [index];
        }
        this.tool = 'select';
        this._syncUi();
    }

    deleteSelected() {
        if (!this.selectedIndices.length) return;
        this._execute(cmdDeleteZones(this.map, this.selectedIndices));
        this.selectedIndices = [];
        this.rebuildPreview();
    }

    rotateSelected() {
        if (!this.selectedIndices.length) return;
        const step = rotationStepRad(this.snap.rotationDeg);
        this._execute(cmdRotateZones(this.map, this.selectedIndices, step));
        this.rebuildPreview();
    }

    /**
     * @param {{ x: number, y: number, z: number }} pos
     */
    async placeAt(pos) {
        const snapped = snapPosition(pos, this.snap.gridSize, this.snap.enabled);

        if (this.tool === 'spawn') {
            const spawn = {
                x: snapped.x,
                y: Math.max(2, snapped.y + 2),
                z: snapped.z,
            };
            this._execute(cmdSetSpawn(this.map, spawn));
            this._updateSpawnMarker();
            return;
        }

        if (this.tool === 'goal') {
            const stamp = STAMP_BY_ID.goal;
            const zone = createZoneFromStamp(stamp, { x: snapped.x, y: 0.25, z: snapped.z });
            this._execute(cmdPlaceZone(this.map, zone));
            await this.rebuildPreview();
            this.selectedIndices = [this.map.zones.length - 1];
            this._syncUi();
            return;
        }

        const stamp = STAMP_BY_ID[this.activeStampId] || STAMP_BY_ID.floor;
        const zone = createZoneFromStamp(stamp, snapped);
        if (stamp.type === 'floor') {
            zone.pos.y = snapped.y + (zone.size?.y || 0.5) / 2 - 0.25;
        }
        if (stamp.type === 'checkpoint') {
            zone.pos.y = snapped.y + (zone.size?.y || 0.2) / 2;
        }
        this._execute(cmdPlaceZone(this.map, zone));
        this.selectedIndices = [this.map.zones.length - 1];
        await this.rebuildPreview();
        this._syncUi();
    }

    _handleHeldKeys() {
        if (this.tool !== 'select' || !this.selectedIndices.length) return;

        const keys = this.game.keys || {};
        let moved = false;
        const step = keys['ShiftLeft'] || keys['ShiftRight'] ? 2 : 0.5;
        const delta = { x: 0, y: 0, z: 0 };
        if (keys['ArrowLeft'] || keys['KeyA']) { delta.x -= step; moved = true; }
        if (keys['ArrowRight'] || keys['KeyD']) { delta.x += step; moved = true; }
        if (keys['ArrowUp'] || keys['KeyW']) { delta.z -= step; moved = true; }
        if (keys['ArrowDown'] || keys['KeyS']) { delta.z += step; moved = true; }
        if (keys['PageUp'] || keys['KeyQ']) { delta.y += step; moved = true; }
        if (keys['PageDown'] || keys['KeyE']) { delta.y -= step; moved = true; }

        if (!moved) {
            this._movePendingDelta = null;
            return;
        }

        if (this.snap.enabled) {
            delta.x = snapScalar(delta.x, this.snap.gridSize, true);
            delta.y = snapScalar(delta.y, this.snap.gridSize, true);
            delta.z = snapScalar(delta.z, this.snap.gridSize, true);
        }

        this._movePendingDelta = delta;
        if (!this._moveRebuildTimer) {
            this._moveRebuildTimer = setTimeout(async () => {
                const d = this._movePendingDelta;
                this._movePendingDelta = null;
                this._moveRebuildTimer = null;
                if (!d) return;
                this._execute(cmdMoveZones(this.map, this.selectedIndices, d));
                await this.rebuildPreview();
            }, 80);
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
            undoBtn: document.getElementById('editor-undo'),
            redoBtn: document.getElementById('editor-redo'),
            snapEnabled: document.getElementById('editor-snap-enabled'),
            snapGrid: document.getElementById('editor-snap-grid'),
            snapRot: document.getElementById('editor-snap-rot'),
            inspectorMap: document.getElementById('editor-inspector-map'),
            inspectorZone: document.getElementById('editor-inspector-zone'),
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
            meta: {
                difficulty: document.getElementById('editor-meta-difficulty'),
                chapter: document.getElementById('editor-meta-chapter'),
                collectibles: document.getElementById('editor-meta-collectibles'),
                gold: document.getElementById('editor-medal-gold'),
                silver: document.getElementById('editor-medal-silver'),
                bronze: document.getElementById('editor-medal-bronze'),
                par: document.getElementById('editor-medal-par'),
            },
            insp: {
                sizeX: document.getElementById('editor-insp-size-x'),
                sizeY: document.getElementById('editor-insp-size-y'),
                sizeZ: document.getElementById('editor-insp-size-z'),
                collider: document.getElementById('editor-insp-collider'),
                scale: document.getElementById('editor-insp-scale'),
                material: document.getElementById('editor-insp-material'),
                colKind: document.getElementById('editor-insp-collectible-kind'),
                colValue: document.getElementById('editor-insp-collectible-value'),
                grappleId: document.getElementById('editor-insp-grapple-id'),
                grappleRadius: document.getElementById('editor-insp-grapple-radius'),
                kinAxis: document.getElementById('editor-insp-kin-axis'),
                kinAmp: document.getElementById('editor-insp-kin-amp'),
                kinSpeed: document.getElementById('editor-insp-kin-speed'),
                kinPhase: document.getElementById('editor-insp-kin-phase'),
            },
        };

        if (this.ui.stampList && !this.ui.stampList.childElementCount) {
            const appendStampGroup = (label, stamps) => {
                const heading = document.createElement('div');
                heading.className = 'editor-stamp-group-label';
                heading.textContent = label;
                this.ui.stampList.appendChild(heading);
                for (const stamp of stamps) {
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
            };

            appendStampGroup('Built-in', EDITOR_BUILTIN_STAMPS);
            appendStampGroup('Gameplay', EDITOR_GAMEPLAY_STAMPS);
            appendStampGroup('GLB tracks', EDITOR_MODEL_STAMPS);
            appendStampGroup('Factory zones', EDITOR_FACTORY_STAMPS);
        }

        if (this.ui.snapEnabled) {
            this.ui.snapEnabled.checked = this.snap.enabled;
            this.ui.snapGrid.value = String(this.snap.gridSize);
            this.ui.snapRot.value = String(this.snap.rotationDeg);
            this.ui.snapEnabled.addEventListener('change', () => {
                this.snap.enabled = this.ui.snapEnabled.checked;
                saveSnapSettings(this.snap);
            });
            this.ui.snapGrid.addEventListener('change', () => {
                this.snap.gridSize = parseFloat(this.ui.snapGrid.value) || 1;
                saveSnapSettings(this.snap);
            });
            this.ui.snapRot.addEventListener('change', () => {
                const v = parseInt(this.ui.snapRot.value, 10);
                this.snap.rotationDeg = /** @type {0|15|45} */ ([0, 15, 45].includes(v) ? v : 15);
                saveSnapSettings(this.snap);
            });
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
        this.ui.undoBtn?.addEventListener('click', () => this.undo());
        this.ui.redoBtn?.addEventListener('click', () => this.redo());
        document.getElementById('editor-rotate')?.addEventListener('click', () => this.rotateSelected());
        document.getElementById('editor-delete')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('editor-export')?.addEventListener('click', () => this.exportJson());
        document.getElementById('editor-workshop')?.addEventListener('click', () => this.exportWorkshop());
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
                    this._execute(cmdSetSpawn(this.map, { ...this.map.spawn, [axis]: value }));
                    this._updateSpawnMarker();
                }
            });
        }

        for (const [axis, el] of Object.entries(this.ui.selectionFields)) {
            if (axis === 'rot') {
                el?.addEventListener('change', () => {
                    const idx = this.selectedIndices[0];
                    const zone = this.map.zones[idx];
                    if (!zone) return;
                    const deg = parseFloat(el.value);
                    if (Number.isNaN(deg)) return;
                    let rad = (deg * Math.PI) / 180;
                    rad = snapRotation(rad, this.snap.rotationDeg, this.snap.enabled);
                    this._execute(cmdUpdateZoneProps(this.map, idx, { rotY: rad }));
                    this.rebuildPreview();
                });
                continue;
            }
            el?.addEventListener('change', () => {
                const idx = this.selectedIndices[0];
                const zone = this.map.zones[idx];
                if (!zone) return;
                const value = parseFloat(el.value);
                if (Number.isNaN(value)) return;
                const pos = { ...zone.pos, [axis]: value };
                const snapped = snapPosition(pos, this.snap.gridSize, this.snap.enabled);
                this._execute(cmdUpdateZoneProps(this.map, idx, { pos: snapped }));
                this.rebuildPreview();
            });
        }

        this.ui.mapId?.addEventListener('change', () => {
            const id = this.ui.mapId.value.trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'my_map';
            this._execute(cmdUpdateMapMeta(this.map, { id }));
            this.ui.mapId.value = this.map.id;
        });
        this.ui.mapName?.addEventListener('change', () => {
            this._execute(cmdUpdateMapMeta(this.map, { name: this.ui.mapName.value.trim() || 'Untitled Map' }));
        });

        this._bindMetaInspector();
        this._bindZoneInspector();
    }

    _bindMetaInspector() {
        const applyMeta = () => {
            const medals = {
                goldTime: parseFloat(this.ui.meta.gold?.value),
                silverTime: parseFloat(this.ui.meta.silver?.value),
                bronzeTime: parseFloat(this.ui.meta.bronze?.value),
                parTime: parseFloat(this.ui.meta.par?.value),
            };
            const meta = {
                difficulty: this.ui.meta.difficulty?.value,
                chapter: this.ui.meta.chapter?.value || undefined,
                collectiblesTotal: parseInt(this.ui.meta.collectibles?.value, 10),
                medals: Object.fromEntries(
                    Object.entries(medals).filter(([, v]) => !Number.isNaN(v))
                ),
            };
            this._execute(cmdUpdateMapMeta(this.map, meta));
        };

        for (const el of Object.values(this.ui.meta)) {
            el?.addEventListener('change', applyMeta);
        }
    }

    _bindZoneInspector() {
        const applyZone = () => {
            const idx = this.selectedIndices[0];
            if (idx === undefined) return;
            const zone = this.map.zones[idx];
            if (!zone) return;
            const props = {};

            const sx = parseFloat(this.ui.insp.sizeX?.value);
            const sy = parseFloat(this.ui.insp.sizeY?.value);
            const sz = parseFloat(this.ui.insp.sizeZ?.value);
            if (!Number.isNaN(sx) && !Number.isNaN(sy) && !Number.isNaN(sz)) {
                props.size = { x: sx, y: sy, z: sz };
            }

            if (zone.type === 'model') {
                if (this.ui.insp.collider?.value) props.collider = this.ui.insp.collider.value;
                const scale = parseFloat(this.ui.insp.scale?.value);
                if (!Number.isNaN(scale)) props.scale = scale;
                if (this.ui.insp.material?.value) props.materialPreset = this.ui.insp.material.value;
            }

            if (zone.type === 'collectible') {
                props.collectible = {
                    kind: this.ui.insp.colKind?.value || 'coin',
                    value: parseInt(this.ui.insp.colValue?.value, 10) || 50,
                };
            }

            if (zone.type === 'grapple_anchor') {
                props.grappleAnchor = {
                    id: this.ui.insp.grappleId?.value || 'a1',
                    radius: parseFloat(this.ui.insp.grappleRadius?.value) || 12,
                };
            }

            const amp = parseFloat(this.ui.insp.kinAmp?.value);
            const speed = parseFloat(this.ui.insp.kinSpeed?.value);
            const phase = parseFloat(this.ui.insp.kinPhase?.value);
            if (!Number.isNaN(amp) || !Number.isNaN(speed)) {
                props.kinematic = {
                    axis: this.ui.insp.kinAxis?.value || 'horizontal',
                    amplitude: amp || 0,
                    speed: speed || 0,
                    phase: phase || 0,
                };
            }

            this._execute(cmdUpdateZoneProps(this.map, idx, props));
            this.rebuildPreview();
        };

        for (const el of Object.values(this.ui.insp)) {
            el?.addEventListener('change', applyZone);
        }
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
                this.selectZone(hit, e);
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
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
                return;
            }
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

        const primaryIdx = this.selectedIndices[0];
        const zone = primaryIdx !== undefined ? this.map.zones[primaryIdx] : null;
        const sel = this.ui.selectionFields;
        if (sel.x) sel.x.value = zone ? String(zone.pos.x) : '';
        if (sel.y) sel.y.value = zone ? String(zone.pos.y) : '';
        if (sel.z) sel.z.value = zone ? String(zone.pos.z) : '';
        if (sel.rot) {
            sel.rot.value = zone?.rotY !== undefined
                ? String(Math.round((zone.rotY * 180) / Math.PI))
                : '0';
        }

        if (this.ui.undoBtn) this.ui.undoBtn.disabled = !this.doc.canUndo();
        if (this.ui.redoBtn) this.ui.redoBtn.disabled = !this.doc.canRedo();

        const showZoneInspector = zone && this.selectedIndices.length === 1;
        this.ui.inspectorMap?.classList.toggle('menu-hidden', showZoneInspector);
        this.ui.inspectorZone?.classList.toggle('menu-hidden', !showZoneInspector);

        if (this.ui.meta.difficulty) this.ui.meta.difficulty.value = this.map.difficulty || 'easy';
        if (this.ui.meta.chapter) this.ui.meta.chapter.value = this.map.chapter || '';
        if (this.ui.meta.collectibles) {
            this.ui.meta.collectibles.value = String(this.map.collectiblesTotal ?? 0);
        }
        const medals = this.map.medals || {};
        if (this.ui.meta.gold) this.ui.meta.gold.value = medals.goldTime ?? '';
        if (this.ui.meta.silver) this.ui.meta.silver.value = medals.silverTime ?? '';
        if (this.ui.meta.bronze) this.ui.meta.bronze.value = medals.bronzeTime ?? '';
        if (this.ui.meta.par) this.ui.meta.par.value = medals.parTime ?? '';

        if (showZoneInspector && zone) {
            const insp = this.ui.insp;
            if (insp.sizeX) insp.sizeX.value = zone.size?.x ?? '';
            if (insp.sizeY) insp.sizeY.value = zone.size?.y ?? '';
            if (insp.sizeZ) insp.sizeZ.value = zone.size?.z ?? '';
            if (insp.collider) insp.collider.value = zone.collider || 'trimesh';
            if (insp.scale) insp.scale.value = zone.scale ?? 1;
            if (insp.material) insp.material.value = zone.materialPreset || '';
            if (insp.colKind) insp.colKind.value = zone.collectible?.kind || 'coin';
            if (insp.colValue) insp.colValue.value = zone.collectible?.value ?? 50;
            if (insp.grappleId) insp.grappleId.value = zone.grappleAnchor?.id || '';
            if (insp.grappleRadius) insp.grappleRadius.value = zone.grappleAnchor?.radius ?? 12;
            if (insp.kinAxis) insp.kinAxis.value = zone.kinematic?.axis || 'horizontal';
            if (insp.kinAmp) insp.kinAmp.value = zone.kinematic?.amplitude ?? '';
            if (insp.kinSpeed) insp.kinSpeed.value = zone.kinematic?.speed ?? '';
            if (insp.kinPhase) insp.kinPhase.value = zone.kinematic?.phase ?? '';
        }

        if (this.ui.zoneList) {
            this.ui.zoneList.innerHTML = '';
            this.map.zones.forEach((z, i) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'editor-zone-item' + (this.selectedIndices.includes(i) ? ' selected' : '');
                item.textContent = `${i + 1}. ${z.type} (${z.pos.x.toFixed(1)}, ${z.pos.y.toFixed(1)}, ${z.pos.z.toFixed(1)})`;
                item.addEventListener('click', (ev) => this.selectZone(i, ev));
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
