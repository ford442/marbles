import { audio } from '../audio.js';
import { DEFAULT_SETTINGS } from './filament-loader.js';

export class InitSettings {
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('marbles3d_settings')
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings)
                // Merge with defaults to ensure all fields exist
                this.settings = this.mergeWithDefaults(this.settings)
                console.log('[SETTINGS] Loaded from localStorage')
            } else {
                this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
                console.log('[SETTINGS] Using default settings')
            }
        } catch (e) {
            console.warn('[SETTINGS] Failed to load settings:', e)
            this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        }

        // Apply loaded settings
        this.applySettings()
    }

    saveSettings() {
        try {
            localStorage.setItem('marbles3d_settings', JSON.stringify(this.settings))
            console.log('[SETTINGS] Saved to localStorage')
        } catch (e) {
            console.warn('[SETTINGS] Failed to save settings:', e)
        }

        this.applySettings()
        this.closeSettings()
    }

    resetSettingsToDefaults() {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        this.populateSettingsValues()
        this.applySettings()
        console.log('[SETTINGS] Reset to defaults')
    }

    mergeWithDefaults(saved) {
        const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        
        if (saved.graphics) {
            Object.assign(merged.graphics, saved.graphics)
        }
        if (saved.audio) {
            Object.assign(merged.audio, saved.audio)
        }
        if (saved.controls) {
            Object.assign(merged.controls, saved.controls)
        }
        if (saved.accessibility) {
            Object.assign(merged.accessibility, saved.accessibility)
        }
        
        return merged
    }

    applySettings() {
        if (!this.settings) return

        const s = this.settings

        // Apply audio settings
        if (audio) {
            if (audio.setMasterVolume) {
                audio.setMasterVolume(s.audio.master / 100)
            }
            if (audio.setSFXVolume) {
                audio.setSFXVolume(s.audio.sfx / 100)
            }
            if (audio.setMusicVolume) {
                audio.setMusicVolume(s.audio.music / 100)
            }
        }

        // Apply UI scale
        this.applyUIScale(s.accessibility.uiScale)

        // Apply high contrast
        this.applyHighContrast(s.accessibility.highContrast)

        // Apply graphics settings
        this.applyGraphicsSettings()

        console.log('[SETTINGS] Applied settings')
    }

    applyUIScale(scale) {
        const ui = document.getElementById('ui')
        if (ui) {
            ui.style.transform = `scale(${scale / 100})`
            ui.style.transformOrigin = 'bottom left'
        }
    }

    applyHighContrast(enabled) {
        if (enabled) {
            document.body.classList.add('high-contrast')
        } else {
            document.body.classList.remove('high-contrast')
        }
    }

    applyGraphicsSettings() {
        // Graphics settings would be applied here
        // These would affect Filament renderer settings
        const s = this.settings.graphics

        // Control shadows on the Filament sun light
        if (this.sunLight && this.engine && this.scene) {
            const shadowsEnabled = s.shadows !== false

            // Destroy and recreate the sun light since Filament LightManager
            // doesn't have a runtime setCastShadows() method
            this.scene.remove(this.sunLight)
            this.engine.destroyEntity(this.sunLight)
            this.Filament.EntityManager.get().destroy(this.sunLight)

            this.sunLight = this.Filament.EntityManager.get().create()
            const builder = this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
                .color([1.0, 0.96, 0.88])
                .intensity(150000.0)
                .direction([0.4, -1.0, -0.65])

            if (shadowsEnabled) {
                builder.castShadows(true)
            } else {
                builder.castShadows(false)
            }

            builder.build(this.engine, this.sunLight)
            this.scene.addEntity(this.sunLight)
        }

        // Example: Adjust bloom
        if (this.view && s.bloom !== undefined) {
            // Post-processing bloom adjustment would go here
        }
    }
}

export function applyInitSettings(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitSettings.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitSettings.prototype[name];
        }
    }
}
