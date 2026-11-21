/* eslint-disable */
/**
 * GENERATED from assets/schemas/map-schema.json by scripts/gen-schema-types.mjs.
 * Do not edit: change the schema and run `npm run gen:schema-types`.
 */

/**
 * Schema for marble game levels/maps. One rule set, compiled with ajv by scripts/validate-assets.cjs (CI), src/editor/map-validator.ts (editor + workshop import) and backend/storage/services/map_validation.py (workshop publish). zone.type strings must be registered in src/zone-setup/registry.js (see assets/schemas/zone-handlers.json). schemaVersion 2 adds data-driven primitives (box, ramp, mover, spinner, trigger), [x,y,z] vectors, a goal volume, rivals and bounds.
 */
export type MapSchema = {
    [k: string]: unknown | undefined;
} & {
    /**
     * Level format version. Omit for 1; 2 enables primitives and [x,y,z] vectors.
     */
    schemaVersion?: 1 | 2;
    /**
     * Unique identifier for the map
     */
    id: string;
    /**
     * Display name for the map
     */
    name: string;
    /**
     * Brief description of the map
     */
    description?: string;
    /**
     * Semantic version of the map
     */
    version: string;
    /**
     * Author name or identifier
     */
    author?: string;
    /**
     * Difficulty level
     */
    difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
    /**
     * Campaign chapter override
     */
    chapter?: 'tutorial' | 'classic' | 'neon' | 'extreme' | 'expert';
    /**
     * Enable night lighting preset
     */
    nightMode?: boolean;
    /**
     * RGBA clear color [r, g, b, a]
     *
     * @minItems 4
     * @maxItems 4
     */
    backgroundColor?: [number, number, number, number];
    /**
     * Environment preset key (see src/rendering/environment.js)
     */
    environment?: 'default' | 'space_nebula' | 'ice' | 'volcanic' | 'neon_city' | 'underwater';
    /**
     * Optional color grading preset override
     */
    colorGrade?: string;
    /**
     * Named per-level behavior module ids (src/game/level-behaviors/)
     */
    behaviors?: string[];
    /**
     * Checkpoint definitions for respawn progression
     */
    checkpoints?: {
        id?: number;
        pos?: {
            x: number;
            y: number;
            z: number;
            [k: string]: unknown | undefined;
        };
        range?: {
            /**
             * @minItems 2
             * @maxItems 2
             */
            x?: [number, number];
            /**
             * @minItems 2
             * @maxItems 2
             */
            y?: [number, number];
            /**
             * @minItems 2
             * @maxItems 2
             */
            z?: [number, number];
            [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
    }[];
    /**
     * List of zones/areas in the map
     */
    zones: Zone[];
    spawn: Vec3;
    goals?: {
        id: number;
        range: {
            /**
             * @minItems 2
             * @maxItems 2
             */
            x: [number, number];
            /**
             * @minItems 2
             * @maxItems 2
             */
            y: [number, number];
            /**
             * @minItems 2
             * @maxItems 2
             */
            z: [number, number];
            [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
    }[];
    camera?: {
        mode?: 'orbit' | 'follow' | 'action' | 'fpv' | 'topdown' | 'cinematic' | 'side-scroller' | 'drone';
        angle?: number;
        height?: number;
        radius?: number;
        offset?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * Per-level ability subset, by registry id (src/abilities/registry.js, e.g. "jump", "bomb", "magnet_attract", "grapple"). Omit to allow every registered ability. When both lists are present `enabled` wins; abilities implied by an enabled one (double jump by jump) follow it unless `disabled` names them.
     */
    abilities?: {
        /**
         * Whitelist of ability ids (e.g. tutorial uses ["jump"]); every other ability is disabled
         */
        enabled?: string[];
        /**
         * Blacklist of ability ids
         */
        disabled?: string[];
    };
    /**
     * Time thresholds (seconds) for gold/silver/bronze medals and par display
     */
    medals?: {
        /**
         * Finish at or below for gold
         */
        goldTime?: number;
        /**
         * Finish at or below for silver
         */
        silverTime?: number;
        /**
         * Finish at or below for bronze
         */
        bronzeTime?: number;
        /**
         * Designer par time for HUD/reference
         */
        parTime?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * Total collectible pickups in the level (for completion %)
     */
    collectiblesTotal?: number;
    /**
     * Optional music track id (future audio pipeline)
     */
    music?: string;
    /**
     * Optional ambient sound ids
     */
    ambientSounds?: string[];
    /**
     * v2 goal volume (centre + full size); converted to goals[] at load.
     */
    goal?: {
        pos: Vec3;
        size: PositiveVec3;
    };
    /**
     * Marble ids raced against (default roster when omitted). The level spawns 1 + rivals.length marbles.
     *
     * @maxItems 6
     */
    rivals?: string[];
    /**
     * Declared play volume. The level harness fails when a zone body extends past it.
     */
    bounds?: {
        min: Vec3;
        max: Vec3;
    };
    /**
     * Free-roam map with no finish (e.g. sandbox). Exempts it from the goal checks in tests/levels/.
     */
    goalless?: boolean;
    /**
     * Scripted completion for the headless level harness (tests/levels/).
     */
    solution?: {
        /**
         * Held-input segments replayed at the fixed step.
         */
        inputs: {
            frames: number;
            keys?: ('forward' | 'back' | 'left' | 'right' | 'jump')[];
            yawDeg?: number;
            /**
             * Jump charge for a segment with "jump" (0 = JUMP_DV_MIN, 1 = JUMP_DV_MAX; default 1)
             */
            jumpCharge?: number;
        }[];
        /**
         * Allowed relative deviation from medals.parTime (default 0.5).
         */
        tolerance?: number;
    };
    [k: string]: unknown | undefined;
};
/**
 * A map zone: a v2 primitive (by `type`) or a registered stamp zone.
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "zone".
 */
export type Zone = BoxZone | RampZone | MoverZone | SpinnerZone | TriggerZone | StampZone;
/**
 * @minItems 3
 * @maxItems 3
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "color".
 */
export type Color = [number, number, number];
/**
 * [x, y, z] (v2) or {x, y, z}
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "vec3".
 */
export type Vec3 =
    | [number, number, number]
    | {
          x: number;
          y: number;
          z: number;
          [k: string]: unknown | undefined;
      };
/**
 * Full extents, each > 0
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "positiveVec3".
 */
export type PositiveVec3 =
    | [number, number, number]
    | {
          x: number;
          y: number;
          z: number;
          [k: string]: unknown | undefined;
      };

/**
 * Static box (size = full extents)
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "boxZone".
 */
export interface BoxZone {
    type: 'box';
    color?: Color;
    /**
     * Surface preset (render + default friction)
     */
    material?:
        | 'obsidian'
        | 'ice'
        | 'neon_ice'
        | 'rubber'
        | 'sand'
        | 'volcanicRock'
        | 'crystal'
        | 'wood'
        | 'metal'
        | 'concrete'
        | 'glass'
        | 'stone'
        | 'lava'
        | 'volcanic'
        | 'dirt'
        | 'rock'
        | 'steel'
        | 'tile'
        | 'carpet'
        | 'grass';
    friction?: number;
    restitution?: number;
    pos: Vec3;
    size: PositiveVec3;
    rot?: Rotation;
}
/**
 * Named-axis rotation in degrees (applied yaw → pitch → roll). Positive pitch lowers the +Z end.
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "rotation".
 */
export interface Rotation {
    yawDeg?: number;
    pitchDeg?: number;
    rollDeg?: number;
}
/**
 * Static ramp whose top surface runs from `from` to `to`
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "rampZone".
 */
export interface RampZone {
    type: 'ramp';
    color?: Color;
    /**
     * Surface preset (render + default friction)
     */
    material?:
        | 'obsidian'
        | 'ice'
        | 'neon_ice'
        | 'rubber'
        | 'sand'
        | 'volcanicRock'
        | 'crystal'
        | 'wood'
        | 'metal'
        | 'concrete'
        | 'glass'
        | 'stone'
        | 'lava'
        | 'volcanic'
        | 'dirt'
        | 'rock'
        | 'steel'
        | 'tile'
        | 'carpet'
        | 'grass';
    friction?: number;
    restitution?: number;
    from: Vec3;
    to: Vec3;
    width: number;
    thickness?: number;
}
/**
 * Kinematic box moving along a path
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "moverZone".
 */
export interface MoverZone {
    type: 'mover';
    color?: Color;
    /**
     * Surface preset (render + default friction)
     */
    material?:
        | 'obsidian'
        | 'ice'
        | 'neon_ice'
        | 'rubber'
        | 'sand'
        | 'volcanicRock'
        | 'crystal'
        | 'wood'
        | 'metal'
        | 'concrete'
        | 'glass'
        | 'stone'
        | 'lava'
        | 'volcanic'
        | 'dirt'
        | 'rock'
        | 'steel'
        | 'tile'
        | 'carpet'
        | 'grass';
    friction?: number;
    restitution?: number;
    shape?: 'box';
    size: PositiveVec3;
    /**
     * @minItems 2
     */
    path: [Vec3, Vec3, ...Vec3[]];
    /**
     * Seconds per full cycle
     */
    period: number;
    ease?: 'linear' | 'sine';
    /**
     * Loop back to the first point instead of ping-ponging
     */
    loop?: boolean;
    phase?: number;
    rot?: Rotation;
}
/**
 * Kinematic box spinning about one of its axes
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "spinnerZone".
 */
export interface SpinnerZone {
    type: 'spinner';
    color?: Color;
    /**
     * Surface preset (render + default friction)
     */
    material?:
        | 'obsidian'
        | 'ice'
        | 'neon_ice'
        | 'rubber'
        | 'sand'
        | 'volcanicRock'
        | 'crystal'
        | 'wood'
        | 'metal'
        | 'concrete'
        | 'glass'
        | 'stone'
        | 'lava'
        | 'volcanic'
        | 'dirt'
        | 'rock'
        | 'steel'
        | 'tile'
        | 'carpet'
        | 'grass';
    friction?: number;
    restitution?: number;
    pos: Vec3;
    size: PositiveVec3;
    axis: 'x' | 'y' | 'z';
    rpm: number;
    phaseDeg?: number;
    rot?: Rotation;
}
/**
 * Volume that acts on marbles (boost = Δv in m/s)
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "triggerZone".
 */
export interface TriggerZone {
    type: 'trigger';
    pos: Vec3;
    size: PositiveVec3;
    rot?: Rotation;
    on?: 'enter' | 'stay';
    color?: Color;
    do: {
        boost?: Vec3;
        setVelocity?: Vec3;
        respawn?: true;
    };
}
/**
 * Prebuilt zone stamp (any registered non-primitive type)
 *
 * This interface was referenced by map-schema.json
 * via the `definition` "stampZone".
 */
export interface StampZone {
    /**
     * Registered zone handler id (see zone-setup/registry.js ZONE_HANDLERS)
     */
    type: string;
    pos: Vec3;
    size?: Vec3;
    /**
     * @minItems 3
     * @maxItems 3
     */
    color?: [number, number, number];
    /**
     * Y-axis rotation in radians (optional)
     */
    rotY?: number;
    friction?: number;
    restitution?: number;
    slope?: number;
    boostForce?: number;
    /**
     * GLB/GLTF path relative to assets/ (e.g. tracks/neon_01.glb)
     */
    model?: string;
    /**
     * Rapier collider type for imported mesh (default: trimesh)
     */
    collider?: 'trimesh' | 'convexHull' | 'none';
    /**
     * Uniform scale applied to model and collider
     */
    scale?: number;
    /**
     * Optional PBR preset override (keeps embedded textures when omitted)
     */
    materialPreset?: string;
    /**
     * Distance-switched LOD models (furthest listed LOD swaps in at distance)
     */
    lod?: {
        model: string;
        distance: number;
        [k: string]: unknown | undefined;
    }[];
    /**
     * Moving platform parameters (declarative stamp)
     */
    kinematic?: {
        axis?: 'horizontal' | 'vertical' | 'circular';
        amplitude?: number;
        speed?: number;
        phase?: number;
        [k: string]: unknown | undefined;
    };
    collectible?: {
        kind?: string;
        value?: number;
        [k: string]: unknown | undefined;
    };
    grappleAnchor?: {
        id?: string;
        radius?: number;
        [k: string]: unknown | undefined;
    };
    /**
     * Checkpoint id when type is checkpoint
     */
    checkpoint?: number;
    /**
     * Convolution reverb applied while the listener is within `radius` of this zone's pos
     */
    reverb?: {
        /**
         * Reverb tail length in seconds
         */
        decay: number;
        /**
         * Wet-signal gain, 0 = dry, 1 = fully wet
         */
        wetMix: number;
        /**
         * Silence before the tail starts, in seconds
         */
        preDelay?: number;
        /**
         * Trigger radius around pos (default 20)
         */
        radius?: number;
        [k: string]: unknown | undefined;
    };
    [k: string]: unknown | undefined;
}
