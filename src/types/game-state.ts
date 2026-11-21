import type { FilamentHandle, FilamentModule } from './filament.ts';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from './geometry.ts';
import type { MapGoalDefinition, MovementModel } from './map.ts';
import type { MarbleLodMesh } from '../marble-lod.js';
import type { MaterialTier, TieredMaterialPreset } from '../marble-material-tier.ts';
import type { CameraPose } from './render-host.ts';
import type { TransformSyncOwner } from '../game-loop/helpers.ts';
import type {
    ActiveProjectile, Checkpoint, Collectible, DynamicObject, GoalEffect, GrappleAnchor, MovingPlatform, Portal, PowerUp,
    RotatingPlatform, TemporaryPlatform, VisualParticle,
} from './world-objects.ts';

/** Mutable trick counters tracked while the player marble is airborne. */
export interface TrickState {
    airTime: number;
    spin: number;
    wallRides: number;
    highSpeed: number;
    flips: number;
    rolls: number;
    wallBounces: number;
    maxAltitude: number;
    startAltitude: number;
    /** Frames of sustained drift; created on first grounded tick (`GameLogicCore`). */
    driftTime?: number;
}

/**
 * A grapple-yank target: the dynamic body a grapple ray hit (Rapier body or
 * worker proxy), which the grapple reads and pushes every frame.
 */
export interface GrappleTargetBody {
    readonly handle: number;
    translation(): Vec3;
    mass(): number;
    applyImpulse(impulse: Vec3, wake: boolean): void;
}

/** Speed/jump power-up timers applied to the active marble. */
export interface ActiveEffects {
    speed: number;
    jump: number;
    gravity?: number;
    /** Effect name → expiry (ms epoch); the HUD lists whatever is live. */
    [effect: string]: number | undefined;
}

/** Chameleon ability material/gravity profile. */
export interface ChameleonProfile {
    name: string;
    color: [number, number, number];
    gravityScale: number;
}

/** Runtime marble entry (physics + render handles populated at spawn). */
export interface MarbleObject extends TransformSyncOwner {
    name: string;
    scale: number;
    baseScale: number;
    baseRadius: number;
    color: number[];
    originalColor: number[];
    initialPos: { x: number; y: number; z: number };
    respawnPos: { x: number; y: number; z: number };
    scoredGoals: Set<unknown>;
    rigidBody: RAPIER.RigidBody;
    collider?: RAPIER.Collider | null;
    baseGravityScale: number;
    entity?: unknown;
    /** Size-shift profile index (0 normal, 1 mini, 2 giant; `cycleSizeShift`). */
    sizeState?: number;
    /** Collider material the size shift rebuilds the ball with. */
    baseRestitution?: number | undefined;
    baseFriction?: number | undefined;
    baseDensity?: number | undefined;
    /** Rainbow marbles cycle `baseColor` every frame (`syncTransformsAndRender`). */
    rainbow?: boolean | undefined;
    /** Renderable / material-instance cache for the rainbow colour write. */
    _renderEntity?: unknown;
    _renderInst?: FilamentHandle;
    _renderMatInstance?: FilamentHandle;
    /** Rainbow colour cache (`colorChanged`). */
    _lastRainbowColor?: number[];
    _lastRainbowColorAt?: number;
    /** 'cube' marbles never swap LOD meshes (`MarbleLodManager`). */
    geometry?: string;
    /** Active sphere LOD (0 = high … 2 = low) and when it last changed. */
    lodLevel?: number;
    _lastLodSwitchAt?: number;
    lodMeshes?: readonly MarbleLodMesh[] | null | undefined;
    /** Spawn data (`MarbleRegistry.createMarbles`): catalog id, rival slot, material and glow. */
    id?: string;
    isRival?: boolean;
    originalGravityScale?: number;
    materialPresetName?: string;
    materialPreset?: TieredMaterialPreset | null;
    matInstance?: FilamentHandle;
    _materialTier?: MaterialTier;
    emissive?: boolean;
    lightColor?: readonly number[];
    lightIntensity?: number;
    /** Proxy point light following the player marble (`updateActiveMarbleLight`). */
    lightEntity?: FilamentHandle;
    [key: string]: unknown;
}

