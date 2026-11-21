import { EditorCamera } from './camera.ts';
import type { EditorCameraHost } from './camera.ts';
import type { EditorMap } from './map-document.ts';
import type { MapCommand, ZonePropsPatch } from './map-commands.ts';
import type { MapValidationResult } from './map-validator.ts';
import type { EditorPhysicsPreviewHost } from './physics-preview.ts';
import type { EditorStamp } from './stamps.ts';
import type { SnapSettings } from './snap.ts';
import {
    MapDocument,
    createEmptyMap,
    cloneMap,
    downloadMapJson,
    loadDraft,
    PLAYTEST_LEVEL_ID,
    saveDraft,
    serializeMap,
    syncGoalsFromZones,
    syncCheckpointsFromZones,
    parseMapJson,
} from './map-document.ts';
import {
    cmdDeleteZones,
    cmdMoveZones,
    zoneAnchor,
    cmdPlaceZone,
    cmdReplaceMap,
    cmdRotateZones,
    cmdSetSpawn,
    cmdUpdateMapMeta,
    cmdUpdateZoneProps,
} from './map-commands.ts';
import { savePlaytestSession, restorePlaytestSession } from './editor-session.ts';
import { validateMap } from './map-validator.ts';
import { EditorPhysicsPreview } from './physics-preview.ts';
import {
    createZoneFromStamp,
    EDITOR_BUILTIN_STAMPS,
    EDITOR_PRIMITIVE_STAMPS,
    EDITOR_FACTORY_STAMPS,
    EDITOR_GAMEPLAY_STAMPS,
    EDITOR_MODEL_STAMPS,
    STAMP_BY_ID,
} from './stamps.ts';
import {
    loadSnapSettings,
    rotationStepRad,
    saveSnapSettings,
    snapPosition,
    snapRotation,
    snapScalar,
    isSnapRotationDeg,
} from './snap.ts';
import { downloadWorkshopZip, importWorkshopPackage, publishWorkshopLevel } from './workshop-export.ts';
import { createImportedGlbStamp } from './glb-import.ts';
import { registerCustomLevel } from '../levels/catalog.js';
import { saveWorkshopLevel } from '../levels/workshop-store.js';
import { quaternionToMat4 } from '../math.ts';
import { isPrimitiveZone } from '../levels/map-normalize.js';
import type {
    CampaignChapter, Difficulty, MapVec3, MapVec3Input, NormalizedStampZone, NormalizedZoneDefinition,
} from '../types/map.ts';
import type { FrameState } from '../types/frame-host.ts';
import type { FilamentHandle } from '../types/filament.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { LevelCleanupRuntime, LevelRuntime } from '../game/systems/level-loader.ts';
import type { RenderPipeline } from '../game/systems/render-pipeline.ts';
import type { ZoneSetupCore } from '../zone-setup/core.ts';

const VALIDATION_DEBOUNCE_MS = 500;

/**
 * What the editor uses on the game: the Filament scene / physics world it
 * previews into, the level lifecycle it playtests with, and input state.
 */
export type MapEditorHost =
    & EditorCameraHost
    & EditorPhysicsPreviewHost
    & Pick<FrameState, 'currentLevel' | 'levelComplete' | 'keys'>
    & Pick<InputSystemHost, 'canvas' | 'isPaused'>
    & Pick<LevelRuntime, 'loadLevel'>
    & Pick<LevelCleanupRuntime, 'clearLevel'>
    & Pick<ZoneSetupCore, 'createZone'>
    & Partial<Pick<RenderPipeline, 'flushStaticBatches'>>
    & {
        rendererType?: string;
        mapEditor?: MapEditor | null;
    };

export type EditorTool = 'place' | 'select' | 'spawn' | 'goal';

/** A text `<input>` or a `<select>` (both read through `.value`). */
type FieldElement = HTMLInputElement | HTMLSelectElement;
type Fields<K extends string> = Record<K, FieldElement | null>;

