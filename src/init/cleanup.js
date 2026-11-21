// @ts-check
import { destroyLoadedTrackModels } from '../assets/gltf-track-loader.js';
import { audio } from '../audio.js';
import { unloadLevelBehaviors } from '../game/level-behaviors/index.js';
import { clearRemoteAbilityFx } from '../game/network/ability-sync.ts';
import { resetDesyncIndicator } from '../game/network/desync-indicator.ts';

/** @typedef {import('../types/engine-context.ts').EngineContext} EngineContext */
/** @typedef {import('../types/frame-host.ts').FrameState} FrameState */
/** @typedef {import('../types/frame-host.ts').FrameExtras} FrameExtras */
/** @typedef {import('../types/filament.ts').FilamentHandle} FilamentHandle */
/** @typedef {import('../game/systems/physics-backend.ts').PhysicsBackendHost} PhysicsBackendHost */
/** @typedef {import('../game/systems/physics-world.ts').PhysicsWorldHost} PhysicsWorldHost */
/** @typedef {import('../game/systems/marble-registry.js').MarbleRegistry} MarbleRegistry */
/** @typedef {import('../abilities/constructs.ts').AbilityConstructs} AbilityConstructs */
/** @typedef {import('../zones/methods/visuals.ts').ZoneVisuals} ZoneVisuals */
/** @typedef {import('./multiplayer-menu.ts').MultiplayerContext} MultiplayerContext */
/** @typedef {import('./touch-init.ts').TouchControlsContext} TouchControlsContext */

/**
 * Level-scoped render members other slices create and `clearLevel` tears down.
 * @typedef {object} LevelTeardownContext
 * @property {FilamentHandle | null} [activeMarbleLightEntity] Point light following the player (`updateActiveMarbleLight`).
 * @property {{ dispose(): void } | null} [webgpuParticles] WebGPU particle overlay (`scheduleWebGPUExperiments`).
 */

/**
 * What `InitCleanup` uses on the game, plus what the teardown helpers it hands
 * the game to need. `world` is the intersection of the Rapier world and the
 * backend's view of it (`removeRigidBody(unknown)`), as on the game itself.
 * @typedef {LevelTeardownContext
 *     & Pick<EngineContext,
 *         | 'world' | 'Filament' | 'engine' | 'scene' | 'lightingBudget' | 'lightingSystem'
 *         | 'volumetricLights' | 'particleSystem' | 'effectPool' | 'levelEffectBudget' | 'cullingManager'
 *         | 'trackLodManager' | 'marbleLodManager'>
 *     & Pick<PhysicsBackendHost, 'world' | 'physicsBackend' | 'multiplayerMode' | 'hostAuthorityMode'>
 *     & Pick<FrameState,
 *         | 'marbles' | 'playerMarble' | 'staticBodies' | 'staticEntities' | 'dynamicObjects' | 'checkpoints'
 *         | 'collectibles' | 'grappleAnchors' | 'powerUps' | 'activeEffects' | 'movingPlatforms'
 *         | 'rotatingPlatforms' | 'ghostEntity' | 'ghostMaterialInstance' | 'ghostLightEntity'
 *         | 'portalA' | 'portalB' | 'adrenaline' | 'nearMisses' | 'dynamicBodies'>
 *     & Pick<PhysicsWorldHost, 'staticBatchResources' | 'staticBatchStats' | '_staticBoxBatchGroups' | '_decorativeBatchGroups'>
 *     & Pick<FrameExtras, 'zoneScope'>
 *     & Partial<MultiplayerContext>
 *     & TouchControlsContext
 *     & Pick<MarbleRegistry, 'resetPlayerAbilityState'>
 *     & Pick<AbilityConstructs, 'destroyPortal'>
 *     & Pick<ZoneVisuals, 'setNightMode'>
 *     & Parameters<typeof unloadLevelBehaviors>[0]
 *     & Parameters<typeof destroyLoadedTrackModels>[0]
 *     & Parameters<typeof clearRemoteAbilityFx>[0]
 *     & Parameters<typeof resetDesyncIndicator>[0]
 *     & import('../zone-setup/primitives.ts').ZoneScopeHost
 * } InitCleanupHost
 */

