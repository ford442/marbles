import { audio } from '../audio.js';

export class InitPauseMenu {
    initPauseMenu() {
        // Initialize pause state
        this.isPaused = false
        this.settings = null

        // Get DOM elements
        this.pauseOverlay = document.getElementById('pause-overlay')
        this.settingsPanel = document.getElementById('settings-panel')
        this.pauseBtn = document.getElementById('pause-btn')

        // Bind button events
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause())
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
            btnSettingsSave.addEventListener('click', () => this.saveSettings())
        }

        // Settings reset defaults button
        const btnSettingsDefaults = document.getElementById('btn-settings-defaults')
        if (btnSettingsDefaults) {
            btnSettingsDefaults.addEventListener('click', () => this.resetSettingsToDefaults())
        }

        // Initialize settings tabs
        this.initSettingsTabs()

        // Initialize settings input listeners
        this.initSettingsInputs()

        // Close pause menu on ESC when already paused
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.settingsPanel && this.settingsPanel.classList.contains('active')) {
                    this.closeSettings()
                } else if (this.isPaused) {
                    this.togglePause()
                }
            }
        })
    }

    togglePause() {
        if (this.isPaused) {
            this.unpauseGame()
        } else {
            this.pauseGame()
        }
    }

    pauseGame() {
        if (this.isPaused) return
        
        this.isPaused = true
        
        // Show pause overlay
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.add('active')
        }

        // Dim/blur canvas
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.add('paused')
        }

        // Release pointer lock
        if (document.pointerLockElement === this.canvas) {
            document.exitPointerLock()
        }

        // Mute/lower audio
        if (audio && audio.setMasterVolume) {
            const currentVolume = this.settings?.audio?.master ?? 80
            audio.setMasterVolume(currentVolume * 0.3 / 100) // Lower to 30% while paused
        }

        console.log('[PAUSE] Game paused')
    }

    unpauseGame() {
        if (!this.isPaused) return
        
        this.isPaused = false
        
        // Hide pause overlay
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.remove('active')
        }

        // Remove canvas effects
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.remove('paused')
        }

        // Restore audio volume
        if (audio && audio.setMasterVolume && this.settings) {
            audio.setMasterVolume(this.settings.audio.master / 100)
        }

        // Re-acquire pointer lock if in game
        if (this.currentLevel && document.pointerLockElement !== this.canvas) {
            this.canvas.requestPointerLock().catch(() => {})
        }

        console.log('[PAUSE] Game unpaused')
    }

    restartCurrentLevel() {
        this.unpauseGame()
        if (this.currentLevel) {
            this.loadLevel(this.currentLevel)
        }
    }

    quitToMenu() {
        this.unpauseGame()
        this.clearLevel()
        this.showLevelSelection()
    }

    openSettings() {
        if (this.settingsPanel) {
            this.settingsPanel.classList.add('active')
            this.populateSettingsValues()
        }
    }

    closeSettings() {
        if (this.settingsPanel) {
            this.settingsPanel.classList.remove('active')
            // If we were in pause menu, stay paused
            if (!this.isPaused && this.pauseOverlay && this.pauseOverlay.classList.contains('active')) {
                // This shouldn't happen, but just in case
            }
        }
    }
}

export function applyInitPauseMenu(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitPauseMenu.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitPauseMenu.prototype[name];
        }
    }
}
