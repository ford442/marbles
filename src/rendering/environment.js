/**
 * Environment Lighting System
 *
 * Provides themed IBL (Image-Based Lighting) environments built from
 * hand-tuned 3-band spherical harmonics coefficients plus matching skybox
 * colours.  Each preset is physically plausible and tuned to complement the
 * marble material presets defined in material-presets.js.
 *
 * When KTX cubemap assets are added to assets/environments/ the
 * `reflections` field can be populated with the loaded Filament Texture and
 * passed to IndirectLight.Builder().reflections() to upgrade from SH-only to
 * full specular IBL.
 *
 * Environments
 * ------------
 *  default       – blue-sky studio (original hand-authored SH)
 *  space_nebula  – deep-space nebula, purple/blue tones, strong overhead rim
 *  ice           – arctic glacier, crisp blue-white, cold bounce light
 *  volcanic      – active volcano, warm amber/red, hot underside glow
 *  neon_city     – cyberpunk cityscape, vivid cyan/magenta accent lights
 */

// ---------------------------------------------------------------------------
// Environment Presets
// ---------------------------------------------------------------------------

/**
 * Each SH array contains 9 RGB triplets (27 floats) describing the irradiance
 * as 3-band (order-2) spherical harmonics in the order:
 *   L00, L1-1, L10, L11, L2-2, L2-1, L20, L21, L22
 * Units are linear luminance (pre-multiplied into the intensity field).
 *
 * skyboxColor  – RGBA background colour shown behind geometry.
 * iblIntensity – overall scale applied to the indirect light (lux equivalent).
 * sunColor     – directional light tint override for this environment.
 * sunIntensity – directional light strength override.
 */
