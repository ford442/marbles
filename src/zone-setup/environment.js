import { DEFAULT_MSAA_SAMPLE_COUNT, getPostFxQualityFlags, getShadowQualityConfig } from '../rendering-defaults.js';
import { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getColorGradingConfig, getEnvironmentColorGradingPreset, getFogQualityConfig, getEnvironmentFogPreset } from '../rendering/post-fx-presets.js';
import { buildEnvironmentLighting, destroyEnvironmentLighting, destroyEnvironmentWithCubemaps, upgradeEnvironmentWithCubemap, ENVIRONMENT_PRESETS } from '../rendering/environment.js';
import { CUBEMAP_QUALITY_LEVELS} from '../rendering/environment.js';

export class ZoneSetupEnvironment {
    setupPostProcessing() {
        const quality = this.settings?.graphics?.quality || 'medium';
        const { taaEnabled, motionBlurEnabled, ssrEnabled } = getPostFxQualityFlags(quality)

        // Bloom — resolution, strength, and quality scale with the quality tier
        try {
            this.view.setBloomOptions(getBloomQualityConfig(quality, this.Filament))
        } catch (e) {
            console.warn('[POST] Bloom setup failed:', e)
        }

        // SSAO — radius, resolution, and quality scale with the quality tier
        try {
            this.view.setAmbientOcclusionOptions(getSsaoQualityConfig(quality, this.Filament))
        } catch (e) {
            console.warn('[POST] SSAO setup failed:', e)
        }

        // MSAA is disabled when TAA is active to avoid stacking both techniques.
        try {
            this.view.setMultiSampleAntiAliasingOptions({ enabled: !taaEnabled, sampleCount: DEFAULT_MSAA_SAMPLE_COUNT })
        } catch (e) {
            console.warn('[POST] MSAA setup failed:', e)
        }

        // TAA - temporal anti-aliasing reduces edge shimmering during motion
        try {
            this.view.setTemporalAntiAliasingOptions({
                enabled: taaEnabled,
                // filterWidth: width of the temporal filter kernel; higher = softer but more stable
                filterWidth: 2.0,
                feedback: 0.85,
                jitterSpread: 0.75,
            })
        } catch (e) {
            console.warn('[POST] TAA setup failed:', e)
        }

        // Motion Blur - cinematic blur for fast-moving marbles and camera.
        // Some Filament JS builds do not expose this wrapper; skip cleanly.
        if (typeof this.view.setMotionBlurOptions === 'function') {
            try {
                this.view.setMotionBlurOptions({
                    enabled: motionBlurEnabled,
                    intensity: 0.32,
                    maxDisplacement: 0.18,
                })
            } catch (e) {
                console.warn('[POST] Motion Blur setup failed:', e)
            }
        }

        // SSR - screen-space reflections for shiny floor and ice surfaces
        try {
            this.view.setScreenSpaceReflectionsOptions({
                enabled: ssrEnabled,
                thickness: 0.1,
                bias: 0.01,
                maxDistance: 3.0,
                stride: 2.0,
            })
        } catch (e) {
            console.warn('[POST] SSR setup failed:', e)
        }

        // ACES tone mapping with per-tier contrast/saturation for a richer look on high-end hardware
        try {
            const cgConfig = getColorGradingConfig(quality)
            const colorGrading = this.Filament.ColorGrading.Builder()
                .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
                .contrast(cgConfig.contrast)
                .saturation(cgConfig.saturation)
                .build(this.engine)
            this.view.setColorGrading(colorGrading)
        } catch (e) {
            console.warn('[POST] Color grading setup failed:', e)
        }

        // Vignette — subtle filmic darkening on high/ultra; disabled on medium and low
        try {
            this.view.setVignetteOptions(getVignetteConfig(quality))
        } catch (e) {
            // setVignetteOptions may not be present in all Filament builds; silently skip
        }

        // Production shadow quality — gated behind high/ultra presets.
        // medium and below use basic PCF shadows (cheaper, still decent).
        const { shadowOptions, vsmOptions, softOptions } = getShadowQualityConfig(quality);
        if (this.view) {
            if (typeof this.view.setShadowOptions === 'function') {
                try {
                    this.view.setShadowOptions(shadowOptions);
                } catch (e) {
                    console.warn('[POST] setShadowOptions failed:', e);
                }
            }

            if (vsmOptions) {
                try {
                    this.view.setVsmShadowOptions(vsmOptions);
                } catch (e) {
                    console.warn('[POST] setVsmShadowOptions failed:', e);
                }
            }

            if (softOptions) {
                try {
                    this.view.setSoftShadowOptions(softOptions);
                } catch (e) {
                    console.warn('[POST] setSoftShadowOptions failed:', e);
                }
            }
        }

        // Fog — atmospheric depth haze with quality tiering and environment-specific tints
        // Disabled on low quality; medium/high/ultra use exponential fog with height falloff
        try {
            const fogConfig = getFogQualityConfig(quality);
            if (fogConfig.enabled) {
                // Start with quality-tier defaults
                const fogOptions = { ...fogConfig };

                // Merge environment-specific overrides (color, density, height falloff, etc)
                // Default environment is 'default'; will be overridden per-level in applyEnvironment()
                const envFogPreset = getEnvironmentFogPreset(this.currentEnvironment || 'default');
                Object.assign(fogOptions, envFogPreset);

                // Prevent negative heights or invalid configs
                if (fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                if (fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                this.view.setFogOptions(fogOptions);
                console.log(`[POST] Fog enabled: quality=${quality}, env=${this.currentEnvironment || 'default'}`);
            } else {
                this.view.setFogOptions({ enabled: false });
            }
        } catch (e) {
            console.warn('[POST] Fog setup failed:', e);
        }

        // Indirect Light (IBL) + Skybox — themed per-environment
        // Calls setupEnvironmentLighting() which builds from the named preset.
        // The initial environment is 'default'; levels override it via
        // applyEnvironment() called from loadLevel().
        this.setupEnvironmentLighting('default');
    }

    /**
     * Build and apply an IndirectLight + Skybox for the given environment.
     * Destroys any previously created IBL/Skybox objects first.
     *
     * For 'high' and 'ultra' quality, fires an async upgrade that replaces the
     * SH-only IBL with a full specular IBL backed by a KTX1 cubemap once the
     * asset has loaded.  The SH fallback remains active until then.
     *
     * @param {string} envName - Key from ENVIRONMENT_PRESETS (e.g. 'ice', 'volcanic')
     */
    setupEnvironmentLighting(envName = 'default') {
        const quality = this.settings?.graphics?.quality || 'medium';

        // Tear down existing IBL / skybox (including any previously loaded cubemap textures)
        if (this._iblObject || this._skyboxObject) {
            destroyEnvironmentWithCubemaps(
                this.engine, this.scene,
                this._iblObject, this._skyboxObject,
                this._iblTexture || null, this._skyboxTexture || null,
            );
            this._iblObject = null;
            this._skyboxObject = null;
            this._iblTexture = null;
            this._skyboxTexture = null;
        }

        const { ibl, skybox } = buildEnvironmentLighting(
            this.engine,
            this.scene,
            this.Filament,
            envName,
            quality,
        );

        // Keep references so we can destroy them on the next switch or cleanup
        this._iblObject = ibl;
        this._skyboxObject = skybox;
        this._iblTexture = null;
        this._skyboxTexture = null;
        this.currentEnvironment = envName;

        // Back-compat: keep this.ibl pointing at the active IBL object
        this.ibl = ibl;
        this.skyboxEntity = skybox;

        // For high/ultra quality, asynchronously upgrade to full specular IBL
        if (CUBEMAP_QUALITY_LEVELS.has(quality)) {
            this._upgradeEnvironmentWithCubemap(envName);
        }
    }

    /**
     * Apply fog effects for the given environment name.
     * Merges environment-specific fog preset with quality-tier fog config.
     * Called automatically by applyEnvironment() when switching zones.
     *
     * @param {string} envName - Environment preset name (e.g. 'default', 'space_nebula', 'underwater')
     */
    applyEnvironmentFog(envName = 'default') {
        if (!this.view) return;

        const quality = this.settings?.graphics?.quality || 'medium';

        try {
            const fogConfig = getFogQualityConfig(quality);
            if (fogConfig.enabled) {
                // Start with quality-tier defaults
                const fogOptions = { ...fogConfig };

                // Merge environment-specific overrides
                const envFogPreset = getEnvironmentFogPreset(envName);
                Object.assign(fogOptions, envFogPreset);

                // Validate fog config
                if (fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                if (fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                this.view.setFogOptions(fogOptions);
                console.log(`[FOG] Applied: quality=${quality}, env=${envName}`);
            } else {
                this.view.setFogOptions({ enabled: false });
            }
        } catch (e) {
            console.warn('[FOG] Failed to apply environment fog:', e);
        }
    }

    /**
     * Apply per-environment color grading to the view.
     * Merges the quality-tier base config from getColorGradingConfig() with
     * environment-specific overrides from getEnvironmentColorGradingPreset(),
     * then rebuilds and sets a new Filament ColorGrading object.
     *
     * Called automatically by applyEnvironment() and optionally overridden
     * by the level's `colorGrade` field in loadLevel().
     *
     * @param {string} envName - Environment/color-grade preset key
     */
    applyColorGradingForEnvironment(envName = 'default') {
        if (!this.view || !this.Filament || !this.engine) return;

        try {
            const quality = this.settings?.graphics?.quality || this.graphicsQuality || 'medium';
            const baseConfig = getColorGradingConfig(quality);
            const envConfig = getEnvironmentColorGradingPreset(envName);

            // Env-specific values fully replace their quality-tier counterparts
            const merged = { ...baseConfig, ...envConfig };

            const builder = this.Filament.ColorGrading.Builder()
                .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
                .contrast(merged.contrast)
                .saturation(merged.saturation);

            // vibrance: protects already-saturated hues; safe try-catch in case
            // the Filament WASM build doesn't expose this method.
            if (merged.vibrance != null) {
                try { builder.vibrance(merged.vibrance); } catch (_) { /* unsupported */ }
            }

            const colorGrading = builder.build(this.engine);
            this.view.setColorGrading(colorGrading);

            console.log(`[GRADE] Applied: env=${envName}, contrast=${merged.contrast.toFixed(2)}, sat=${merged.saturation.toFixed(2)}`);
        } catch (e) {
            console.warn('[GRADE] Color grading update failed:', e);
        }
    }

    /**
     * Async helper: load KTX1 cubemaps and upgrade the current SH-only
     * environment to full specular IBL.  Guards against stale upgrades if the
     * environment was changed before the fetch completed.
     *
     * @param {string} envName
     */
    async _upgradeEnvironmentWithCubemap(envName) {
        const result = await upgradeEnvironmentWithCubemap(
            this.engine,
            this.scene,
            this.Filament,
            envName,
            this._iblObject,
            this._skyboxObject,
        );

        // Guard: environment may have changed while we were awaiting
        if (!result || this.currentEnvironment !== envName) {
            return;
        }

        this._iblObject = result.ibl;
        this._skyboxObject = result.skybox;
        this._iblTexture = result.iblTexture;
        this._skyboxTexture = result.skyboxTexture;

        // Keep back-compat references current
        this.ibl = result.ibl;
        this.skyboxEntity = result.skybox;
    }

    /**
     * Switch to a different environment at runtime (e.g. when a level loads).
     * Safe to call before Filament is fully initialised – does nothing in that case.
     *
     * @param {string} envName - Key from ENVIRONMENT_PRESETS
     */
    applyEnvironment(envName = 'default') {
        if (!this.engine || !this.scene || !this.Filament) {
            return;
        }
        if (envName === this.currentEnvironment) {
            return;
        }
        this.setupEnvironmentLighting(envName);

        // Apply environment-specific directional and fill lights
        if (this.lightingSystem) {
            try {
                const envPreset = ENVIRONMENT_PRESETS[envName] || ENVIRONMENT_PRESETS['default'];
                this.lightingSystem.applyEnvironmentLighting(envName, envPreset);
            } catch (e) {
                console.warn('[LightingSystem] Failed to apply environment lighting:', e);
            }
        }

        // Apply environment-specific fog after switching environment
        this.applyEnvironmentFog(envName);

        // Apply environment-specific color grading (contrast, saturation, vibrance)
        this.applyColorGradingForEnvironment(envName);
    }

    /**
     * Create an Abyssal Trench zone — a deep underwater environment with
     * bioluminescent features and murky depth fog.
     *
     * Creates a descending trench with:
     * - Curved walls with bioluminescent organisms
     * - Sandy floor with glowing coral
     * - Dense underwater fog with teal tint
     *
     * @param {object} offset - Base position offset
     */
}

export function applyZoneSetupEnvironment(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupEnvironment.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupEnvironment.prototype[name];
        }
    }
}
