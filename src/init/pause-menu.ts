import { audio } from '../audio.js';
import type { GameLogicLevelComplete } from '../game-logic/level-complete.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { LevelLoader } from '../game/systems/level-loader.ts';
import type { FrameState } from '../types/frame-host.ts';
import type { SettingsContext } from '../types/settings.ts';
import type { InitLevelMenu } from './level-menu.ts';
import type { InitSettings } from './settings.ts';
import type { InitSettingsTabs } from './settings-tabs.ts';

/** Pause / settings overlay elements, looked up once by `initPauseMenu()`. */
export interface PauseMenuElements {
    pauseOverlay?: HTMLElement | null;
    settingsPanel?: HTMLElement | null;
    pauseBtn?: HTMLElement | null;
}

/** What `InitPauseMenu` uses on the game. */
export type InitPauseMenuHost =
    & PauseMenuElements
    & Pick<SettingsContext, 'settings'>
    & Pick<InputSystemHost, 'isPaused' | 'canvas'>
    & Pick<FrameState, 'currentLevel'>
    & Pick<InitSettings, 'saveSettings' | 'resetSettingsToDefaults'>
    & Pick<InitSettingsTabs, 'initSettingsTabs' | 'initSettingsInputs' | 'populateSettingsValues'>
    & Pick<LevelLoader, 'loadLevel' | 'clearLevel'>
    & Pick<InitLevelMenu, 'showLevelSelection'>
    & Partial<Pick<GameLogicLevelComplete, 'importGhostReplay'>>;

export class InitPauseMenu {
    declare game: InitPauseMenuHost;

    constructor(game: InitPauseMenuHost) {
        this.game = game;
    }

    initPauseMenu(): void {
        // Initialize pause state
        this.game.isPaused = false
        this.game.settings = null

        // Get DOM elements
        this.game.pauseOverlay = document.getElementById('pause-overlay')
        this.game.settingsPanel = document.getElementById('settings-panel')
        this.game.pauseBtn = document.getElementById('pause-btn')

        // Bind button events
        if (this.game.pauseBtn) {
            this.game.pauseBtn.addEventListener('click', () => this.togglePause())
        }

        // Resume button
        const btnResume = document.getElementById('btn-resume')
        if (btnResume) {
            btnResume.addEventListener('click', () => this.togglePause())
        }

        // Restart button (in pause menu)
        const btnRestartPause = document.getElementById('btn-restart-pause')
        if (btnRestartPause) {
            btnRestartPause.addEventListener('click', () => this.restartCurrentLevel())
        }

        const btnImportGhost = document.getElementById('btn-import-ghost-pause')
        if (btnImportGhost) {
            btnImportGhost.addEventListener('click', () => {
                if (typeof this.game.importGhostReplay === 'function') {
                    this.game.importGhostReplay()
                }
            })
        }

        // Settings button
        const btnSettings = document.getElementById('btn-settings')
        if (btnSettings) {
            btnSettings.addEventListener('click', () => this.openSettings())
        }

        // Quit to menu button
        const btnQuitMenu = document.getElementById('btn-quit-menu')
        if (btnQuitMenu) {
            btnQuitMenu.addEventListener('click', () => this.quitToMenu())
        }

        // Settings close button (X)
        const settingsClose = document.getElementById('settings-close')
        if (settingsClose) {
            settingsClose.addEventListener('click', () => this.closeSettings())
        }

        // Settings back button
        const btnSettingsBack = document.getElementById('btn-settings-back')
        if (btnSettingsBack) {
            btnSettingsBack.addEventListener('click', () => this.closeSettings())
        }

        // Settings save button
        const btnSettingsSave = document.getElementById('btn-settings-save')
        if (btnSettingsSave) {
            btnSettingsSave.addEventListener('click', () => this.game.saveSettings())
        }

        // Settings reset defaults button
        const btnSettingsDefaults = document.getElementById('btn-settings-defaults')
        if (btnSettingsDefaults) {
            btnSettingsDefaults.addEventListener('click', () => this.game.resetSettingsToDefaults())
        }

        // Initialize settings tabs
        this.game.initSettingsTabs()

        // Initialize settings input listeners
        this.game.initSettingsInputs()

        // Close pause menu on ESC when already paused
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.game.settingsPanel && this.game.settingsPanel.classList.contains('active')) {
                    this.closeSettings()
                } else if (this.game.isPaused) {
                    this.togglePause()
                }
            }
        })
    }

    togglePause(): void {
        if (this.game.isPaused) {
            this.unpauseGame()
        } else {
            this.pauseGame()
        }
    }

    pauseGame(): void {
        if (this.game.isPaused) return

        this.game.isPaused = true

        // Show pause overlay
        if (this.game.pauseOverlay) {
            this.game.pauseOverlay.classList.add('active')
        }

        // Dim/blur canvas
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.add('paused')
        }

        // Release pointer lock
        if (document.pointerLockElement === this.game.canvas) {
            document.exitPointerLock()
        }

        // Duck SFX while paused (preserves saved master volume)
        if (audio?.setPaused) {
            audio.setPaused(true)
        }

        console.log('[PAUSE] Game paused')
    }

    unpauseGame(): void {
        if (!this.game.isPaused) return

        this.game.isPaused = false

        // Hide pause overlay
        if (this.game.pauseOverlay) {
            this.game.pauseOverlay.classList.remove('active')
        }

        // Remove canvas effects
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.remove('paused')
        }

        // Restore audio ducking
        if (audio?.setPaused) {
            audio.setPaused(false)
        }

        // Re-acquire pointer lock if in game
        if (this.game.currentLevel && document.pointerLockElement !== this.game.canvas) {
            this.game.canvas.requestPointerLock().catch(() => {})
        }

        console.log('[PAUSE] Game unpaused')
    }

    restartCurrentLevel(): void {
        this.unpauseGame()
        if (this.game.currentLevel) {
            this.game.loadLevel(this.game.currentLevel)
        }
    }

    quitToMenu(): void {
        this.unpauseGame()
        this.game.clearLevel()
        this.game.showLevelSelection()
    }

    openSettings(): void {
        if (this.game.settingsPanel) {
            this.game.settingsPanel.classList.add('active')
            this.game.populateSettingsValues()
        }
    }

    closeSettings(): void {
        if (this.game.settingsPanel) {
            this.game.settingsPanel.classList.remove('active')
            // If we were in pause menu, stay paused
            if (!this.game.isPaused && this.game.pauseOverlay && this.game.pauseOverlay.classList.contains('active')) {
                // This shouldn't happen, but just in case
            }
        }
    }
}