/** Level teardown (`LevelCleanupRuntime`); `LevelLoader.clearLevel` delegates here. */
export class InitCleanup {
    /** @param {InitCleanupHost} game */
    constructor(game) {
        this.game = game;
    }

    /** @returns {void} */
    clearLevel() {
        unloadLevelBehaviors(this.game);
        // Before marbles are removed: drops grapple/double-jump/charge state.
        this.game.resetPlayerAbilityState()
        const workerActive = this.game.physicsBackend?.isWorkerMode?.();

        for (const m of this.game.marbles) {
            if (!workerActive) this.game.world.removeRigidBody(m.rigidBody)
            this.game.scene.remove(m.entity)
            if (m.matInstance) this.game.engine.destroyMaterialInstance(m.matInstance)
            this.game.engine.destroyEntity(m.entity)
        }
        if (this.game.activeMarbleLightEntity) {
            this.game.lightingBudget?.unregister(this.game.activeMarbleLightEntity)
            this.game.scene.remove(this.game.activeMarbleLightEntity)
            this.game.engine.destroyEntity(this.game.activeMarbleLightEntity)
            this.game.Filament.EntityManager.get().destroy(this.game.activeMarbleLightEntity)
            this.game.activeMarbleLightEntity = null
        }
        this.game.marbles = []
        this.game.playerMarble = null

        // Everything the v2 primitive builder made (bodies, entities, material instances).
        this.game.zoneScope?.dispose(this.game)

        for (const body of this.game.staticBodies) {
            if (!workerActive) this.game.world.removeRigidBody(body)
        }
        this.game.staticBodies = []

        destroyLoadedTrackModels(this.game)
        this.game.trackLodManager?.reset()
        audio?.stopMusic?.()
        audio?.stopAllRolling?.()
        audio?.clearReverbZones?.()

        for (const entity of this.game.staticEntities) {
            this.game.scene.remove(entity)
            this.game.engine.destroyEntity(entity)
        }
        this.game.staticEntities = []
        if (this.game.staticBatchResources) {
            for (const batch of this.game.staticBatchResources) {
                // Entries are the `{ entity, vb, ib, matInstance, ... }` records PhysicsWorld batches push.
                const matInstance = typeof batch === 'object' && batch !== null && 'matInstance' in batch
                    ? batch.matInstance
                    : undefined
                if (matInstance) this.game.engine.destroyMaterialInstance(matInstance)
            }
            this.game.staticBatchResources = []
        }
        if (this.game._staticBoxBatchGroups) this.game._staticBoxBatchGroups.clear()
        if (this.game._decorativeBatchGroups) this.game._decorativeBatchGroups.clear()
        this.game.staticBatchStats = {
            groups: 0,
            boxes: 0,
            collapsedEntities: 0,
            // Same shape PhysicsWorld writes; readers default a missing one to 0 anyway.
            decorative: { groups: 0, instances: 0, collapsedEntities: 0 },
        }
        this.game.cullingManager?.reset()
        this.game.marbleLodManager?.reset()
        this.game.effectPool?.reset()
        this.game.levelEffectBudget?.reset()
        this.game.lightingBudget?.reset()
        if (this.game.lightingSystem) {
            this.game.lightingSystem.clearAnimatedLights()
        }

        // Clear volumetric shaft and caustic sources
        if (this.game.volumetricLights) {
            this.game.volumetricLights.clearSources()
        }

        // Clear ambient zone particle emitters
        if (this.game.particleSystem) {
            this.game.particleSystem.clearAmbientEmitters()
            this.game.particleSystem.dispose()
        }
        if (this.game.webgpuParticles) {
            this.game.webgpuParticles.dispose()
            this.game.webgpuParticles = null
        }

        for (const obj of this.game.dynamicObjects) {
            if (!workerActive) this.game.world.removeRigidBody(obj.rigidBody)
            this.game.scene.remove(obj.entity)
            if (obj.matInstance) this.game.engine.destroyMaterialInstance(obj.matInstance)
            this.game.engine.destroyEntity(obj.entity)
        }
        this.game.dynamicObjects = []

        for (const cp of this.game.checkpoints) {
            this.game.scene.remove(cp.entity)
            this.game.engine.destroyEntity(cp.entity)
        }
        this.game.checkpoints = []

        for (const c of this.game.collectibles) {
            this.game.scene.remove(c.entity)
            this.game.engine.destroyEntity(c.entity)
        }
        this.game.collectibles = []

        if (this.game.grappleAnchors) {
            for (const a of this.game.grappleAnchors) {
                this.game.scene.remove(a.entity)
                this.game.engine.destroyEntity(a.entity)
            }
        }
        this.game.grappleAnchors = []

        for (const p of this.game.powerUps) {
            if (!workerActive) this.game.world.removeRigidBody(p.rigidBody)
            this.game.scene.remove(p.entity)
            if (p.matInstance) this.game.engine.destroyMaterialInstance(p.matInstance)
            this.game.engine.destroyEntity(p.entity)
        }
        this.game.powerUps = []
        // Same as the initial state (createGameState); zero expiries read as "not active".
        this.game.activeEffects = { speed: 0, jump: 0 }

        for (const platform of this.game.movingPlatforms) {
            if (!workerActive) this.game.world.removeRigidBody(platform.rigidBody)
            this.game.scene.remove(platform.entity)
            if (platform.matInstance) this.game.engine.destroyMaterialInstance(platform.matInstance)
            this.game.engine.destroyEntity(platform.entity)
        }
        this.game.movingPlatforms = []

        for (const platform of this.game.rotatingPlatforms) {
            if (!workerActive) this.game.world.removeRigidBody(platform.rigidBody)
            this.game.scene.remove(platform.entity)
            if (platform.matInstance) this.game.engine.destroyMaterialInstance(platform.matInstance)
            this.game.engine.destroyEntity(platform.entity)
        }
        this.game.rotatingPlatforms = []

        if (this.game.ghostEntity) {
            this.game.scene.remove(this.game.ghostEntity)
            if (this.game.ghostMaterialInstance) this.game.engine.destroyMaterialInstance(this.game.ghostMaterialInstance)
            this.game.engine.destroyEntity(this.game.ghostEntity)
            this.game.Filament.EntityManager.get().destroy(this.game.ghostEntity)
            this.game.ghostEntity = null
            this.game.ghostMaterialInstance = null
        }

        if (this.game.ghostLightEntity) {
            this.game.scene.remove(this.game.ghostLightEntity)
            this.game.engine.destroyEntity(this.game.ghostLightEntity)
            this.game.Filament.EntityManager.get().destroy(this.game.ghostLightEntity)
            this.game.ghostLightEntity = null
        }

        this.game.remotePlayers?.clear()
        this.game.multiplayerMode = false
        this.game.hostAuthorityMode = false
        this.game.hostSim?.reset?.()
        this.game.clientPrediction?.reset?.()
        clearRemoteAbilityFx?.(this.game)
        resetDesyncIndicator?.(this.game)
        this.game.touchControls?.setGameplayActive(false)

        if (this.game.portalA) this.game.destroyPortal(this.game.portalA)
        if (this.game.portalB) this.game.destroyPortal(this.game.portalB)
        this.game.portalA = null
        this.game.portalB = null
        const portalAStatus = document.getElementById('portal-a-status')
        const portalBStatus = document.getElementById('portal-b-status')
        if (portalAStatus) portalAStatus.style.color = '#444'
        if (portalBStatus) portalBStatus.style.color = '#444'

        this.game.effectPool?.drainAllActiveVisuals()

        this.game.adrenaline = 0
        if (this.game.nearMisses) this.game.nearMisses.clear()

        this.game.dynamicBodies = new Set()
        this.game.setNightMode(false)

        if (workerActive) {
            this.game.physicsBackend?.resetWorld?.();
        }
    }
}
