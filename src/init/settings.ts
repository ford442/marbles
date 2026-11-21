import { audio } from '../audio.js';
import { DEFAULT_SETTINGS } from './filament-loader.ts';
import { DEFAULT_MSAA_SAMPLE_COUNT, getPostFxQualityFlags, getShadowQualityConfig } from '../rendering-defaults.js';
import { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getFogQualityConfig, getEnvironmentFogPreset } from '../rendering/post-fx-presets.js';
import { applyDynamicResolution } from '../render-resolution.ts';
import { applyMobileGraphicsDefaults, MOBILE_DEFAULTS_FLAG, resolveMobileInitQuality } from '../platform/mobile-presets.js';
import { detectPlatformProfile } from '../rendering-defaults.js';
import { downgradeQualityTier } from '../level-effect-budget.js';
import { updateMarbleMaterialTiers, type MaterialTierHost } from '../marble-material-tier.ts';
import type { MarbleRegistry } from '../game/systems/marble-registry.js';
import type { GameLogicLevelComplete } from '../game-logic/level-complete.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras } from '../types/frame-host.ts';
import type { GameSettings, SettingsContext } from '../types/settings.ts';
import type { InitPauseMenu } from './pause-menu.ts';
import type { InitSettingsTabs } from './settings-tabs.ts';
import type { InitTouchControls } from './touch-init.ts';

/** A saved settings blob: any section or field may be missing (older saves). */
export type SavedSettings = { [K in keyof GameSettings]?: Partial<GameSettings[K]> };

/** IBL / fog environment name last applied by `ZoneVisuals.setEnvironment`. */
export interface EnvironmentNameContext {
    currentEnvironment?: string | null;
}

/** What `InitSettings` uses on the game. */
export type InitSettingsHost =
    & SettingsContext
    & EnvironmentNameContext
    & Pick<EngineContext,
        | 'Filament' | 'engine' | 'scene' | 'view' | 'sunLight' | 'volumetricLights' | 'lightingBudget'
        | 'autoQualityGovernor'>
    & Pick<FrameExtras, 'abilitySystem'>
    & Pick<InitPauseMenu, 'closeSettings'>
    & Pick<InitSettingsTabs, 'populateSettingsValues'>
    & Partial<Pick<InitTouchControls, 'applyTouchSettings'>>
    & Partial<Pick<GameLogicLevelComplete, 'resize'>>
    & Partial<Pick<MarbleRegistry, 'updateActiveMarbleLight'>>
    & MaterialTierHost;

/** Fresh deep copy of the defaults. */
function cloneDefaultSettings(): GameSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as GameSettings
}

/**
 * `game.settings` where callers rely on it being loaded (UI handlers, the
 * governor's re-apply). Throws a TypeError when it isn't, as the bare
 * `game.settings.x` dereference these call sites used to do.
 */
export function requireSettings(game: Pick<SettingsContext, 'settings'>): GameSettings {
    const settings = game.settings
    if (!settings) throw new TypeError('[SETTINGS] settings not loaded')
    return settings
}

export class InitSettings {
    declare game: InitSettingsHost;

    constructor(game: InitSettingsHost) {
        this.game = game;
    }

    loadSettings(): void {
        try {
            const savedSettings = localStorage.getItem('marbles3d_settings')
            if (savedSettings) {
                // Merge with defaults to ensure all fields exist
                this.game.settings = this.mergeWithDefaults(JSON.parse(savedSettings) as SavedSettings)
                console.log('[SETTINGS] Loaded from localStorage')
            } else {
                const settings = cloneDefaultSettings()
                this.game.settings = settings
                if (typeof localStorage !== 'undefined' && !localStorage.getItem(MOBILE_DEFAULTS_FLAG)) {
                    if (applyMobileGraphicsDefaults(settings)) {
                        localStorage.setItem(MOBILE_DEFAULTS_FLAG, '1')
                        console.log('[SETTINGS] Applied first-run mobile graphics preset')
                    }
                }
                console.log('[SETTINGS] Using default settings')
            }
        } catch (e) {
            console.warn('[SETTINGS] Failed to load settings:', e)
            this.game.settings = cloneDefaultSettings()
        }

        // Apply loaded settings
        this.applySettings()
        this.game.abilitySystem?.loadKeybinds(this.game.settings?.controls?.keybinds)
        this.game.applyTouchSettings?.()
        this.game.abilitySystem?.init()
    }

