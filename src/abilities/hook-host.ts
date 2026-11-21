/**
 * What the registry hooks (`registry.js`, `held-abilities.js`, `jump.js`,
 * `hover.js`) use on the game. `AbilitySystem` holds the game as its narrow
 * `AbilityHost & AbilityHookHost` (`AbilitySystemHost`) and hands that to every
 * hook, so `GameHost` must provide all of it.
 *
 * Slice methods are referenced through their owning class so a signature
 * change flows here; optional (`Partial`) where the hook guards the call.
 */
import type { AbilityHost } from '../game/systems/ability-system.ts';
import type { InputSystem } from '../game/systems/input-system.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { AbilityAirDash } from './air-dash.ts';
import type { AbilityBlackHole } from './black-hole.ts';
import type { AbilityBlink } from './blink.ts';
import type { AbilityBomb } from './bomb.ts';
import type { AbilityConstructs } from './constructs.ts';
import type { AbilityDash } from './dash.ts';
import type { AbilityDoubleJump } from './double-jump.ts';
import type { AbilityEmpTremor } from './emp-tremor.ts';
import type { AbilityMissiles } from './missiles.ts';
import type { AbilityStomp } from './stomp.ts';
import type { AbilityTeleport } from './teleport.ts';
import type { HoverHost } from './hover.js';

type HudUse = Pick<AbilityHost, 'hudManager'>;
/** The held abilities call it unguarded, so it is required here. */
type TrickMessage = Required<Pick<FrameExtras, 'showTrickMessage'>>;

/** Boolean game fields `heldFlag` toggles while the key is held. */
export type HeldFlagKey = 'jetpackActive' | 'gliderActive' | 'phaseActive' | 'vortexActive' | 'violetActive';

export type HeldFlagHost = Pick<FrameState, HeldFlagKey> & HudUse;

export type GravityFlipHost = Pick<FrameState, 'flipActive' | 'playerMarble'> & HudUse;

export type TimeStopHost =
    & Pick<FrameState, 'timeStopActive' | 'playerMarble' | 'dynamicBodies' | 'timeStopSavedStates'>
    & TrickMessage
    & HudUse;

export type SizeShiftHost =
    & Pick<FrameState, 'playerMarble' | 'lastSizeShiftTime'>
    & Pick<EngineContext, 'world'>
    & TrickMessage;

export type ChameleonHost =
    & Pick<FrameState,
        | 'playerMarble' | 'chameleonState' | 'chameleonProfiles' | 'flipActive' | 'lastChameleonTime'>
    & Pick<EngineContext, 'engine' | 'Filament'>
    & TrickMessage
    & HudUse;

export type EndRewindHost = Pick<FrameState, 'isRewinding' | 'playerMarble'> & Pick<EngineContext, 'engine' | 'Filament'>;

/** `jump.js` (press / release on Space). */
export type JumpHost =
    & Pick<FrameState,
        | 'playerMarble' | 'isChargingJump' | 'jumpCharge' | 'hasDoubleJumped' | 'jumpCount' | 'aimYaw'
        | 'activeEffects' | 'jumpBarEl'>
    & Pick<AbilityHost, 'multiplayerMode' | 'network'>
    & Pick<FrameExtras, 'abilitySystem' | 'awardTrickPoints'>
    & Pick<InputSystem, 'isGrounded' | 'getWallContact'>
    & Partial<Pick<AbilityDoubleJump, 'executeDoubleJump'>>;

/** Members the registry entries themselves touch. */
export type RegistryEntryHost =
    & Pick<FrameState,
        | 'playerMarble' | 'isChargingAirDash' | 'isChargingDash' | 'isChargingStomp'
        | 'magnetMode' | 'magnetActive' | 'isRewinding'>
    & HudUse
    & Pick<InputSystem, 'isGrounded'>
    & Partial<Pick<AbilityAirDash, 'beginAirDashCharge' | 'releaseAirDash'>>
    & Partial<Pick<AbilityDash, 'beginDashCharge' | 'releaseDash'>>
    & Partial<Pick<AbilityStomp, 'beginStompCharge' | 'releaseStomp'>>
    & Partial<Pick<AbilityConstructs, 'fireGravityPulse'>>
    & Partial<Pick<AbilityEmpTremor, 'fireTremor' | 'fireEMP'>>
    & Pick<AbilityBomb, 'spawnBomb'>
    & Pick<AbilityMissiles, 'spawnMissile'>
    & Pick<AbilityBlackHole, 'spawnBlackHole'>
    & Pick<AbilityConstructs, 'spawnHoloPlatform' | 'spawnBuildPiece' | 'firePortal'>
    & Pick<AbilityBlink, 'triggerBlink'>
    & Pick<AbilityTeleport, 'triggerTeleport'>
    & {
        /** The unwrapped grapple handlers, captured by `InitCore` (init/core.ts). */
        startGrappleRaw?(): void;
        stopGrappleRaw?(): void;
    };

/** Everything any registry hook may use: the game as the hooks see it. */
export type AbilityHookHost =
    & RegistryEntryHost
    & JumpHost
    & HoverHost
    & HeldFlagHost
    & GravityFlipHost
    & TimeStopHost
    & SizeShiftHost
    & ChameleonHost
    & EndRewindHost;
