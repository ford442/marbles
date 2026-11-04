/**
 * Marble picker in the level menu (`#marble-picker`, src/ui/templates/menus.html).
 *
 * Lists every catalog marble; locked ones (campaign rewards not yet earned,
 * premium marbles not granted) are shown disabled with how to get them.
 * Selection goes through MarbleRegistry.selectMarble, which enforces the
 * same gating, and is persisted for the next level load.
 */
import { marblesInfo } from '../marbles_data.js';
import { isMarbleUnlocked } from './selection.js';

const LOCK_HINT = {
    campaign: 'earn gold medals in the campaign',
    premium: 'premium',
};

/**
 * @param {{ getUnlockedMarbleIds(): string[], getSelectedMarbleId(): string, selectMarble(id: string): { ok: boolean, reason?: string } }} registry
 * @param {HTMLElement} root
 */
export function renderMarblePicker(registry, root) {
    const unlocked = registry.getUnlockedMarbleIds();
    const selectedId = registry.getSelectedMarbleId();

    root.innerHTML = '';
    const label = document.createElement('label');
    label.className = 'marble-picker-label';
    label.textContent = '🔮 Marble ';

    const select = document.createElement('select');
    select.id = 'marble-picker-select';
    const open = document.createElement('optgroup');
    open.label = 'Available';
    const locked = document.createElement('optgroup');
    locked.label = 'Locked';

    for (const info of marblesInfo) {
        const option = document.createElement('option');
        option.value = info.id;
        if (isMarbleUnlocked(info, unlocked)) {
            option.textContent = info.premium ? `★ ${info.name}` : info.name;
            option.selected = info.id === selectedId;
            open.appendChild(option);
        } else {
            option.disabled = true;
            option.textContent = `🔒 ${info.name} (${LOCK_HINT[info.unlock] || 'locked'})`;
            locked.appendChild(option);
        }
    }
    select.appendChild(open);
    if (locked.childElementCount) select.appendChild(locked);

    const status = document.createElement('span');
    status.className = 'marble-picker-status';
    status.textContent = `${open.childElementCount} / ${marblesInfo.length} unlocked`;

    select.addEventListener('change', () => {
        const result = registry.selectMarble(select.value);
        if (!result.ok) {
            select.value = registry.getSelectedMarbleId();
            status.textContent = result.reason === 'locked' ? 'That marble is locked' : 'Unknown marble';
        }
    });

    label.appendChild(select);
    root.append(label, status);
}

/**
 * Render now and again every time the level menu is shown (unlocks change
 * after a run). No-op without a DOM or the picker mount point.
 * @param {Parameters<typeof renderMarblePicker>[0]} registry
 */
export function mountMarblePicker(registry) {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('marble-picker');
    const menu = document.getElementById('level-menu');
    if (!root || !menu) return null;
    let wasHidden = true;
    const refresh = () => {
        const hidden = menu.classList.contains('menu-hidden');
        if (wasHidden && !hidden) renderMarblePicker(registry, root);
        wasHidden = hidden;
    };
    renderMarblePicker(registry, root);
    const observer = new MutationObserver(refresh);
    observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
    return observer;
}
