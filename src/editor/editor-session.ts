import { parseMapJson, serializeMapJson } from './map-document.ts';
import type { MapDocument } from './map-document.ts';
import type { EditorCamera, EditorCameraMode } from './camera.ts';
import type { MapVec3 } from '../types/map.ts';

export const PLAYTEST_SESSION_KEY = 'marbles3d_editor_playtest_session';

export interface EditorCameraSnapshot {
    mode: EditorCameraMode;
    target: MapVec3;
    zoom: number;
    orbitYaw: number;
    orbitPitch: number;
    orbitRadius: number;
}

export interface PlaytestSession {
    mapJson: string;
    selectedIndices: number[];
    camera: EditorCameraSnapshot;
}

/** The MapEditor state a playtest round-trips. */
export interface PlaytestSessionEditor {
    doc: MapDocument;
    selectedIndices: number[];
    camera: Pick<EditorCamera, keyof EditorCameraSnapshot>;
}

export function savePlaytestSession(editor: PlaytestSessionEditor): PlaytestSession {
    const session: PlaytestSession = {
        mapJson: serializeMapJson(editor.doc.map),
        selectedIndices: [...editor.selectedIndices],
        camera: {
            mode: editor.camera.mode,
            target: { ...editor.camera.target },
            zoom: editor.camera.zoom,
            orbitYaw: editor.camera.orbitYaw,
            orbitPitch: editor.camera.orbitPitch,
            orbitRadius: editor.camera.orbitRadius,
        },
    };

    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(PLAYTEST_SESSION_KEY, JSON.stringify(session));
    }
    return session;
}

export function loadPlaytestSessionRaw(): PlaytestSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(PLAYTEST_SESSION_KEY);
    if (!raw) return null;
    // Boundary: written by savePlaytestSession() in this tab.
    return JSON.parse(raw) as PlaytestSession;
}

export function restorePlaytestSession(editor: PlaytestSessionEditor): boolean {
    const session = loadPlaytestSessionRaw();
    if (!session) return false;

    const map = parseMapJson(session.mapJson);
    editor.doc.loadFromMap(map);
    editor.selectedIndices = session.selectedIndices?.length
        ? [...session.selectedIndices]
        : [];

    if (session.camera) {
        editor.camera.mode = session.camera.mode;
        editor.camera.target = { ...session.camera.target };
        editor.camera.zoom = session.camera.zoom;
        editor.camera.orbitYaw = session.camera.orbitYaw;
        editor.camera.orbitPitch = session.camera.orbitPitch;
        editor.camera.orbitRadius = session.camera.orbitRadius;
    }

    sessionStorage.removeItem(PLAYTEST_SESSION_KEY);
    return true;
}

/**
 * Pure helper for unit tests.
 */
export function roundTripSession(session: PlaytestSession): PlaytestSession {
    const json = JSON.stringify(session);
    return JSON.parse(json) as PlaytestSession;
}
