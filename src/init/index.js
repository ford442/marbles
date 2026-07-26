export { loadFilament, DEFAULT_SETTINGS } from './filament-loader.js';
import { installKnownMethods } from '../game/systems/method-installer.js';
import { InitCore } from './core.js';
import { InitPauseMenu } from './pause-menu.js';
import { InitSettingsTabs } from './settings-tabs.js';
import { InitSettings } from './settings.js';
import { InitGraphics } from './graphics.js';
import { InitLevelMenu } from './level-menu.js';
import { InitMultiplayerMenu } from './multiplayer-menu.js';
import { InitTouchControls } from './touch-init.js';

/** Closed compatibility list for init/menu methods not yet composed. */
export function installInitMethods(targetClass) {
    installKnownMethods(targetClass, InitCore, ['init', '_showInitError']);
    installKnownMethods(targetClass, InitPauseMenu, [
        'initPauseMenu', 'togglePause', 'pauseGame', 'unpauseGame',
        'restartCurrentLevel', 'quitToMenu', 'openSettings', 'closeSettings',
    ]);
    installKnownMethods(targetClass, InitSettingsTabs, [
        'initSettingsTabs', 'initSettingsInputs', 'populateSettingsValues',
    ]);
    installKnownMethods(targetClass, InitSettings, [
        'loadSettings', 'saveSettings', 'resetSettingsToDefaults', 'mergeWithDefaults',
        'applySettings', 'applyUIScale', 'applyHighContrast', 'applyGraphicsSettings',
    ]);
    installKnownMethods(targetClass, InitGraphics, [
        'createLight', 'enableShadowsOnEntity', 'getMouseSensitivity',
        'isYAxisInverted', 'getScreenShakeIntensity',
    ]);
    installKnownMethods(targetClass, InitLevelMenu, [
        'showLevelSelection', '_renderFlatLevelList', 'hideLevelSelection',
        'returnToMenu', 'showLevelMenu', 'setMenuCamera', 'transitionCameraToGameplay',
    ]);
    installKnownMethods(targetClass, InitMultiplayerMenu, [
        'initMultiplayerMenu', '_initHostAuthority', 'showMultiplayerLobby',
        '_hideMultiplayerLobby', '_setLobbyStatus', '_createRoom', '_joinRoom',
        '_startRace', '_leaveLobby', '_getPlayerName', '_updateHostControls',
        '_renderLobbyPlayers', '_showMultiplayerDisconnectBanner', 'tickMultiplayer',
    ]);
    installKnownMethods(targetClass, InitTouchControls, ['initTouchControls', 'applyTouchSettings']);
}
