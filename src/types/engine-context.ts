import type RAPIER from '@dimforge/rapier3d-compat';
import type { CullingManager } from '../culling-manager.js';
import type { EffectPoolManager } from '../effect-pool.ts';
import type { LevelEffectBudget } from '../level-effect-budget.js';
import type { LightingBudgetManager } from '../lighting-budget.ts';
import type { LightingSystem } from '../lighting-system.ts';
import type { ParticleSystem } from '../particle-system.ts';
import type { VolumetricLightsSystem } from '../rendering/volumetric-lights.ts';
import type { PhysicsWorld } from '../game/systems/physics-world.ts';
import type { FilamentHandle, FilamentModule } from './filament.ts';
import type { TrackLodManager } from '../assets/track-lod-manager.js';
import type { AutoQualityGovernor } from '../auto-quality-governor.js';
import type { CampaignProgress } from '../game/systems/campaign-progress.ts';
import type { CloudClient } from '../game/network/cloud-client.ts';
import type { MarbleLodManager } from '../marble-lod.js';
import type { PerfMonitor } from '../perf-monitor.js';

/** RGBA clear colour in linear [0, 1]. */
export type ClearColor = [number, number, number, number];

/**
 * Engine / render handles and per-game services every slice reads off the
 * game object. Populated once during boot (`InitCore.init`, `InitGraphics`,
 * `ZoneSetupAssets.setupAssets`, `MarblesGame` constructor) before any zone is
 * built or frame runs; `HeadlessGame` fills the Filament ones with stubs.
 *
 * Shared on purpose: hosts `Pick<EngineContext, ...>` the members they use
 * instead of re-declaring them, so `GameHost` (the intersection of every
 * host) never sees two different types for the same field.
 */
export interface EngineContext {
    // Physics.
    world: RAPIER.World;
    physicsWorld: PhysicsWorld;

    // Filament (UMD; handles are untyped by design, see filament.ts).
    Filament: FilamentModule;
    engine: FilamentHandle;
    scene: FilamentHandle;
    renderer: FilamentHandle;
    view: FilamentHandle;
    camera: FilamentHandle;
    swapChain: FilamentHandle;
    /** Default lit material and the unit cube / sphere buffers shared by zones. */
    material: FilamentHandle;
    vb: FilamentHandle;
    ib: FilamentHandle;
    sphereVb: FilamentHandle;
    sphereIb: FilamentHandle;
    /** True when the procedural (baked_procedural) material is active. */
    hasProceduralMaterial: boolean;

    // Lights (Filament entities) and lighting services.
    sunLight: FilamentHandle;
    fillLight: FilamentHandle;
    backLight: FilamentHandle;
    lightsInitialized?: boolean;
    currentClearColor?: ClearColor;
    particleSystem: ParticleSystem | null;
    lightingSystem: LightingSystem | null;
    volumetricLights: VolumetricLightsSystem | null;

    // Budgets / pools built in the MarblesGame constructor.
    effectPool: EffectPoolManager;
    levelEffectBudget: LevelEffectBudget;
    lightingBudget: LightingBudgetManager;
    cullingManager?: CullingManager | null;

    // Services built in the MarblesGame constructor (optional: `HeadlessGame`
    // has none of them and every caller guards).
    campaignProgress?: CampaignProgress;
    cloudClient?: CloudClient;
    perfMonitor?: PerfMonitor;
    autoQualityGovernor?: AutoQualityGovernor;
    trackLodManager?: TrackLodManager;
    marbleLodManager?: MarbleLodManager;

    /** Set by `HeadlessGame`: Filament is stubbed, no GPU work happens. */
    headless?: boolean;
}
