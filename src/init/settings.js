import { audio } from '../audio.js';
import { DEFAULT_SETTINGS } from './filament-loader.js';
import { DEFAULT_MSAA_SAMPLE_COUNT, getPostFxQualityFlags, getShadowQualityConfig } from '../rendering-defaults.js';
import { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getFogQualityConfig, getEnvironmentFogPreset } from '../rendering/post-fx-presets.js';

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

        // Live bloom update — strength is user-adjustable; other params are quality-tiered
        if (this.view && s.bloom !== undefined) {
            try {
                const quality = s.quality || 'medium'
                const bloomConfig = getBloomQualityConfig(quality, this.Filament)
                bloomConfig.enabled = s.bloom > 0
                // s.bloom is 0–100 (user slider); 50 is the nominal default.
                // At 50 the tier's base strength is used unchanged; the user can
                // halve it (0) or double it (100) from there.
                const BLOOM_SLIDER_DEFAULT = 50
                bloomConfig.strength = bloomConfig.strength * (s.bloom / BLOOM_SLIDER_DEFAULT)
                this.view.setBloomOptions(bloomConfig)
            } catch (e) {
                console.warn('[SETTINGS] Bloom live update failed:', e)
            }
        }

        // Live SSAO toggle — wired directly to the active Filament view
        if (this.view && s.ssao !== undefined) {
            try {
                const quality = s.quality || 'medium'
                this.view.setAmbientOcclusionOptions(getSsaoQualityConfig(quality, this.Filament, s.ssao !== false))
            } catch (e) {
                console.warn('[SETTINGS] SSAO live update failed:', e)
            }
        }

        // Anti-aliasing and heavy post-FX depend on quality tier.
        // low: no TAA, no motion blur, no SSR
        // medium: TAA on, motion blur/SSR off
        // high/ultra: TAA on, motion blur/SSR on
        if (this.view) {
            const quality = s.quality || 'medium'
            const { taaEnabled, heavyFxEnabled } = getPostFxQualityFlags(quality)

            try {
                this.view.setMultiSampleAntiAliasingOptions({ enabled: !taaEnabled, sampleCount: DEFAULT_MSAA_SAMPLE_COUNT })
            } catch (e) {
                console.warn('[SETTINGS] MSAA live update failed:', e)
            }

            try {
                this.view.setTemporalAntiAliasingOptions({
                    enabled: taaEnabled,
                    filterWidth: 2.0,
                    feedback: 0.85,
                    jitterSpread: 0.75,
                })
            } catch (e) {
                console.warn('[SETTINGS] TAA live update failed:', e)
            }

            if (typeof this.view.setMotionBlurOptions === 'function') {
                try {
                    this.view.setMotionBlurOptions({
                        enabled: heavyFxEnabled,
                        intensity: 0.32,
                        maxDisplacement: 0.18,
                    })
                } catch (e) {
                    console.warn('[SETTINGS] Motion blur live update failed:', e)
                }
            }

            try {
                this.view.setScreenSpaceReflectionsOptions({
                    enabled: heavyFxEnabled,
                    thickness: 0.1,
                    bias: 0.01,
                    maxDistance: 3.0,
                    stride: 2.0,
                })
            } catch (e) {
                console.warn('[SETTINGS] SSR live update failed:', e)
            }

            // Vignette — enabled on high/ultra, silently skipped if API is absent
            try {
                this.view.setVignetteOptions(getVignetteConfig(quality))
            } catch (e) { /* setVignetteOptions may not be available in all Filament builds */ }

            // Shadow quality — updated whenever the quality tier or shadow toggle changes.
            // Only apply shadow options when shadows are enabled.
            if (s.shadows !== false) {
                const { shadowOptions, vsmOptions, softOptions } = getShadowQualityConfig(quality)
                if (typeof this.view.setShadowOptions === 'function') {
                    try {
                        this.view.setShadowOptions(shadowOptions)
                    } catch (e) {
                        console.warn('[SETTINGS] setShadowOptions live update failed:', e)
                    }
                }
                if (vsmOptions) {
                    try {
                        this.view.setVsmShadowOptions(vsmOptions)
                    } catch (e) {
                        console.warn('[SETTINGS] setVsmShadowOptions live update failed:', e)
                    }
                }
                if (softOptions) {
                    try {
                        this.view.setSoftShadowOptions(softOptions)
                    } catch (e) {
                        console.warn('[SETTINGS] setSoftShadowOptions live update failed:', e)
                    }
                }
            }

            // Fog quality — updated when quality tier changes or quality-dependent settings update
            try {
                const fogConfig = getFogQualityConfig(quality);
                if (fogConfig.enabled) {
                    const fogOptions = { ...fogConfig };
                    // Apply environment-specific fog overrides if environment is available
                    const envName = this.currentEnvironment || 'default';
                    const envFogPreset = getEnvironmentFogPreset(envName);
                    Object.assign(fogOptions, envFogPreset);

                    if (fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                    if (fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                    fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                    this.view.setFogOptions(fogOptions);
                } else {
                    this.view.setFogOptions({ enabled: false });
                }
            } catch (e) {
                console.warn('[SETTINGS] Fog live update failed:', e);
            }
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