    saveSettings(): void {
        try {
            if (this.game.abilitySystem) {
                requireSettings(this.game).controls.keybinds = this.game.abilitySystem.exportKeybinds()
            }
            localStorage.setItem('marbles3d_settings', JSON.stringify(this.game.settings))
            console.log('[SETTINGS] Saved to localStorage')
        } catch (e) {
            console.warn('[SETTINGS] Failed to save settings:', e)
        }

        this.applySettings()
        this.game.applyTouchSettings?.()
        this.game.closeSettings()
    }

    resetSettingsToDefaults(): void {
        this.game.settings = cloneDefaultSettings()
        this.game.populateSettingsValues()
        this.applySettings()
        console.log('[SETTINGS] Reset to defaults')
    }

    mergeWithDefaults(saved: SavedSettings): GameSettings {
        const merged = cloneDefaultSettings()
        
        if (saved.graphics) {
            Object.assign(merged.graphics, saved.graphics)
        }
        if (saved.audio) {
            Object.assign(merged.audio, saved.audio)
        }
        if (saved.controls) {
            Object.assign(merged.controls, saved.controls)
            if (saved.controls.keybinds) {
                merged.controls.keybinds = { ...merged.controls.keybinds, ...saved.controls.keybinds }
            }
            if (saved.controls.touch) {
                merged.controls.touch = { ...merged.controls.touch, ...saved.controls.touch }
            }
        }
        if (saved.accessibility) {
            Object.assign(merged.accessibility, saved.accessibility)
        }
        
        return merged
    }

    applySettings(): void {
        if (!this.game.settings) return

        const s = this.game.settings

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

        const perfMode = s.graphics?.performanceMode || 'auto'
        if (perfMode === 'locked') {
            this.game.autoQualityGovernor?.reset()
        }

        console.log('[SETTINGS] Applied settings')
    }

    applyUIScale(scale: number): void {
        const ui = document.getElementById('ui')
        if (ui) {
            ui.style.transform = `scale(${scale / 100})`
            ui.style.transformOrigin = 'bottom left'
        }
    }

    applyHighContrast(enabled: boolean): void {
        if (enabled) {
            document.body.classList.add('high-contrast')
        } else {
            document.body.classList.remove('high-contrast')
        }
    }

