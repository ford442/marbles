export interface MapVec3 {
    x: number;
    y: number;
    z: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
export type CampaignChapter = 'tutorial' | 'classic' | 'neon' | 'extreme' | 'expert';
export type EnvironmentPreset =
    | 'default'
    | 'space_nebula'
    | 'ice'
    | 'volcanic'
    | 'neon_city'
    | 'underwater';
export type CameraMode =
    | 'orbit'
    | 'follow'
    | 'action'
    | 'fpv'
    | 'topdown'
    | 'cinematic'
    | 'side-scroller'
    | 'drone';

export type Range2 = [number, number];
export type RgbColor = [number, number, number];
export type RgbaColor = [number, number, number, number];

export interface AxisRange {
    x: Range2;
    y: Range2;
    z: Range2;
}

export interface AbilityMask {
    enabled?: string[];
    disabled?: string[];
}

export interface MedalThresholds {
    goldTime?: number;
    silverTime?: number;
    bronzeTime?: number;
    parTime?: number;
}

export interface MapCameraDefinition {
    mode?: CameraMode;
    angle?: number;
    height?: number;
    radius?: number;
    offset?: number;
}

export interface MapGoalDefinition {
    id: number;
    range: AxisRange;
}

export interface MapCheckpointDefinition {
    id?: number;
    pos?: MapVec3;
    range?: AxisRange;
}

export interface MapZoneDefinition {
    type: string;
    pos: MapVec3;
    size?: MapVec3;
    color?: RgbColor;
    rotY?: number;
    friction?: number;
    restitution?: number;
    slope?: number;
    boostForce?: number;
    model?: string;
    collider?: 'trimesh' | 'convexHull' | 'none';
    scale?: number;
    materialPreset?: string;
    lod?: Array<{ model: string; distance: number }>;
    kinematic?: {
        axis?: 'horizontal' | 'vertical' | 'circular';
        amplitude?: number;
        speed?: number;
        phase?: number;
    };
    collectible?: { kind?: string; value?: number };
    grappleAnchor?: { id?: string; radius?: number };
    checkpoint?: number;
    /** Map JSON intentionally permits zone-specific extension fields. */
    [key: string]: unknown;
}

export interface MapContentDefinition {
    name: string;
    zones: MapZoneDefinition[];
    spawn: MapVec3;
    goals: MapGoalDefinition[];
    description?: string;
    difficulty?: Difficulty;
    chapter?: CampaignChapter;
    nightMode?: boolean;
    backgroundColor?: RgbaColor;
    environment?: EnvironmentPreset;
    colorGrade?: string;
    behaviors?: string[];
    checkpoints?: MapCheckpointDefinition[];
    camera?: MapCameraDefinition;
    abilities?: AbilityMask;
    medals?: MedalThresholds;
    collectiblesTotal?: number;
    music?: string;
    ambientSounds?: string[];
}

export interface MapDefinition extends MapContentDefinition {
    id: string;
    version: string;
    author?: string;
    /** The JSON schema allows legacy and level-specific extension fields. */
    [key: string]: unknown;
}

export interface RuntimeLevel extends MapContentDefinition {
    source?: 'json' | 'code' | 'editor';
    /** Runtime levels retain level-specific fields consumed by zone handlers. */
    [key: string]: unknown;
}
