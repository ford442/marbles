export { loadFilament, DEFAULT_SETTINGS } from './filament-loader.js';
import { applyInitCore } from './core.js';
import { applyInitPauseMenu } from './pause-menu.js';
import { applyInitSettingsTabs } from './settings-tabs.js';
import { applyInitSettings } from './settings.js';
import { applyInitGraphics } from './graphics.js';
import { applyInitLevelMenu } from './level-menu.js';
import { applyInitLevelLoader } from './level-loader.js';
import { applyInitCleanup } from './cleanup.js';

export function applyInitMethods(targetClass) {
    applyInitCore(targetClass);
    applyInitPauseMenu(targetClass);
    applyInitSettingsTabs(targetClass);
    applyInitSettings(targetClass);
    applyInitGraphics(targetClass);
    applyInitLevelMenu(targetClass);
    applyInitLevelLoader(targetClass);
    applyInitCleanup(targetClass);
}
