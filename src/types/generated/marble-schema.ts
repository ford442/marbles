/* eslint-disable */
/**
 * GENERATED from assets/schemas/marble-schema.json by scripts/gen-schema-types.mjs.
 * Do not edit: change the schema and run `npm run gen:schema-types`.
 */

/**
 * Schema for defining custom marbles
 */
export interface MarbleSchema {
    /**
     * Unique identifier for the marble
     */
    id: string;
    /**
     * Display name for the marble
     */
    name: string;
    /**
     * Brief description of the marble
     */
    description?: string;
    /**
     * Semantic version
     */
    version: string;
    /**
     * Author name or identifier
     */
    author?: string;
    /**
     * Rarity classification
     */
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    /**
     * Premium marble: never free; selectable only once granted (its id is in the player's unlockedMarbles). Implies unlock "premium".
     */
    premium?: boolean;
    /**
     * How the marble becomes selectable: default (from the start), campaign (granted by a campaign milestone), premium (granted only). Defaults to premium when premium is true, else default.
     */
    unlock?: 'default' | 'campaign' | 'premium';
    /**
     * Visual appearance properties
     */
    appearance: {
        color: {
            r: number;
            g: number;
            b: number;
            [k: string]: unknown | undefined;
        };
        /**
         * Surface roughness (0=smooth, 1=rough)
         */
        roughness?: number;
        /**
         * Metallic factor
         */
        metallic?: number;
        emissive?: {
            r?: number;
            g?: number;
            b?: number;
            /**
             * Multiplier: point-light intensity = intensity × 10000 (src/marbles/catalog-format.js EMISSIVE_LIGHT_SCALE)
             */
            intensity?: number;
            [k: string]: unknown | undefined;
        };
        /**
         * Path to texture image (optional)
         */
        texture?: string;
        /**
         * Particle effect identifier (optional)
         */
        particleEffect?: string;
        reflectance?: number;
        clearCoat?: number;
        clearCoatRoughness?: number;
        /**
         * Glass thickness (refraction)
         */
        thickness?: number;
        /**
         * Material preset name (src/marble-material-tier.js)
         */
        materialType?: string;
        geometry?: 'sphere' | 'cube';
        /**
         * Cycle hue over time
         */
        rainbow?: boolean;
        /**
         * Per-marble procedural shader parameters (catalog-format.js SHADER_FIELDS)
         */
        shader?: {
            bumpScale?: number;
            bumpFrequency?: number;
            grainScale?: number;
            scratchesIntensity?: number;
            anisotropy?: number;
            heatIntensity?: number;
            crackGlow?: number;
            iridescenceScale?: number;
            sparkleDensity?: number;
            fresnelStrength?: number;
            chromaticDispersion?: number;
            [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
    };
    /**
     * Physical properties
     */
    physics: {
        /**
         * Marble radius in meters
         */
        radius?: number;
        /**
         * Material density (affects mass)
         */
        density?: number;
        /**
         * Surface friction (above 1 = sticky)
         */
        friction?: number;
        /**
         * Bounciness. Must be <= 1.0 unless the marble is listed in assets/marbles/_bouncy-cap.json (hard max 1.5).
         */
        restitution?: number;
        /**
         * Linear velocity damping
         */
        linearDamping?: number;
        /**
         * Angular velocity damping
         */
        angularDamping?: number;
        /**
         * Gravity multiplier (negative floats upward)
         */
        gravityScale?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * Custom audio properties
     */
    audio?: {
        /**
         * Custom rolling sound identifier
         */
        rollSound?: string;
        /**
         * Custom collision sound identifier
         */
        collisionSound?: string;
        /**
         * Random pitch variation amount
         */
        pitchVariation?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * Special abilities (optional)
     */
    abilities?: {
        doubleJump?: boolean;
        magnetic?: boolean;
        ghostMode?: boolean;
        speedBoost?: number;
        [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
}
