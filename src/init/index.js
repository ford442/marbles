export { loadFilament, DEFAULT_SETTINGS } from './filament-loader.js';
import { defineSlice } from '../game/systems/slice-composition.ts';
import { InitCore } from './core.js';
import { InitPauseMenu } from './pause-menu.js';
import { InitSettingsTabs } from './settings-tabs.js';
import { InitSettings } from './settings.js';
import { InitGraphics } from './graphics.js';
import { InitLevelMenu } from './level-menu.js';
import { InitMultiplayerMenu } from './multiplayer-menu.js';
import { InitTouchControls } from './touch-init.js';

/** Composed init/menu slices; the game forwards each `methods` list to the instance at `key`. */
export const INIT_SLICES = [
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