/** Physics bodies, world objects, grapple, magnet, trick tracking. */
export interface PhysicsState {
    marbles: MarbleObject[];
    staticBodies: unknown[];
    staticEntities: unknown[];
    dynamicObjects: DynamicObject[];
    dynamicBodies: Set<RAPIER.RigidBody>;
    checkpoints: Checkpoint[];
    collectibles: Collectible[];
    collectibleRotation: number;
    powerUps: PowerUp[];
    powerUpRotation: number;
    activeEffects: ActiveEffects;
    movingPlatforms: MovingPlatform[];
    rotatingPlatforms: RotatingPlatform[];
    temporaryPlatforms: TemporaryPlatform[];
    playerMarble: MarbleObject | null;
    visualParticles: VisualParticle[];
    trickState: TrickState;
    isWallRiding: boolean;
    wallRideTime: number;
    /** Normal of the wall being ridden (set by `checkGameLogic`; tilts the camera up-vector). */
    currentWallNormal?: Vec3 | null;
    isStomping: boolean;
    stompStartTime: number;
    magnetPower: number;
    magnetActive: boolean;
    magnetMode: string | null;
    grappleAnchors: GrappleAnchor[];
    isGrappling: boolean;
    /** World point the grapple line is attached to (`ZoneSetupGrapple`). */
    grappleTarget: Vec3 | null;
    /** Dynamic body being yanked toward the player, or null for a static anchor. */
    grappleTargetBody: GrappleTargetBody | null;
    grappleEntity: FilamentHandle;
    grappleInst: FilamentHandle;
    grappleMaxDist: number;
    grappleForce: number;
    isGrappleZipping: boolean;
    portalA: Portal | null;
    portalB: Portal | null;
    lastPortalTeleportTime: number;
    portalCooldown: number;
    /** Near-miss key (`dyn_<handle>` etc.) → last award time (ms epoch). */
    nearMisses: Map<string, number>;
}

