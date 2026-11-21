export { loadFilament, DEFAULT_SETTINGS } from './filament-loader.ts';
import { defineSlice, type SliceSpec } from '../game/systems/slice-composition.ts';
import { InitCore } from './core.ts';
import { InitPauseMenu } from './pause-menu.ts';
import { InitSettingsTabs } from './settings-tabs.ts';
import { InitSettings } from './settings.ts';
import { InitGraphics } from './graphics.ts';
import { InitLevelMenu } from './level-menu.ts';
import { InitMultiplayerMenu } from './multiplayer-menu.ts';
import { InitTouchControls } from './touch-init.ts';
import type { InitCoreHost } from './core.ts';
import type { InitPauseMenuHost } from './pause-menu.ts';
import type { InitSettingsTabsHost } from './settings-tabs.ts';
import type { InitSettingsHost } from './settings.ts';
import type { InitGraphicsHost } from './graphics.ts';
import type { InitLevelMenuHost } from './level-menu.ts';
import type { InitMultiplayerMenuHost } from './multiplayer-menu.ts';
import type { InitTouchControlsHost } from './touch-init.ts';

/** Everything the composed init / menu slices use on the game: the intersection of their hosts. */
export type InitSlicesHost =
    & InitCoreHost
    & InitPauseMenuHost
    & InitSettingsTabsHost
    & InitSettingsHost
    & InitGraphicsHost
    & InitLevelMenuHost
    & InitMultiplayerMenuHost
    & InitTouchControlsHost;

/** Composed init/menu slices; the game forwards each `methods` list to the instance at `key`. */
export const INIT_SLICES: SliceSpec<InitSlicesHost>[] = [
    defineSlice('initCoreSlice', InitCore, ['init', '_showInitError']),
    defineSlice('initPauseMenuSlice', InitPauseMenu, [
        'initPauseMenu', 'togglePause', 'pauseGame', 'unpauseGame', 'restartCurrentLevel',
        'quitToMenu', 'openSettings', 'closeSettings',
    ]),
    defineSlice('initSettingsTabsSlice', InitSettingsTabs, [
        'initSettingsTabs', 'initSettingsInputs', 'populateSettingsValues',
    ]),
    defineSlice('initSettingsSlice', InitSettings, [
        'loadSettings', 'saveSettings', 'resetSettingsToDefaults', 'mergeWithDefaults',
        'applySettings', 'applyUIScale', 'applyHighContrast', 'applyGraphicsSettings',
    ]),
    defineSlice('initGraphicsSlice', InitGraphics, [
        'createLight', 'enableShadowsOnEntity', 'getMouseSensitivity', 'isYAxisInverted',
        'getScreenShakeIntensity',
    ]),
    defineSlice('initLevelMenuSlice', InitLevelMenu, [
        'showLevelSelection', '_renderFlatLevelList', '_renderCommunityLevels', 'hideLevelSelection',
        'returnToMenu', 'showLevelMenu', 'setMenuCamera', 'transitionCameraToGameplay',
    ]),
    defineSlice('initMultiplayerMenuSlice', InitMultiplayerMenu, [
        'initMultiplayerMenu', '_initHostAuthority', 'showMultiplayerLobby', '_hideMultiplayerLobby',
        '_setLobbyStatus', '_createRoom', '_joinRoom', '_startRace', '_leaveLobby', '_getPlayerName',
        '_updateHostControls', '_renderLobbyPlayers', '_showMultiplayerDisconnectBanner',
        'tickMultiplayer',
    ]),
    defineSlice('initTouchControlsSlice', InitTouchControls, ['initTouchControls', 'applyTouchSettings']),
];