/** Panel elements (src/ui/templates/editor.html), looked up by `_bindUi`. */
interface EditorUi {
    panel: HTMLElement;
    status: HTMLElement | null;
    zoneList: HTMLElement | null;
    validationList: HTMLElement | null;
    stampList: HTMLElement | null;
    mapId: HTMLInputElement | null;
    mapName: HTMLInputElement | null;
    undoBtn: HTMLButtonElement | null;
    redoBtn: HTMLButtonElement | null;
    snapEnabled: HTMLInputElement | null;
    snapGrid: HTMLSelectElement | null;
    snapRot: HTMLSelectElement | null;
    inspectorMap: HTMLElement | null;
    inspectorZone: HTMLElement | null;
    spawnFields: Fields<'x' | 'y' | 'z'>;
    selectionFields: Fields<'x' | 'y' | 'z' | 'rot'>;
    meta: Fields<'difficulty' | 'chapter' | 'collectibles' | 'gold' | 'silver' | 'bronze' | 'par'>;
    insp: Fields<
        | 'sizeX' | 'sizeY' | 'sizeZ' | 'collider' | 'scale' | 'material' | 'colKind' | 'colValue'
        | 'grappleId' | 'grappleRadius' | 'kinAxis' | 'kinAmp' | 'kinSpeed' | 'kinPhase'>;
}

interface BoundHandlers {
    onClick: (e: MouseEvent) => Promise<void>;
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
    onWheel: (e: WheelEvent) => void;
    onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * The stamp-zone fields the inspector shows, read off any zone (v2 primitives
 * are closed, so on them these read as absent; a primitive `size` may be an
 * `[x, y, z]` array, whose `.x` reads as absent too).
 */
type ZoneInspectorView = { type: string; size?: MapVec3Input } & Partial<Pick<NormalizedStampZone,
    'rotY' | 'collider' | 'scale' | 'materialPreset' | 'collectible' | 'grappleAnchor' | 'kinematic'>>;

/** `v.x` / `.y` / `.z` of an object vector (undefined for an `[x, y, z]` array, as before). */
function vecAxis(v: MapVec3Input | undefined, axis: 'x' | 'y' | 'z'): number | undefined {
    return v && !Array.isArray(v) ? v[axis] : undefined;
}

/** DOM boundary: the editor template fixes each id's element type. */
function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

/** `#ui` (the game HUD, src/ui/templates/hud.html) is always mounted by boot. */
function gameUi(): HTMLElement {
    return document.getElementById('ui')!;
}

/** `catch` boundary: the editor's async paths throw Errors (parse, fetch, validation). */
function errorMessage(err: unknown): string {
    return (err as Error).message;
}

export class MapEditor {
    declare game: MapEditorHost;
    declare isActive: boolean;
    declare isPlaytesting: boolean;
    declare doc: MapDocument;
    declare tool: EditorTool;
    declare activeStampId: string;
    declare selectedIndices: number[];
    declare camera: EditorCamera;
    declare physicsPreview: EditorPhysicsPreview;
    declare spawnMarkerEntity: FilamentHandle | null;
    declare _spawnMat?: FilamentHandle;
    declare _boundHandlers: BoundHandlers | null;
    declare snap: SnapSettings;
    declare _movePendingDelta: MapVec3 | null;
    declare _moveRebuildTimer: ReturnType<typeof setTimeout> | null;
    declare _validationTimer: ReturnType<typeof setTimeout> | null;
    /** User-imported GLB stamps (keyed by stamp id). */
    declare customStamps: Record<string, EditorStamp>;
    declare _customStampCounter: number;
    /** Empty until `_bindUi` finds the panel. */
    declare ui: Partial<EditorUi>;

    constructor(game: MapEditorHost) {
        this.game = game;
        this.isActive = false;
        this.isPlaytesting = false;
        this.doc = new MapDocument(createEmptyMap());
        this.tool = 'place';
        this.activeStampId = 'floor';
        this.selectedIndices = [];
        this.camera = new EditorCamera(game);
        this.physicsPreview = new EditorPhysicsPreview(game);
        this.spawnMarkerEntity = null;
        this._boundHandlers = null;
        this.snap = loadSnapSettings();
        this._movePendingDelta = null;
        this._moveRebuildTimer = null;
        this._validationTimer = null;
        this.customStamps = {};
        this._customStampCounter = 0;
        this.ui = {};
    }

    get map(): EditorMap {
        return this.doc.map;
    }

    async start(): Promise<void> {
        this.isActive = true;
        this.isPlaytesting = false;
        this._bindUi();
        this._bindInput();
        this._showPanel();
        await this.rebuildPreview();
        this._syncUi();
        this._runValidation();
    }

    _afterMutation(): void {
        this._syncUi();
        this._scheduleValidation();
    }

    _scheduleValidation(): void {
        if (this._validationTimer) clearTimeout(this._validationTimer);
        this._validationTimer = setTimeout(() => {
            this._validationTimer = null;
            this._runValidation();
        }, VALIDATION_DEBOUNCE_MS);
    }