export const ENVIRONMENT_PRESETS = {
    // ---- default: warm blue studio sky with amber ground bounce ------------
    default: {
        label: 'Blue Sky Studio',
        sh: new Float32Array([
            // L00 – DC term: blue-white sky brightness
             1.10,  1.12,  1.28,
            // L1-1 – warm floor/ground bounce (amber-orange)
             0.18,  0.14,  0.06,
            // L10  – Y+ blue sky contribution from above
            -0.22, -0.20, -0.35,
            // L11  – X-axis side fill
             0.06,  0.06,  0.07,
            // L2-2 – horizontal diagonal
             0.02,  0.02,  0.02,
            // L2-1 – front-bottom
             0.04,  0.03,  0.01,
            // L20  – vertical
            -0.02, -0.02, -0.03,
            // L21  – front-top
             0.03,  0.03,  0.02,
            // L22  – horizontal diagonal 2
             0.01,  0.01,  0.01,
        ]),
        iblIntensity: 40000.0,
        skyboxColor: [0.06, 0.08, 0.16, 1.0],
        sunColor: [1.0, 0.96, 0.88],
        sunIntensity: 150000.0,
        fillColor: [0.65, 0.78, 1.0],
        fillIntensity: 45000.0,
    },

    // ---- space_nebula: purple/blue deep-space with vivid nebula glow ------
    space_nebula: {
        label: 'Space Nebula',
        sh: new Float32Array([
            // L00 – cool dark ambient with a hint of deep purple
             0.15,  0.10,  0.35,
            // L1-1 – subtle violet floor scatter
             0.04,  0.02,  0.08,
            // L10  – blue star-field overhead
            -0.08, -0.06, -0.18,
            // L11  – cyan nebula rim from the left
             0.06,  0.04,  0.12,
            // L2-2 – diagonal nebula wisps
             0.02,  0.01,  0.04,
            // L2-1 – faint forward nebula glow
             0.03,  0.02,  0.06,
            // L20  – vertical gradient (space has no floor)
            -0.01, -0.01, -0.02,
            // L21  – forward-top star cluster brightening
             0.02,  0.01,  0.04,
            // L22  – subtle side asymmetry
             0.01,  0.01,  0.02,
        ]),
        iblIntensity: 20000.0,
        skyboxColor: [0.01, 0.01, 0.06, 1.0],
        sunColor: [0.5, 0.4, 0.9],
        sunIntensity: 60000.0,
        fillColor: [0.2, 0.1, 0.6],
        fillIntensity: 15000.0,
    },

    // ---- ice: arctic glacier, crisp cold blues, high reflectance ----------
    ice: {
        label: 'Arctic Glacier',
        sh: new Float32Array([
            // L00 – bright cold white-blue ambience
             0.90,  0.95,  1.20,
            // L1-1 – icy blue floor bounce
             0.10,  0.12,  0.20,
            // L10  – blue-sky overhead (colder than default)
            -0.18, -0.18, -0.30,
            // L11  – crisp side fill
             0.06,  0.07,  0.10,
            // L2-2 – glacial horizontal detail
             0.02,  0.02,  0.03,
            // L2-1 – faint blue-green crevasse glow
             0.02,  0.03,  0.04,
            // L20  – downward cool bounce
            -0.03, -0.03, -0.05,
            // L21  – top-front sky
             0.04,  0.04,  0.06,
            // L22  – diagonal ice shimmer
             0.01,  0.01,  0.02,
        ]),
        iblIntensity: 55000.0,
        skyboxColor: [0.05, 0.10, 0.22, 1.0],
        sunColor: [0.85, 0.92, 1.0],
        sunIntensity: 180000.0,
        fillColor: [0.6, 0.78, 1.0],
        fillIntensity: 60000.0,
    },

    // ---- volcanic: hot lava glow, warm amber underside, smoky sky ---------
    volcanic: {
        label: 'Volcanic',
        sh: new Float32Array([
            // L00 – dark smoky ambient with orange tint
             0.40,  0.22,  0.10,
            // L1-1 – hot magma floor bounce (strong orange-red)
             0.35,  0.18,  0.04,
            // L10  – smoky dark sky (muted, slightly brown)
            -0.06, -0.04, -0.02,
            // L11  – warm side rim from lava walls
             0.08,  0.05,  0.01,
            // L2-2 – radial heat shimmer
             0.04,  0.02,  0.01,
            // L2-1 – forward ember glow
             0.06,  0.03,  0.01,
            // L20  – vertical gradient, hot below cool above
            -0.04, -0.02, -0.01,
            // L21  – forward-upward smoke diffusion
             0.02,  0.01,  0.00,
            // L22  – diagonal heat
             0.02,  0.01,  0.00,
        ]),
        iblIntensity: 35000.0,
        skyboxColor: [0.08, 0.03, 0.01, 1.0],
        sunColor: [1.0, 0.55, 0.15],
        sunIntensity: 120000.0,
        fillColor: [0.8, 0.3, 0.05],
        fillIntensity: 30000.0,
    },

    // ---- neon_city: cyberpunk cityscape, vivid cyan/magenta lights --------
    neon_city: {
        label: 'Neon City',
        sh: new Float32Array([
            // L00 – dark but vivid neon ambient (teal tint)
             0.12,  0.08,  0.20,
            // L1-1 – magenta street-level bounce
             0.08,  0.02,  0.10,
            // L10  – dark sky (mostly blocked by buildings)
            -0.04, -0.02, -0.06,
            // L11  – cyan sign spill from the right
             0.06,  0.08,  0.12,
            // L2-2 – grid-like neon cross-spill
             0.03,  0.01,  0.05,
            // L2-1 – forward signage glow
             0.05,  0.02,  0.08,
            // L20  – vertical (city lights mostly horizontal)
            -0.01, -0.01, -0.02,
            // L21  – upward sign bounce
             0.02,  0.01,  0.03,
            // L22  – diagonal neon flash
             0.02,  0.01,  0.04,
        ]),
        iblIntensity: 25000.0,
        skyboxColor: [0.02, 0.01, 0.05, 1.0],
        sunColor: [0.0, 0.9, 1.0],
        sunIntensity: 40000.0,
        fillColor: [0.9, 0.0, 0.6],
        fillIntensity: 20000.0,
    },
};

// ---------------------------------------------------------------------------
// Zone → Environment mapping
// ---------------------------------------------------------------------------

/**
 * Maps zone types (as defined in levels.js) to environment preset keys.
 * Zone files or levels can override this with an explicit `environment` field.
 */
