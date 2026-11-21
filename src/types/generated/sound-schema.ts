/* eslint-disable */
/**
 * GENERATED from assets/schemas/sound-schema.json by scripts/gen-schema-types.mjs.
 * Do not edit: change the schema and run `npm run gen:schema-types`.
 */

/**
 * Schema for defining custom sounds
 */
export interface SoundSchema {
    /**
     * Unique identifier for the sound
     */
    id: string;
    /**
     * Display name for the sound
     */
    name: string;
    /**
     * Brief description
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
     * Sound category
     */
    category?: 'sfx' | 'music' | 'ambient' | 'ui';
    /**
     * Audio file variants (for randomization)
     */
    files: {
        /**
         * Path to audio file
         */
        path: string;
        /**
         * Selection weight for randomization
         */
        weight?: number;
        [k: string]: unknown | undefined;
    }[];
    /**
     * Playback properties
     */
    properties?: {
        volume?: number;
        pitchMin?: number;
        pitchMax?: number;
        loop?: boolean;
        /**
         * 3D positional audio
         */
        spatial?: boolean;
        /**
         * Max distance for spatial audio
         */
        maxDistance?: number;
        /**
         * Fade in duration in seconds
         */
        fadeIn?: number;
        /**
         * Fade out duration in seconds
         */
        fadeOut?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * When this sound plays (for SFX)
     */
    trigger?: {
        event?: 'collision' | 'roll' | 'jump' | 'land' | 'goal' | 'button_click' | 'custom';
        /**
         * Minimum velocity/impact for collision sounds
         */
        threshold?: number;
        /**
         * Minimum seconds between plays
         */
        cooldown?: number;
        [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
}