/** Ability cooldowns, energy pools, and active effect instances. */
export interface AbilityState {
    holoDuration: number;
    holoCooldown: number;
    lastHoloTime: number;
    activeBombs: ActiveProjectile[];
    lastBombTime: number;
    bombCooldown: number;
    activeMissiles: ActiveProjectile[];
    lastMissileTime: number;
    missileCooldown: number;
    activeBlackHoles: ActiveProjectile[];
    lastBlackHoleTime: number;
    blackHoleCooldown: number;
    lastSizeShiftTime: number;
    sizeShiftCooldown: number;
    shieldEnergy: number;
    maxShieldEnergy: number;
    shieldActive: boolean;
    lastTeleportTime: number;
    teleportCooldown: number;
    teleportDistance: number;
    lastBlinkTime: number;
    blinkCooldown: number;
    gliderEnergy: number;
    maxGliderEnergy: number;
    gliderActive: boolean;
    buildEnergy: number;
    maxBuildEnergy: number;
    timeScale: number;
    focusEnergy: number;
    maxFocusEnergy: number;
    focusActive: boolean;
    hoverEnergy: number;
    maxHoverEnergy: number;
    hoverActive: boolean;
    /** Gravity scale hover replaced; non-null while engaged (abilities/hover.js). */
    hoverSavedGravity: number | null;
    jetpackEnergy: number;
    maxJetpackEnergy: number;
    jetpackActive: boolean;
    iceEnergy: number;
    maxIceEnergy: number;
    lastIceTime: number;
    iceCooldown: number;
    iceActive: boolean;
    phaseEnergy: number;
    maxPhaseEnergy: number;
    phaseActive: boolean;
    flipEnergy: number;
    maxFlipEnergy: number;
    flipActive: boolean;
    vortexEnergy: number;
    maxVortexEnergy: number;
    vortexActive: boolean;
    empEnergy: number;
    maxEmpEnergy: number;
    empActive: boolean;
    lastEmpTime: number;
    empCooldown: number;
    lastTremorTime: number;
    tremorCooldown: number;
    tremorShakeTimer: number;
    violetEnergy: number;
    maxVioletEnergy: number;
    violetActive: boolean;
    violetLightEntity: unknown;
    timeStopEnergy: number;
    maxTimeStopEnergy: number;
    timeStopActive: boolean;
    timeStopSavedStates: Map<number, { linvel: Vec3; angvel: Vec3 }>;
    chameleonState: number;
    lastChameleonTime: number;
    chameleonCooldown: number;
    chameleonProfiles: ChameleonProfile[];
    adrenaline: number;
    maxAdrenaline: number;
    isRewinding: boolean;
    maxRewindFrames: number;
    _rewindBuffer: Float32Array;
    _rewindHead: number;
    _rewindCount: number;
    gravityPulseCooldown: number;
    lastGravityPulseTime: number;
    holobarEl: HTMLElement | null;
    holobarContainerEl: HTMLElement | null;
    bombBarEl: HTMLElement | null;
    bombBarContainerEl: HTMLElement | null;
    missileBarEl: HTMLElement | null;
    missileBarContainerEl: HTMLElement | null;
    blackHoleBarEl: HTMLElement | null;
    blackHoleBarContainerEl: HTMLElement | null;
    sizebarEl: HTMLElement | null;
    sizebarContainerEl: HTMLElement | null;
    shieldbarEl: HTMLElement | null;
    shieldbarContainerEl: HTMLElement | null;
    blinkBarEl: HTMLElement | null;
    blinkBarContainerEl: HTMLElement | null;
    teleportBarEl: HTMLElement | null;
    teleportBarContainerEl: HTMLElement | null;
    gliderBarEl: HTMLElement | null;
    gliderBarContainerEl: HTMLElement | null;
    chameleonBarEl: HTMLElement | null;
    chameleonBarContainerEl: HTMLElement | null;
    hoverBarEl: HTMLElement | null;
    hoverBarContainerEl: HTMLElement | null;
    buildbarEl: HTMLElement | null;
    buildbarContainerEl: HTMLElement | null;
    jetpackbarEl: HTMLElement | null;
    jetpackbarContainerEl: HTMLElement | null;
    icebarEl: HTMLElement | null;
    icebarContainerEl: HTMLElement | null;
    phasebarEl: HTMLElement | null;
    phasebarContainerEl: HTMLElement | null;
    flipbarEl: HTMLElement | null;
    flipbarContainerEl: HTMLElement | null;
    vortexbarEl: HTMLElement | null;
    vortexbarContainerEl: HTMLElement | null;
    empBarEl: HTMLElement | null;
    empBarContainerEl: HTMLElement | null;
    groundslambarEl: HTMLElement | null;
    groundslambarContainerEl: HTMLElement | null;
    violetbarEl: HTMLElement | null;
    violetbarContainerEl: HTMLElement | null;
    timeStopbarEl: HTMLElement | null;
    timeStopbarContainerEl: HTMLElement | null;
    adrenalineBarEl: HTMLElement | null;
    adrenalineBarContainerEl: HTMLElement | null;
    gravityPulseBarEl: HTMLElement | null;
    gravityPulseBarContainerEl: HTMLElement | null;
}

/** Level progress, goals, checkpoints, ghost replay. */
export interface LevelState {
    /** Id of the loaded level (`LevelLoader` sets it), null in menus / the editor. */
    currentLevel: string | null;
    /** The loaded level's `movementModel` (null = legacy model 1). */
    movementModel: MovementModel | null;
    levelStartTime: number;
    levelComplete: boolean;
    goalDefinitions: MapGoalDefinition[];
    checkpointDefinitions: unknown[];
    goalEffects: GoalEffect[];
    ghostEntity: unknown;
    ghostMaterialInstance: unknown;
    ghostLightEntity: unknown;
}

/** Camera pose, modes, FOV, shake, lock-on. */
export interface CameraState {
    camAngle: number;
    targetCamAngle: number;
    targetCamRadius: number;
    targetCamHeight: number;
    camHeight: number;
    camRadius: number;
    cameraMode: string;
    isLockedOn: boolean;
    lockOnTarget: unknown;
    lastLockTime: number;
    baseFov: number;
    currentFov: number;
    cameraShake: { x: number; y: number; z: number };
    cameraFollowPos: { x: number; y: number; z: number } | null;
    cameraFollowLookAt: { x: number; y: number; z: number } | null;
    followDist: number;
    /**
     * Written by `GameLoopCamera.updateCamera` each frame (created on first
     * use): the last eye / look-at pose (read by culling, LOD, lighting and
     * sync), the speed-scaled FOV, and the projection / DoF values last pushed
     * to Filament so unchanged frames skip the call.
     */
    _cameraState?: CameraPose;
    activeFov?: number;
    _lastSetFov?: number;
    _lastSetProjectionAspect?: number;
    _dofEnabled?: boolean;
    _dofFocusDistance?: number | null;
}

