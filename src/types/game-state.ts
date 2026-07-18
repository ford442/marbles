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
}

/** Speed/jump power-up timers applied to the active marble. */
export interface ActiveEffects {
    speed: number;
    jump: number;
}

/** Chameleon ability material/gravity profile. */
export interface ChameleonProfile {
    name: string;
    color: [number, number, number];
    gravityScale: number;
}

/** Runtime marble entry (physics + render handles populated at spawn). */
export interface MarbleObject {
    name: string;
    scale: number;
    baseScale: number;
    baseRadius: number;
    color: number[];
    originalColor: number[];
    initialPos: { x: number; y: number; z: number };
    respawnPos: { x: number; y: number; z: number };
    scoredGoals: Set<unknown>;
    rigidBody?: unknown;
    collider?: unknown;
    entity?: unknown;
    [key: string]: unknown;
}

/** Physics bodies, world objects, grapple, magnet, trick tracking. */
export interface PhysicsState {
    marbles: MarbleObject[];
    staticBodies: unknown[];
    staticEntities: unknown[];
    dynamicObjects: unknown[];
    dynamicBodies: Set<unknown>;
    checkpoints: unknown[];
    collectibles: unknown[];
    collectibleRotation: number;
    powerUps: unknown[];
    powerUpRotation: number;
    activeEffects: ActiveEffects;
    movingPlatforms: unknown[];
    rotatingPlatforms: unknown[];
    temporaryPlatforms: unknown[];
    playerMarble: MarbleObject | null;
    visualParticles: unknown[];
    trickState: TrickState;
    isWallRiding: boolean;
    wallRideTime: number;
    isStomping: boolean;
    stompStartTime: number;
    magnetPower: number;
    magnetActive: boolean;
    magnetMode: string | null;
    isGrappling: boolean;
    grappleTarget: unknown;
    grappleEntity: unknown;
    grappleInst: unknown;
    grappleMaxDist: number;
    grappleForce: number;
    isGrappleZipping: boolean;
    portalA: unknown;
    portalB: unknown;
    lastPortalTeleportTime: number;
    portalCooldown: number;
    nearMisses: Map<unknown, unknown>;
}

/** Ability cooldowns, energy pools, and active effect instances. */
export interface AbilityState {
    holoDuration: number;
    holoCooldown: number;
    lastHoloTime: number;
    activeBombs: unknown[];
    lastBombTime: number;
    bombCooldown: number;
    activeMissiles: unknown[];
    lastMissileTime: number;
    missileCooldown: number;
    activeBlackHoles: unknown[];
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
    timeStopSavedStates: Map<unknown, unknown>;
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
    currentLevel: unknown;
    levelStartTime: number;
    levelComplete: boolean;
    goalDefinitions: unknown[];
    checkpointDefinitions: unknown[];
    goalEffects: unknown[];
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
    maxJumps: number;
    lastBoostTime: number;
    boostCooldown: number;
    lastDashTime: number;
    dashCooldown: number;
    isChargingDash: boolean;
    dashCharge: number;
    maxDashCharge: number;
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
    magnetBarEl: HTMLElement | null;
    focusBarEl: HTMLElement | null;
    rewindBarEl: HTMLElement | null;
    gravityBarEl: HTMLElement | null;
    effectEl: HTMLElement | null;
    activeEffectsEl: HTMLElement | null;
}

/** Filament / engine handles (populated during init). */
export interface RenderState {
    Filament: unknown;
    material: unknown;
    cubeMesh: unknown;
    cueInst: unknown;
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