    _runValidation(): MapValidationResult {
        const clone = cloneMap(this.map);
        syncGoalsFromZones(clone);
        syncCheckpointsFromZones(clone);
        const result = validateMap(serializeMap(clone));
        this._renderValidation(result);
        return result;
    }

    _renderValidation(result: MapValidationResult): void {
        const list = this.ui.validationList;
        if (!list) return;
        list.innerHTML = '';

        const addItem = (text: string, className: string) => {
            const item = document.createElement('div');
            item.className = `editor-validation-item ${className}`;
            item.textContent = text;
            list.appendChild(item);
        };

        for (const err of result.errors) addItem(`⛔ ${err}`, 'editor-validation-error');
        for (const warn of result.warnings) addItem(`⚠ ${warn}`, 'editor-validation-warning');
        if (!result.errors.length && !result.warnings.length) {
            addItem('✓ No issues found', 'editor-validation-ok');
        }
    }

    _execute(command: MapCommand): void {
        this.doc.execute(command);
        this._afterMutation();
    }

    async rebuildPreview(): Promise<void> {
        const game = this.game;
        const win = window as Window & { __FILAMENT_FULLY_READY__?: boolean };
        if (!game.engine || !win.__FILAMENT_FULLY_READY__) return;

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

    async playtest(): Promise<void> {
        this.physicsPreview.remove();
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
        gameUi().style.display = 'block';

        await this.game.loadLevel(PLAYTEST_LEVEL_ID);
        this._setStatus('Playtest running — press M to return to editor');
    }

    async exitPlaytest(): Promise<void> {
        this.isPlaytesting = false;
        this.game.clearLevel();
        this.game.currentLevel = null;
        this.game.isPaused = false;
        gameUi().style.display = 'none';

        restorePlaytestSession(this);

        this._showPanel();
        await this.rebuildPreview();
        this._syncUi();
        this._setStatus('Back in editor');
    }

    exportJson(): void {
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

    async exportWorkshop(): Promise<void> {
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

    async importWorkshopFile(file: File): Promise<void> {
        try {
            const { mapDef, assetCount } = await importWorkshopPackage(file);
            syncGoalsFromZones(mapDef);
            this._execute(cmdReplaceMap(this.map, mapDef));
            this.selectedIndices = [];
            await this.rebuildPreview();
            this._setStatus(`Imported ${file.name} (${assetCount} bundled asset${assetCount === 1 ? '' : 's'})`);
        } catch (err) {
            this._setStatus(`Workshop import failed: ${errorMessage(err)}`, true);
        }
    }

    /** Save the current map into the localStorage "Community Levels" collection. */
    saveToCommunityLevels(): void {
        syncGoalsFromZones(this.map);
        const payload = serializeMap(this.map);
        const result = validateMap(payload);
        if (!result.valid) {
            this._setStatus(`Cannot save: ${result.errors[0]}`, true);
            return;
        }
        saveWorkshopLevel(payload);
        this._setStatus(`Saved "${this.map.name}" to Community Levels`);
    }

    async publishToCloud(): Promise<void> {
        syncGoalsFromZones(this.map);
        const payload = serializeMap(this.map);
        const result = validateMap(payload);
        if (!result.valid) {
            this._setStatus(`Cannot publish: ${result.errors[0]}`, true);
            return;
        }
        try {
            this._setStatus('Publishing…');
            const { shareUrl } = await publishWorkshopLevel(payload);
            this._setStatus(`Published! Share URL: ${shareUrl}`);
        } catch (err) {
            this._setStatus(`Publish failed: ${errorMessage(err)}`, true);
        }
    }

    saveDraftToStorage(): void {
        syncGoalsFromZones(this.map);
        saveDraft(this.map);
        this._setStatus('Draft saved locally');
    }

    async loadDraftFromStorage(): Promise<void> {
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

    importJsonFile(file: File): void {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                // readAsText() always yields a string result.
                const imported = parseMapJson(reader.result as string);
                syncGoalsFromZones(imported);
                this._execute(cmdReplaceMap(this.map, imported));
                this.selectedIndices = [];
                await this.rebuildPreview();
                this._setStatus(`Loaded ${file.name}`);
            } catch (err) {
                this._setStatus(`Import failed: ${errorMessage(err)}`, true);
            }
        };
        reader.readAsText(file);
    }

    async importGlbFile(file: File): Promise<void> {
        try {
            const stamp = await createImportedGlbStamp(file, ++this._customStampCounter);
            this.customStamps[stamp.id] = stamp;
            this._appendStampButton(stamp, 'Imported GLB');
            this.activeStampId = stamp.id;
            this.tool = 'place';
            this._highlightStampButtons();
            this._setStatus(`Imported ${file.name} — click canvas to place`);
        } catch (err) {
            this._setStatus(`GLB import failed: ${errorMessage(err)}`, true);
        }
    }

    undo(): void {
        if (this.doc.undo()) {
            this.rebuildPreview();
            this._afterMutation();
            this._setStatus('Undo');
        }
    }

    redo(): void {
        if (this.doc.redo()) {
            this.rebuildPreview();
            this._afterMutation();
            this._setStatus('Redo');
        }
    }

    tick(): void {
        this.camera.apply();
        this._handleHeldKeys();
        this.physicsPreview.tick();
    }

    /** Drop (or reset) the physics-preview test marble at the map's spawn point. */
    dropTestMarble(): void {
        this.physicsPreview.spawn(this.map.spawn);
        this._setStatus('Test marble dropped — Space to reset, "Clear Marble" to remove');
    }

    clearTestMarble(): void {
        this.physicsPreview.remove();
        this._setStatus('Test marble cleared');
    }

    selectZone(index: number, e?: MouseEvent): void {
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

    deleteSelected(): void {
        if (!this.selectedIndices.length) return;
        this._execute(cmdDeleteZones(this.map, this.selectedIndices));
        this.selectedIndices = [];
        this.rebuildPreview();
    }

    rotateSelected(): void {
        if (!this.selectedIndices.length) return;
        const step = rotationStepRad(this.snap.rotationDeg);
        this._execute(cmdRotateZones(this.map, this.selectedIndices, step));
        this.rebuildPreview();
    }

    async placeAt(pos: MapVec3): Promise<void> {
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
            if (!stamp) return; // always registered (stamps.ts EDITOR_BUILTIN_STAMPS)
            const zone = createZoneFromStamp(stamp, { x: snapped.x, y: 0.25, z: snapped.z });
            this._execute(cmdPlaceZone(this.map, zone));
            await this.rebuildPreview();
            this.selectedIndices = [this.map.zones.length - 1];
            this._syncUi();
            return;
        }

        const stamp = STAMP_BY_ID[this.activeStampId] || this.customStamps[this.activeStampId] || STAMP_BY_ID.floor;
        if (!stamp) return; // `floor` is always registered (stamps.ts EDITOR_BUILTIN_STAMPS)
        const zone = createZoneFromStamp(stamp, snapped);
        // Floor / checkpoint stamps build stamp zones (never v2 primitives).
        if (stamp.type === 'floor' && !isPrimitiveZone(zone)) {
            zone.pos.y = snapped.y + (zone.size?.y || 0.5) / 2 - 0.25;
        }
        if (stamp.type === 'checkpoint' && !isPrimitiveZone(zone)) {
            zone.pos.y = snapped.y + (zone.size?.y || 0.2) / 2;
        }
        this._execute(cmdPlaceZone(this.map, zone));
        this.selectedIndices = [this.map.zones.length - 1];
        await this.rebuildPreview();
        this._syncUi();
    }

    _handleHeldKeys(): void {
        if (this.tool !== 'select' || !this.selectedIndices.length) return;

        const keys: Record<string, boolean> = this.game.keys || {};
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

    _bindUi(): void {
        const panel = document.getElementById('map-editor');
        if (!panel) return;

        const ui: EditorUi = {
            panel,
            status: byId('editor-status'),
            zoneList: byId('editor-zone-list'),
            validationList: byId('editor-validation-list'),
            stampList: byId('editor-stamp-list'),
            mapId: byId<HTMLInputElement>('editor-map-id'),
            mapName: byId<HTMLInputElement>('editor-map-name'),
            undoBtn: byId<HTMLButtonElement>('editor-undo'),
            redoBtn: byId<HTMLButtonElement>('editor-redo'),
            snapEnabled: byId<HTMLInputElement>('editor-snap-enabled'),
            snapGrid: byId<HTMLSelectElement>('editor-snap-grid'),
            snapRot: byId<HTMLSelectElement>('editor-snap-rot'),
            inspectorMap: byId('editor-inspector-map'),
            inspectorZone: byId('editor-inspector-zone'),
            spawnFields: {
                x: byId<FieldElement>('editor-spawn-x'),
                y: byId<FieldElement>('editor-spawn-y'),
                z: byId<FieldElement>('editor-spawn-z'),
            },
            selectionFields: {
                x: byId<FieldElement>('editor-sel-x'),
                y: byId<FieldElement>('editor-sel-y'),
                z: byId<FieldElement>('editor-sel-z'),
                rot: byId<FieldElement>('editor-sel-rot'),
            },
            meta: {
                difficulty: byId<FieldElement>('editor-meta-difficulty'),
                chapter: byId<FieldElement>('editor-meta-chapter'),
                collectibles: byId<FieldElement>('editor-meta-collectibles'),
                gold: byId<FieldElement>('editor-medal-gold'),
                silver: byId<FieldElement>('editor-medal-silver'),
                bronze: byId<FieldElement>('editor-medal-bronze'),
                par: byId<FieldElement>('editor-medal-par'),
            },
            insp: {
                sizeX: byId<FieldElement>('editor-insp-size-x'),
                sizeY: byId<FieldElement>('editor-insp-size-y'),
                sizeZ: byId<FieldElement>('editor-insp-size-z'),
                collider: byId<FieldElement>('editor-insp-collider'),
                scale: byId<FieldElement>('editor-insp-scale'),
                material: byId<FieldElement>('editor-insp-material'),
                colKind: byId<FieldElement>('editor-insp-collectible-kind'),
                colValue: byId<FieldElement>('editor-insp-collectible-value'),
                grappleId: byId<FieldElement>('editor-insp-grapple-id'),
                grappleRadius: byId<FieldElement>('editor-insp-grapple-radius'),
                kinAxis: byId<FieldElement>('editor-insp-kin-axis'),
                kinAmp: byId<FieldElement>('editor-insp-kin-amp'),
                kinSpeed: byId<FieldElement>('editor-insp-kin-speed'),
                kinPhase: byId<FieldElement>('editor-insp-kin-phase'),
            },
        };
        this.ui = ui;

        if (ui.stampList && !ui.stampList.childElementCount) {
            const appendStampGroup = (label: string, stamps: EditorStamp[]) => {
                for (const stamp of stamps) this._appendStampButton(stamp, label);
            };

            appendStampGroup('Built-in', EDITOR_BUILTIN_STAMPS);
            appendStampGroup('Primitives (v2)', EDITOR_PRIMITIVE_STAMPS);
            appendStampGroup('Gameplay', EDITOR_GAMEPLAY_STAMPS);
            appendStampGroup('GLB tracks', EDITOR_MODEL_STAMPS);
            appendStampGroup('Factory zones', EDITOR_FACTORY_STAMPS);
        }

        byId<HTMLInputElement>('editor-import-glb')?.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file) this.importGlbFile(file);
            input.value = '';
        });

        // The three snap controls sit together in the template.
        const { snapEnabled, snapGrid, snapRot } = ui;
        if (snapEnabled && snapGrid && snapRot) {
            snapEnabled.checked = this.snap.enabled;
            snapGrid.value = String(this.snap.gridSize);
            snapRot.value = String(this.snap.rotationDeg);
            snapEnabled.addEventListener('change', () => {
                this.snap.enabled = snapEnabled.checked;
                saveSnapSettings(this.snap);
            });
            snapGrid.addEventListener('change', () => {
                this.snap.gridSize = parseFloat(snapGrid.value) || 1;
                saveSnapSettings(this.snap);
            });
            snapRot.addEventListener('change', () => {
                const v = parseInt(snapRot.value, 10);
                this.snap.rotationDeg = isSnapRotationDeg(v) ? v : 15;
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
        ui.undoBtn?.addEventListener('click', () => this.undo());
        ui.redoBtn?.addEventListener('click', () => this.redo());
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
        document.getElementById('editor-drop-marble')?.addEventListener('click', () => this.dropTestMarble());
        document.getElementById('editor-clear-marble')?.addEventListener('click', () => this.clearTestMarble());
        byId<HTMLInputElement>('editor-import')?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) this.importJsonFile(file);
        });
        byId<HTMLInputElement>('editor-import-workshop')?.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file) this.importWorkshopFile(file);
            input.value = '';
        });
        document.getElementById('editor-save-community')?.addEventListener('click', () => this.saveToCommunityLevels());
        document.getElementById('editor-publish-cloud')?.addEventListener('click', () => this.publishToCloud());

        for (const [axis, el] of Object.entries(ui.spawnFields)) {
            if (!el) continue;
            el.addEventListener('change', () => {
                const value = parseFloat(el.value);
                if (!Number.isNaN(value)) {
                    this._execute(cmdSetSpawn(this.map, { ...this.map.spawn, [axis]: value }));
                    this._updateSpawnMarker();
                }
            });
        }

        for (const [axis, el] of Object.entries(ui.selectionFields)) {
            if (!el) continue;
            if (axis === 'rot') {
                el.addEventListener('change', () => {
                    const idx = this.selectedIndices[0];
                    const zone = idx === undefined ? undefined : this.map.zones[idx];
                    if (idx === undefined || !zone) return;
                    const deg = parseFloat(el.value);
                    if (Number.isNaN(deg)) return;
                    let rad = (deg * Math.PI) / 180;
                    rad = snapRotation(rad, this.snap.rotationDeg, this.snap.enabled);
                    this._execute(cmdUpdateZoneProps(this.map, idx, { rotY: rad }));
                    this.rebuildPreview();
                });
                continue;
            }
            el.addEventListener('change', () => {
                const idx = this.selectedIndices[0];
                const zone = idx === undefined ? undefined : this.map.zones[idx];
                if (idx === undefined || !zone) return;
                const value = parseFloat(el.value);
                if (Number.isNaN(value)) return;
                const anchor = zoneAnchor(zone);
                const snapped = snapPosition({ ...anchor, [axis]: value }, this.snap.gridSize, this.snap.enabled);
                // Move by the delta so ramps (from/to) and movers (path) shift as a whole.
                this._execute(cmdMoveZones(this.map, [idx], {
                    x: snapped.x - anchor.x, y: snapped.y - anchor.y, z: snapped.z - anchor.z,
                }));
                this.rebuildPreview();
            });
        }

        const { mapId, mapName } = ui;
        mapId?.addEventListener('change', () => {
            const id = mapId.value.trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'my_map';
            this._execute(cmdUpdateMapMeta(this.map, { id }));
            mapId.value = this.map.id;
        });
        mapName?.addEventListener('change', () => {
            this._execute(cmdUpdateMapMeta(this.map, { name: mapName.value.trim() || 'Untitled Map' }));
        });

        this._bindMetaInspector(ui.meta);
        this._bindZoneInspector(ui.insp);
    }

    _bindMetaInspector(fields: EditorUi['meta']): void {
        // parseFloat('') / parseInt('') are NaN, like a missing field before.
        const num = (el: FieldElement | null) => parseFloat(el?.value ?? '');
        const applyMeta = () => {
            const medals = {
                goldTime: num(fields.gold),
                silverTime: num(fields.silver),
                bronzeTime: num(fields.bronze),
                parTime: num(fields.par),
            };
            const meta = {
                // <select> options are the schema's difficulty / chapter enums.
                difficulty: fields.difficulty?.value as Difficulty | undefined,
                chapter: (fields.chapter?.value || undefined) as CampaignChapter | undefined,
                collectiblesTotal: parseInt(fields.collectibles?.value ?? '', 10),
                medals: Object.fromEntries(
                    Object.entries(medals).filter(([, v]) => !Number.isNaN(v))
                ),
            };
            this._execute(cmdUpdateMapMeta(this.map, meta));
        };

        for (const el of Object.values(fields)) {
            el?.addEventListener('change', applyMeta);
        }
    }

    _bindZoneInspector(insp: EditorUi['insp']): void {
        const str = (el: FieldElement | null) => el?.value ?? '';
        const applyZone = () => {
            const idx = this.selectedIndices[0];
            if (idx === undefined) return;
            const zone = this.map.zones[idx];
            if (!zone) return;
            const props: ZonePropsPatch = {};

            const sx = parseFloat(str(insp.sizeX));
            const sy = parseFloat(str(insp.sizeY));
            const sz = parseFloat(str(insp.sizeZ));
            if (!Number.isNaN(sx) && !Number.isNaN(sy) && !Number.isNaN(sz)) {
                props.size = { x: sx, y: sy, z: sz };
            }

            if (zone.type === 'model') {
                // <select> options are the schema's collider enum.
                if (insp.collider?.value) props.collider = insp.collider.value as NonNullable<ZonePropsPatch['collider']>;
                const scale = parseFloat(str(insp.scale));
                if (!Number.isNaN(scale)) props.scale = scale;
                if (insp.material?.value) props.materialPreset = insp.material.value;
            }

            if (zone.type === 'collectible') {
                props.collectible = {
                    kind: insp.colKind?.value || 'coin',
                    value: parseInt(str(insp.colValue), 10) || 50,
                };
            }

            if (zone.type === 'grapple_anchor') {
                props.grappleAnchor = {
                    id: insp.grappleId?.value || 'a1',
                    radius: parseFloat(str(insp.grappleRadius)) || 12,
                };
            }

            const amp = parseFloat(str(insp.kinAmp));
            const speed = parseFloat(str(insp.kinSpeed));
            const phase = parseFloat(str(insp.kinPhase));
            if (!Number.isNaN(amp) || !Number.isNaN(speed)) {
                type KinematicAxis = NonNullable<NonNullable<ZonePropsPatch['kinematic']>['axis']>;
                props.kinematic = {
                    // <select> options are the schema's kinematic.axis enum.
                    axis: (insp.kinAxis?.value || 'horizontal') as KinematicAxis,
                    amplitude: amp || 0,
                    speed: speed || 0,
                    phase: phase || 0,
                };
            }

            this._execute(cmdUpdateZoneProps(this.map, idx, props));
            this.rebuildPreview();
        };

        for (const el of Object.values(insp)) {
            el?.addEventListener('change', applyZone);
        }
    }

    _bindInput(): void {
        const canvas = this.game.canvas;
        if (!canvas || this._boundHandlers) return;

        const onClick = async (e: MouseEvent) => {
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

        const onMouseDown = (e: MouseEvent) => this.camera.onMouseDown(e, canvas);
        const onMouseMove = (e: MouseEvent) => this.camera.onMouseMove(e);
        const onMouseUp = () => this.camera.onMouseUp();
        const onWheel = (e: WheelEvent) => this.camera.onWheel(e);
        const onKeyDown = (e: KeyboardEvent) => {
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
            if (e.code === 'Space') {
                const activeTag = document.activeElement?.tagName;
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
                e.preventDefault();
                this.dropTestMarble();
            }
        };

        canvas.addEventListener('click', onClick);
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKeyDown);

        this._boundHandlers = { onClick, onMouseDown, onMouseMove, onMouseUp, onWheel, onKeyDown };
    }

    _pickZoneIndex(pos: { x: number; z: number }): number {
        let best = -1;
        let bestDist = Infinity;
        this.map.zones.forEach((zone, index) => {
            const anchor = zoneAnchor(zone);
            const dx = anchor.x - pos.x;
            const dz = anchor.z - pos.z;
            const dist = dx * dx + dz * dz;
            if (dist < bestDist) {
                bestDist = dist;
                best = index;
            }
        });
        return bestDist < 36 ? best : -1;
    }

    _updateSpawnMarker(): void {
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
        // Scale the 3x3 rotation block (column-major; Mat4 is 16 floats, so `?? 0` never applies).
        for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) mat4[i] = (mat4[i] ?? 0) * s;
        tcm.setTransform(tcm.getInstance(this.spawnMarkerEntity), mat4);
    }

    _syncUi(): void {
        const ui = this.ui;
        if (ui.mapId) ui.mapId.value = this.map.id;
        if (ui.mapName) ui.mapName.value = this.map.name;
        // `?.`: the field groups are absent when _bindUi found no panel.
        if (ui.spawnFields?.x) ui.spawnFields.x.value = String(this.map.spawn.x);
        if (ui.spawnFields?.y) ui.spawnFields.y.value = String(this.map.spawn.y);
        if (ui.spawnFields?.z) ui.spawnFields.z.value = String(this.map.spawn.z);

        const primaryIdx = this.selectedIndices[0];
        const zone: NormalizedZoneDefinition | null | undefined = primaryIdx !== undefined ? this.map.zones[primaryIdx] : null;
        const view: ZoneInspectorView | null | undefined = zone;
        const sel = ui.selectionFields;
        const anchor = zone ? zoneAnchor(zone) : null;
        if (sel?.x) sel.x.value = anchor ? String(anchor.x) : '';
        if (sel?.y) sel.y.value = anchor ? String(anchor.y) : '';
        if (sel?.z) sel.z.value = anchor ? String(anchor.z) : '';
        if (sel?.rot) {
            sel.rot.value = view?.rotY !== undefined
                ? String(Math.round((view.rotY * 180) / Math.PI))
                : '0';
        }

        if (ui.undoBtn) ui.undoBtn.disabled = !this.doc.canUndo();
        if (ui.redoBtn) ui.redoBtn.disabled = !this.doc.canRedo();

        const showZoneInspector = Boolean(zone) && this.selectedIndices.length === 1;
        ui.inspectorMap?.classList.toggle('menu-hidden', showZoneInspector);
        ui.inspectorZone?.classList.toggle('menu-hidden', !showZoneInspector);

        const meta = ui.meta;
        if (meta?.difficulty) meta.difficulty.value = this.map.difficulty || 'easy';
        if (meta?.chapter) meta.chapter.value = this.map.chapter || '';
        if (meta?.collectibles) {
            meta.collectibles.value = String(this.map.collectiblesTotal ?? 0);
        }
        const medals = this.map.medals || {};
        // String(): what the DOM `.value` setter did with the numbers.
        if (meta?.gold) meta.gold.value = String(medals.goldTime ?? '');
        if (meta?.silver) meta.silver.value = String(medals.silverTime ?? '');
        if (meta?.bronze) meta.bronze.value = String(medals.bronzeTime ?? '');
        if (meta?.par) meta.par.value = String(medals.parTime ?? '');

        const insp = ui.insp;
        if (showZoneInspector && view && insp) {
            if (insp.sizeX) insp.sizeX.value = String(vecAxis(view.size, 'x') ?? '');
            if (insp.sizeY) insp.sizeY.value = String(vecAxis(view.size, 'y') ?? '');
            if (insp.sizeZ) insp.sizeZ.value = String(vecAxis(view.size, 'z') ?? '');
            if (insp.collider) insp.collider.value = view.collider || 'trimesh';
            if (insp.scale) insp.scale.value = String(view.scale ?? 1);
            if (insp.material) insp.material.value = view.materialPreset || '';
            if (insp.colKind) insp.colKind.value = view.collectible?.kind || 'coin';
            if (insp.colValue) insp.colValue.value = String(view.collectible?.value ?? 50);
            if (insp.grappleId) insp.grappleId.value = view.grappleAnchor?.id || '';
            if (insp.grappleRadius) insp.grappleRadius.value = String(view.grappleAnchor?.radius ?? 12);
            if (insp.kinAxis) insp.kinAxis.value = view.kinematic?.axis || 'horizontal';
            if (insp.kinAmp) insp.kinAmp.value = String(view.kinematic?.amplitude ?? '');
            if (insp.kinSpeed) insp.kinSpeed.value = String(view.kinematic?.speed ?? '');
            if (insp.kinPhase) insp.kinPhase.value = String(view.kinematic?.phase ?? '');
        }

        const zoneList = ui.zoneList;
        if (zoneList) {
            zoneList.innerHTML = '';
            this.map.zones.forEach((z, i) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'editor-zone-item' + (this.selectedIndices.includes(i) ? ' selected' : '');
                const a = zoneAnchor(z);
                item.textContent = `${i + 1}. ${z.type} (${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)})`;
                item.addEventListener('click', (ev) => this.selectZone(i, ev));
                zoneList.appendChild(item);
            });
        }
        this._highlightStampButtons();
    }

    _appendStampButton(stamp: Pick<EditorStamp, 'id' | 'label' | 'icon'>, groupLabel: string): void {
        const stampList = this.ui.stampList;
        if (!stampList) return;
        let heading = stampList.querySelector<HTMLElement>(`[data-stamp-group="${groupLabel}"]`);
        if (!heading) {
            heading = document.createElement('div');
            heading.className = 'editor-stamp-group-label';
            heading.dataset.stampGroup = groupLabel;
            heading.textContent = groupLabel;
            stampList.appendChild(heading);
        }
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
        stampList.appendChild(btn);
    }

    _highlightStampButtons(): void {
        this.ui.stampList?.querySelectorAll<HTMLElement>('.editor-stamp-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.stampId === this.activeStampId && this.tool === 'place');
        });
    }

    _showPanel(): void {
        document.getElementById('level-menu')?.classList.add('menu-hidden');
        gameUi().style.display = 'none';
        this.ui.panel?.classList.remove('menu-hidden');
        this.ui.panel?.classList.add('editor-visible');
    }

    _hidePanel(): void {
        this.ui.panel?.classList.add('menu-hidden');
        this.ui.panel?.classList.remove('editor-visible');
    }

    _setStatus(message: string, isError = false): void {
        if (!this.ui.status) return;
        this.ui.status.textContent = message;
        this.ui.status.classList.toggle('error', isError);
    }
}

export async function bootMapEditor(game: MapEditorHost): Promise<void> {
    if (!game.mapEditor) {
        game.mapEditor = new MapEditor(game);
    }
    await game.mapEditor.start();
}

export default MapEditor;