/** Keyboard, gamepad, aim, charge, dash, jump input. */
export interface InputState {
    keys: Record<string, boolean>;
    gamepadState: Record<string, unknown>;
    currentMarbleIndex: number;
    aimYaw: number;
    pitchAngle: number;
    chargePower: number;
    charging: boolean;
    isAiming: boolean;
    jumpCharge: number;
    isChargingJump: boolean;
    jumpCount: number;
    hasDoubleJumped: boolean;
    maxJumps: number;
    lastBoostTime: number;
    boostCooldown: number;
    lastDashTime: number;
    dashCooldown: number;
    lastAirDashTime: number;
    airDashCooldown: number;
    isChargingAirDash: boolean;
    airDashChargeTime: number;
    airDashStartAltitude: number;
    airDashOldGravity: number;
    isChargingDash: boolean;
    dashCharge: number;
    maxDashCharge: number;
    isChargingStomp: boolean;
    stompChargeTime: number;
    stompStartAltitude: number;
    stompOldGravity: number;
    stompOldColor: number[] | null;
    stompReleaseTime: number;
    /** Set on stomp release; gates the next charge (`stompCooldown` ms). */
    lastStompTime: number;
    stompCooldown: number;
    isChargingShockwave: boolean;
    shockwaveChargeTime: number;
    shockwaveOldGravity: number;
    awaitingShockwaveImpact: boolean;
    lastShockwaveTime: number;
    shockwaveCooldown: number;
}

/** Score, combo, and HUD DOM references. */
export interface HudState {
    score: number;
    combo: number;
    comboTimer: number;
    maxComboTime: number;
    scoreEl: HTMLElement | null;
    comboEl: HTMLElement | null;
    combobarContainerEl: HTMLElement | null;
    combobarEl: HTMLElement | null;
    timerEl: HTMLElement | null;
    levelNameEl: HTMLElement | null;
    selectedEl: HTMLElement | null;
    aimEl: HTMLElement | null;
    powerbarEl: HTMLElement | null;
    jumpBarEl: HTMLElement | null;
    boostBarEl: HTMLElement | null;
    dashBarEl: HTMLElement | null;
    airDashBarEl: HTMLElement | null;
    airDashBarContainerEl: HTMLElement | null;
    magnetBarEl: HTMLElement | null;
    focusBarEl: HTMLElement | null;
    rewindBarEl: HTMLElement | null;
    gravityBarEl: HTMLElement | null;
    effectEl: HTMLElement | null;
    activeEffectsEl: HTMLElement | null;
}

/** Filament / engine handles (populated during init). */
/** One streak of the speed-lines overlay (`createSpeedLine`). */
export interface SpeedLine {
    x: number;
    y: number;
    length: number;
    width: number;
    speed: number;
    angle: number;
}

export interface RenderState {
    Filament: FilamentModule;
    material: FilamentHandle;
    cubeMesh: unknown;
    /** Cue-stick transform instance (`ZoneSetupGrapple.createCueStick`). */
    cueInst: FilamentHandle;
    speedLinesCanvas: HTMLCanvasElement | null;
    speedLinesCtx: CanvasRenderingContext2D | null;
    speedLinesLines: SpeedLine[];
    speedLinesIntensity: number;
}

/** Grouped constructor state mirrored onto MarblesGame via bindGameState(). */
export interface GameState {
    canvas: HTMLCanvasElement | null;
    physics: PhysicsState;
    abilities: AbilityState;
    level: LevelState;
    camera: CameraState;
    input: InputState;
    hud: HudState;
    render: RenderState;
}

export interface CreateGameStateOptions {
    canvas?: HTMLCanvasElement | null;
    doc?: Document | null;
}
