// @ts-check
/**
 * Editor-mode detection, kept apart from the editor itself so the game can
 * check the URL without pulling the editor (and ajv) into the main chunk.
 * @returns {boolean}
 */
export function isEditorMode() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('editor') || params.get('mode') === 'editor';
}
