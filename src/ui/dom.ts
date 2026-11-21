/**
 * `document.getElementById` for shell elements index.html / the UI templates
 * always provide. A missing one is a broken build, so this throws (as the
 * untyped `el.style...` dereference used to) instead of returning null.
 */
export function requireElement(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new TypeError(`[UI] #${id} is missing from the page`);
    return el;
}
