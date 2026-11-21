import type { PhysicsWorld } from '../game/systems/physics-world.ts';
import type { ZoneSetupEnvironment } from '../zone-setup/environment.ts';
import type { ZoneInteractiveCreation } from '../zones/methods/interactive-creation.ts';
import type { ZonePhysicsMethods } from '../zones/methods/physics.ts';
import type { ZoneThemedCreation } from '../zones/methods/themed-creation.ts';
import type { ZoneGlowHost, ZoneLightHost, ZoneVisuals } from '../zones/methods/visuals.ts';
import type { DecorationHost } from '../zones/methods/decorations.ts';
import type { EngineContext } from './engine-context.ts';
import type { FrameState } from './frame-host.ts';

/**
 * What a zone factory (`src/zones/*.js`, `createXxxZone(game, offset)`) and the
 * zone-building slices (`zones/methods/*`) may use on the game.
 *
 * Methods are referenced through their owning class (`ZonePhysicsMethods[...]`)
 * so a signature tightened in the slice flows here automatically. Add a member
 * when a factory starts using it; there is deliberately no index signature.
 *
 * Factories hand `game` to the shared helpers (`createZoneLight`,
 * `createZoneGlow`, `decorate*`), so their hosts are part of this type.
 */
export type ZoneBuildHost =
    & ZoneLightHost & ZoneGlowHost & DecorationHost
    & Pick<EngineContext,
        | 'world' | 'physicsWorld'
        | 'Filament' | 'engine' | 'scene' | 'renderer' | 'material'
        | 'vb' | 'ib' | 'sphereVb' | 'sphereIb' | 'hasProceduralMaterial'
        | 'sunLight' | 'fillLight' | 'backLight' | 'lightsInitialized' | 'currentClearColor'
        | 'particleSystem' | 'lightingSystem' | 'volumetricLights'
        | 'effectPool' | 'levelEffectBudget' | 'lightingBudget' | 'cullingManager' | 'headless'>
    & Pick<FrameState,
        | 'staticBodies' | 'staticEntities' | 'movingPlatforms' | 'goalEffects' | 'grappleAnchors'
        | 'collectibles' | 'powerUps' | 'checkpoints'>
    & Pick<PhysicsWorld,
        | 'createStaticBox' | 'createDynamicBox' | 'createRotatingBox'
        | 'queueDecorativeBatch' | 'isStaticBatchingEnabled'>
    & Pick<ZonePhysicsMethods, 'createKinematicBox' | 'createPowerUp'>
    & Pick<ZoneThemedCreation, 'createTree'>
    & Pick<ZoneVisuals, 'createGoalEffects' | 'spawnGoalParticle'>
    & Pick<ZoneSetupEnvironment, 'applyEnvironment'>
    & Pick<ZoneInteractiveCreation, 'createGoalZone'>;