    applyGraphicsSettings(): void {
        const base = requireSettings(this.game).graphics
        const runtime = this.game._runtimeGraphicsOverrides || {}
        const s = { ...base, ...runtime }
        const baseQuality = base.quality || 'medium'
        let quality = baseQuality
        if (runtime.shadowTierDowngrade) {
            quality = downgradeQualityTier(baseQuality, runtime.shadowTierDowngrade)
        }
        if (runtime.effectiveQuality) {
            quality = runtime.effectiveQuality
        }

        const shadowsEnabled = s.shadows !== false && !runtime.shadowsDisabled

        if (this.game.sunLight && this.game.engine && this.game.scene) {
            // Destroy and recreate the sun light since Filament LightManager
            // doesn't have a runtime setCastShadows() method
            this.game.scene.remove(this.game.sunLight)
            this.game.engine.destroyEntity(this.game.sunLight)
            this.game.Filament.EntityManager.get().destroy(this.game.sunLight)

            this.game.sunLight = this.game.Filament.EntityManager.get().create()
            const builder = this.game.Filament.LightManager.Builder(this.game.Filament['LightManager$Type'].DIRECTIONAL)
                .color([1.0, 0.96, 0.88])
                .intensity(150000.0)
                .direction([0.4, -1.0, -0.65])

            if (shadowsEnabled) {
                builder.castShadows(true)
            } else {
                builder.castShadows(false)
            }

            builder.build(this.game.engine, this.game.sunLight)
            this.game.scene.addEntity(this.game.sunLight)
        }

        // Dynamic resolution (FPS protection) — toggled live on the active view
        if (this.game.view) {
            const minScale = runtime.dynamicMinScale ?? 0.5
            applyDynamicResolution(this.game.view, this.game.Filament, s.dynamicResolution, { minScale })
        }

        // Render scale — re-size the canvas backing store. resize() reads the
        // current renderScale from settings, so just trigger it.
        if (typeof this.game.resize === 'function' && this.game.view) {
            try {
                this.game.resize()
            } catch (e) {
                console.warn('[SETTINGS] Render scale resize failed:', e)
            }
        }

        // Live bloom update — strength is user-adjustable; other params are quality-tiered
        if (this.game.view && s.bloom !== undefined) {
            try {
                const bloomConfig = getBloomQualityConfig(quality, this.game.Filament)
                bloomConfig.enabled = s.bloom > 0
                // s.bloom is 0–100 (user slider); 50 is the nominal default.
                // At 50 the tier's base strength is used unchanged; the user can
                // halve it (0) or double it (100) from there.
                const BLOOM_SLIDER_DEFAULT = 50
                bloomConfig.strength = bloomConfig.strength * (s.bloom / BLOOM_SLIDER_DEFAULT)
                this.game.view.setBloomOptions(bloomConfig)
            } catch (e) {
                console.warn('[SETTINGS] Bloom live update failed:', e)
            }
        }

        // Live SSAO toggle — wired directly to the active Filament view
        if (this.game.view && s.ssao !== undefined) {
            try {
                const ssaoOn = s.ssao !== false && !runtime.ssaoDisabled
                this.game.view.setAmbientOcclusionOptions(getSsaoQualityConfig(quality, this.game.Filament, ssaoOn))
            } catch (e) {
                console.warn('[SETTINGS] SSAO live update failed:', e)
            }
        }

        // Anti-aliasing and heavy post-FX depend on quality tier.
        // low: no TAA, no motion blur, no SSR
        // medium: TAA on, motion blur/SSR off
        // high/ultra: TAA on, motion blur/SSR on
        if (this.game.view) {
            const { taaEnabled, heavyFxEnabled: tierHeavyFx } = getPostFxQualityFlags(quality)
            const heavyFxEnabled = tierHeavyFx && !runtime.heavyFxDisabled

            if (runtime.volumetricDisabled && this.game.volumetricLights) {
                this.game.volumetricLights.setQuality('low')
            }

            try {
                this.game.view.setMultiSampleAntiAliasingOptions({ enabled: !taaEnabled, sampleCount: DEFAULT_MSAA_SAMPLE_COUNT })
            } catch (e) {
                console.warn('[SETTINGS] MSAA live update failed:', e)
            }

            try {
                this.game.view.setTemporalAntiAliasingOptions({
                    enabled: taaEnabled,
                    filterWidth: 2.0,
                    feedback: 0.85,
                    jitterSpread: 0.75,
                })
            } catch (e) {
                console.warn('[SETTINGS] TAA live update failed:', e)
            }

            if (typeof this.game.view.setMotionBlurOptions === 'function') {
                try {
                    this.game.view.setMotionBlurOptions({
                        enabled: heavyFxEnabled,
                        intensity: 0.32,
                        maxDisplacement: 0.18,
                    })
                } catch (e) {
                    console.warn('[SETTINGS] Motion blur live update failed:', e)
                }
            }

            try {
                this.game.view.setScreenSpaceReflectionsOptions({
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
                this.game.view.setVignetteOptions(getVignetteConfig(quality))
            } catch (e) { /* setVignetteOptions may not be available in all Filament builds */ }

            // Shadow quality — updated whenever the quality tier or shadow toggle changes.
            // Only apply shadow options when shadows are enabled.
            if (shadowsEnabled) {
                const { shadowOptions, vsmOptions, softOptions } = getShadowQualityConfig(quality)
                if (typeof this.game.view.setShadowOptions === 'function') {
                    try {
                        this.game.view.setShadowOptions(shadowOptions)
                    } catch (e) {
                        console.warn('[SETTINGS] setShadowOptions live update failed:', e)
                    }
                }
                if (vsmOptions) {
                    try {
                        this.game.view.setVsmShadowOptions(vsmOptions)
                    } catch (e) {
                        console.warn('[SETTINGS] setVsmShadowOptions live update failed:', e)
                    }
                }
                if (softOptions) {
                    try {
                        this.game.view.setSoftShadowOptions(softOptions)
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
                    const envName = this.game.currentEnvironment || 'default';
                    const envFogPreset = getEnvironmentFogPreset(envName);
                    Object.assign(fogOptions, envFogPreset);

                    // (`undefined` compares false both ways, as before.)
                    if (fogOptions.heightFalloff !== undefined && fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                    if (fogOptions.heightFalloff !== undefined && fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                    fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                    this.game.view.setFogOptions(fogOptions);
                } else {
                    this.game.view.setFogOptions({ enabled: false });
                }
            } catch (e) {
                console.warn('[SETTINGS] Fog live update failed:', e);
            }
        }

        if (typeof this.game.updateActiveMarbleLight === 'function') {
            this.game.updateActiveMarbleLight()
        }
        this.game.lightingBudget?.update()
        updateMarbleMaterialTiers(this.game, performance.now())
    }
}
