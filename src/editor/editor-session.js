import { parseMapJson, serializeMapJson } from './map-document.js';

export const PLAYTEST_SESSION_KEY = 'marbles3d_editor_playtest_session';

/**
 * @typedef {object} EditorCameraSnapshot
 * @property {string} mode
 * @property {{ x: number, y: number, z: number }} target
 * @property {number} zoom
 * @property {number} orbitYaw
 * @property {number} orbitPitch
 * @property {number} orbitRadius
 */

/**
 * @typedef {object} PlaytestSession
 * @property {string} mapJson
 * @property {number[]} selectedIndices
 * @property {EditorCameraSnapshot} camera
 */

/**
 * @param {object} editor
 * @returns {PlaytestSession}
 */
export function savePlaytestSession(editor) {
    const session = {
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

/**
 * @returns {PlaytestSession | null}
 */
export function loadPlaytestSessionRaw() {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(PLAYTEST_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
}

/**
 * @param {object} editor
 * @returns {boolean}
 */
export function restorePlaytestSession(editor) {
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
 * @param {PlaytestSession} session
 * @returns {PlaytestSession}
 */
export function roundTripSession(session) {
    const json = JSON.stringify(session);
    return JSON.parse(json);
}
