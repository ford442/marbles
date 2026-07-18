import loadingHtml from './templates/loading.html?raw';
import menusHtml from './templates/menus.html?raw';
import hudHtml from './templates/hud.html?raw';
import modalsHtml from './templates/modals.html?raw';
import settingsHtml from './templates/settings.html?raw';
import editorHtml from './templates/editor.html?raw';
import touchHtml from './templates/touch.html?raw';

const PARTIALS = [
    loadingHtml,
    modalsHtml,
    menusHtml,
    settingsHtml,
    hudHtml,
    editorHtml,
    touchHtml,
];

/**
 * Inject static UI partials into the DOM before game init runs.
 * This keeps index.html a thin shell and lets Vite hot-reload the
 * extracted CSS and HTML templates during development.
 */
export function mountShell() {
    const root = document.getElementById('ui-root');
    if (!root) {
        console.warn('[UI] No #ui-root found; skipping shell mount');
        return;
    }
    root.innerHTML = PARTIALS.join('\n');
}
