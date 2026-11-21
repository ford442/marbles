/**
 * Map format types.
 *
 * The authored JSON shape is generated from `assets/schemas/map-schema.json`
 * (`./generated/map-schema.ts`, `npm run gen:schema-types`) — the same rule
 * set ajv enforces in CI, the editor and the workshop backend. This module
 * names the parts the game uses and adds the normalized runtime level shape;
 * it does not re-declare any authored field.
 */
import type {
    BoxZone,
    Color,
    MapSchema,
    MoverZone,
    PositiveVec3,
    RampZone,
    Rotation,
    SpinnerZone,
    StampZone,
    TriggerZone,
    Vec3,
    Zone,
} from './generated/map-schema.ts';

export type {
    BoxZone, MoverZone, RampZone, SpinnerZone, StampZone, TriggerZone,
} from './generated/map-schema.ts';

/** `T` without its string/number index signature (keeps only declared keys). */
export type KnownKeys<T> = {
    [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/** Declared (non-extension) fields of an authored map. */
type AuthoredMap = KnownKeys<MapSchema>;

/**
 * Object-form vector (what the runtime normalizes every map vector to). A type
 * alias, not an interface, so it stays assignable to the schema's open
 * `{x, y, z, [k: string]: unknown}` vector branch.
 */
export type MapVec3 = {
    x: number;
    y: number;
    z: number;
};

/** v2 vectors may be written as [x, y, z]. */
export type MapVec3Input = Vec3;
export type MapPositiveVec3Input = PositiveVec3;

export type Difficulty = NonNullable<AuthoredMap['difficulty']>;
export type CampaignChapter = NonNullable<AuthoredMap['chapter']>;
export type EnvironmentPreset = NonNullable<AuthoredMap['environment']>;
export type MapCameraDefinition = NonNullable<AuthoredMap['camera']>;
export type CameraMode = NonNullable<MapCameraDefinition['mode']>;
export type AbilityMask = NonNullable<AuthoredMap['abilities']>;
export type MedalThresholds = NonNullable<AuthoredMap['medals']>;
export type MapCheckpointDefinition = NonNullable<AuthoredMap['checkpoints']>[number];
export type MapGoalDefinition = NonNullable<AuthoredMap['goals']>[number];
export type MapGoalVolume = NonNullable<AuthoredMap['goal']>;
export type MapBounds = NonNullable<AuthoredMap['bounds']>;
export type MapSolution = NonNullable<AuthoredMap['solution']>;
export type MapSolutionSegment = MapSolution['inputs'][number];
export type MapRotation = Rotation;

export type Range2 = [number, number];
export type RgbColor = Color;
export type RgbaColor = NonNullable<AuthoredMap['backgroundColor']>;
export type AxisRange = MapGoalDefinition['range'];

/** One authored zone: a closed v2 primitive (by `type`) or an open stamp zone. */
export type MapZoneDefinition = Zone;
export type PrimitiveZoneDefinition = BoxZone | RampZone | MoverZone | SpinnerZone | TriggerZone;

/** An authored map file, exactly as the schema allows it. */
export type MapDefinition = MapSchema;

/**
 * A stamp zone after `normalizeStampZone` (levels/map-normalize.js): its
 * `[x, y, z]` `pos` / `size` lowered to objects. Still a `StampZone`.
 */
export type NormalizedStampZone = Omit<KnownKeys<StampZone>, 'pos' | 'size'> & {
    pos: MapVec3;
    size?: MapVec3;
    [k: string]: unknown;
};

/** A zone after map-normalize: primitives untouched, stamp vectors as objects. */
export type NormalizedZoneDefinition = PrimitiveZoneDefinition | NormalizedStampZone;

/**
 * An authored map after `parseMapJson` (editor/map-document.ts): object-form
 * spawn and stamp vectors, everything else as authored. What the map editor
 * edits; still a valid `MapDefinition`.
 */
export type EditableMapDefinition = Omit<AuthoredMap, 'zones' | 'spawn'> & {
    zones: NormalizedZoneDefinition[];
    spawn: MapVec3;
    [k: string]: unknown;
};

/**
 * A map normalized for the runtime (`levels/map-normalize.js`): object-form
 * spawn, a goals list (v2 `goal` volumes become goal ranges), and no
 * file-only metadata (`id`, `version`, `author`).
 */
export interface MapContentDefinition
    extends Omit<AuthoredMap, 'id' | 'version' | 'author' | 'goal' | 'goals' | 'spawn'> {
    spawn: MapVec3;
    goals: MapGoalDefinition[];
}

export interface RuntimeLevel extends MapContentDefinition {
    source?: 'json' | 'code' | 'editor';
    /** Runtime levels retain level-specific fields consumed by zone handlers. */
    [key: string]: unknown;
}
