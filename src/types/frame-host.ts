import type { CullingManager } from '../culling-manager.js';
import type { AbilitySystem } from '../game/systems/ability-system.ts';
import type { GhostReplay } from '../game/systems/ghost-replay.js';
import type { HudController } from '../game/systems/hud-controller.ts';
import type { PhysicsBatchBuffers } from '../wasm-bridge.js';
import type { ZoneScope } from '../zone-setup/primitives.ts';
import type { GameHost } from './game-host.ts';
import type {
    AbilityState, CameraState, HudState, InputState, LevelState, PhysicsState, RenderState, SpeedLine,
} from './game-state.ts';
import type { Vec3 } from './geometry.ts';

/** Every grouped state slice, flattened onto the game object by `bindGameState`. */
export type FrameState = PhysicsState & AbilityState & LevelState & CameraState & InputState & HudState & RenderState;

/**
 * What `GameLoopHudTick.tickHudCooldownBars` reads: the legacy cooldown-bar
 * elements and timers. `HudController` calls it with its own host, so
 * `HudControllerHost` includes this (see `hud-controller.ts`).
 */
export type HudTickHost = Pick<
    FrameState,
    | 'activeEffects' | 'activeEffectsEl'
    | 'sizebarContainerEl' | 'sizebarEl' | 'lastSizeShiftTime' | 'sizeShiftCooldown'
    | 'chameleonBarContainerEl' | 'chameleonBarEl' | 'lastChameleonTime' | 'chameleonProfiles'
    | 'chameleonState' | 'chameleonCooldown'
    | 'teleportBarEl' | 'lastTeleportTime' | 'teleportCooldown'
    | 'gravityPulseBarContainerEl' | 'gravityPulseBarEl' | 'lastGravityPulseTime' | 'gravityPulseCooldown'
    | 'empBarEl' | 'empBarContainerEl' | 'empCooldown'
> & Pick<FrameExtras, 'lastEMPTime'> & {
    abilitySystem?: { tickHudBars(now: number, shouldUpdateHUD: boolean): void } | null;
};

/**
 * Game members the frame slices (`game-loop/{logic,dynamics-tick,finalize-frame,
 * speed-lines,hud-tick}.js`) use that no grouped state slice or composed-system
 * host declares: subsystems, methods installed by other mixins, and scratch
 * fields created lazily (`?`). Add a member here when a slice starts using it;
 * there is deliberately no index signature to catch typos.
 */
export interface FrameExtras {
    // Subsystems.
    abilitySystem: AbilitySystem;
    hudController: HudController;
    ghostReplay: GhostReplay;
    cullingManager?: CullingManager | null;
    zoneScope?: ZoneScope | null;
    touchControls?: { tick(): void } | null;

    // Frame clock (`GameLoopLoop.loop`).
    frameDt?: number;
    simDt?: number;
    physicsSubsteps?: number;

    // Speed-lines overlay (`GameLoopSpeedLines`; its state is in `RenderState`).
    initSpeedLines(): void;
    resizeSpeedLinesCanvas(): void;
    createSpeedLine(): SpeedLine;
    updateSpeedLines(speed: number): void;
    renderSpeedLines(): void;

    // Methods installed by other mixins (optional where callers guard them).
    updateGrapple(): void;
    isGrounded(marble: unknown): boolean;
    tickMultiplayer?(): void;
    getScreenShakeIntensity?(): number;
    showTrickMessage?(text: string, color: string): void;
    triggerCollectionEffect?(pos: Vec3, value: number, type: string): void;
    spawnJetpackExhaust(pos: Vec3, linvel: Vec3): void;
    spawnIceBlock(pos: Vec3): void;

    // Scratch state created on first use.
    timeStopOffset?: number;
    lastTimeStopSavedTime?: number | null;
    wasPhasing?: boolean;
    bankedTrickScore?: number;
    collectiblesCollected?: number;
    frameCount?: number;
    lastEMPTime?: number;
    _forceBatchBuffers?: PhysicsBatchBuffers;
}

/**
 * `this` for the frame slices. Intersects the grouped state with `GameHost`
 * (the composed systems' contract) and `FrameExtras`; no string index
 * signature, so a misspelled or undeclared member is a type error.
 */
export type FrameHost = FrameState & GameHost & FrameExtras;