export const ZONE_ENVIRONMENT_MAP = {
    ice_cave:        'ice',
    ice_bridges:     'ice',
    glacial_chasm:   'ice',
    frostbite_cavern:'ice',
    cyber_ice_track: 'ice',
    volcano_zone:    'volcanic',
    lava_tubes:      'volcanic',
    radiant_reactor: 'volcanic',
    space_station:   'space_nebula',
    starlight_ascent:'space_nebula',
    galaxy_spiral:   'space_nebula',
    nebula_nexus:    'space_nebula',
    quantum_tunnel:  'space_nebula',
    antigravity:     'space_nebula',
    neon_alley:      'neon_city',
    neon_grid:       'neon_city',
    neon_pulse_grid: 'neon_city',
    synthwave_surge: 'neon_city',
    plasma_pipeline: 'neon_city',
    cyber_track:     'neon_city',
};

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Build and apply an IndirectLight + Skybox from the named environment preset.
 *
 * @param {object} engine      - Filament Engine instance
 * @param {object} scene       - Filament Scene instance
 * @param {object} Filament    - Filament module namespace
 * @param {string} envName     - Key from ENVIRONMENT_PRESETS (defaults to 'default')
 * @param {string} quality     - 'low' | 'medium' | 'high' | 'ultra'
 * @returns {{ ibl: object, skybox: object }} Filament objects (caller must track for cleanup)
 */
export function buildEnvironmentLighting(engine, scene, Filament, envName = 'default', quality = 'medium') {
    const preset = ENVIRONMENT_PRESETS[envName] || ENVIRONMENT_PRESETS.default;
    let ibl = null;
    let skybox = null;

    // Build IndirectLight (irradiance via SH; reflections require a loaded cubemap)
    try {
        const builder = Filament.IndirectLight.Builder()
            .irradianceSh(3, preset.sh)
            .intensity(preset.iblIntensity);

        ibl = builder.build(engine);
        scene.setIndirectLight(ibl);
    } catch (e) {
        console.warn(`[ENV] IndirectLight build failed for "${envName}":`, e);
        // 1-band fallback – always succeeds
        try {
            const fallbackSh = new Float32Array([
                preset.sh[0], preset.sh[1], preset.sh[2],
            ]);
            ibl = Filament.IndirectLight.Builder()
                .irradianceSh(1, fallbackSh)
                .intensity(preset.iblIntensity * 0.75)
                .build(engine);
            scene.setIndirectLight(ibl);
        } catch (e2) {
            console.warn('[ENV] IndirectLight fallback also failed:', e2);
        }
    }

    // Build Skybox (colour-based; replace with .environment(cubemap) when KTX assets are available)
    try {
        skybox = Filament.Skybox.Builder()
            .color(preset.skyboxColor)
            .build(engine);
        scene.setSkybox(skybox);
    } catch (e) {
        console.warn(`[ENV] Skybox build failed for "${envName}":`, e);
    }

    return { ibl, skybox };
}

/**
 * Destroy previously created IBL and skybox objects, clearing the scene slots.
 * Safe to call with null values.
 *
 * @param {object} engine
 * @param {object} scene
 * @param {object|null} ibl     - IndirectLight to destroy
 * @param {object|null} skybox  - Skybox to destroy
 */
export function destroyEnvironmentLighting(engine, scene, ibl, skybox) {
    try {
        if (skybox) {
            scene.setSkybox(null);
            engine.destroySkybox(skybox);
        }
    } catch (e) {
        console.warn('[ENV] Skybox destroy failed:', e);
    }
    try {
        if (ibl) {
            scene.setIndirectLight(null);
            engine.destroyIndirectLight(ibl);
        }
    } catch (e) {
        console.warn('[ENV] IndirectLight destroy failed:', e);
    }
}

/**
 * Resolve which environment preset to use for a given level config.
 * Priority: explicit level.environment > nightMode heuristic > 'default'
 *
 * @param {object} levelConfig  - Entry from LEVELS
 * @returns {string} Environment preset key
 */
export function resolveEnvironmentForLevel(levelConfig) {
    if (levelConfig.environment) {
        return levelConfig.environment;
    }
    // Legacy nightMode levels without an explicit environment key map to
    // space_nebula which matches the existing deep-space blue background.
    if (levelConfig.nightMode) {
        return 'space_nebula';
    }
    return 'default';
}
