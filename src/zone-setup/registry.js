/**
 * Single zone-type registry. Maps level `zone.type` strings to setup handlers.
 *
 * - Built-in stamps call methods installed from the closed zones/methods maps.
 * - Factory stamps live in src/zones/<file>.js and are loaded **lazily**: the
 *   main chunk only carries this table, and a level awaits just the modules
 *   its zones reference (see preloadZoneModules).
 * - Level Format v2 primitives (box/ramp/mover/spinner/trigger) go through the
 *   single typed builder in primitives.ts.
 */
import { createModelZone } from '../assets/gltf-track-loader.js';
import { buildPrimitive, isPrimitiveType, PRIMITIVE_TYPES, toVec3 } from './primitives.ts';
import { gamePrimitiveHost } from './primitive-host.js';

/** @param {unknown} v */
const optionalVec3 = (v) => (v ? toVec3(/** @type {any} */ (v)) : undefined);

/** @typedef {(game: object, zone: object, offset: {x:number,y:number,z:number}) => void | Promise<void>} ZoneHandler */

/** @type {Record<string, ZoneHandler>} */
const BUILTIN_ZONE_HANDLERS = {
    floor: (game, zone, offset) => game.createFloorZone(offset, optionalVec3(zone.size), zone.rotY, zone.color),
    track: (game, _zone, offset) => game.createTrackZone(offset),
    landing: (game, _zone, offset) => game.createLandingZone(offset),
    jump: (game, _zone, offset) => game.createJumpZone(offset),
    slalom: (game, _zone, offset) => game.createSlalomZone(offset),
    staircase: (game, _zone, offset) => game.createStaircaseZone(offset),
    split: (game, _zone, offset) => game.createSplitZone(offset),
    forest: (game, _zone, offset) => game.createForestZone(offset),
    goal: (game, zone, offset) => game.createGoalZone(offset, zone.color),
    model: (game, zone, offset) => createModelZone(game, zone, offset),
    orchard: (game, zone, _offset) => game.createOrchardZone(zone.center, zone.radius),
    spiral: (game, _zone, offset) => game.createSpiralZone(offset),
    zigzag: (game, _zone, offset) => game.createZigZagZone(offset),
    neon_city: (game, _zone, offset) => game.createNeonCityZone(offset),
    loop: (game, _zone, offset) => game.createLoopZone(offset),
    block: (game, _zone, offset) => game.createBlockZone(offset),
    bowling: (game, _zone, offset) => game.createBowlingZone(offset),
    castle: (game, _zone, offset) => game.createCastleZone(offset),
    checkpoint: (game, zone, offset) => game.createCheckpointZone(offset, optionalVec3(zone.size)),
    collectible: (game, zone, offset) => game.createCollectiblePickup(offset, zone.collectible),
    grapple_anchor: (game, zone, offset) => game.createGrappleAnchorZone(offset, zone.grappleAnchor),
    domino: (game, _zone, offset) => game.createDominoZone(offset),
    pyramid: (game, _zone, offset) => game.createPyramidZone(offset),
    powerup: (game, _zone, offset) => game.createPowerUpZone(offset),
    moving: (game, _zone, offset) => game.createMovingZone(offset),
};

/** @type {Record<string, ZoneHandler>} */
const OLD_FACTORY_ZONE_HANDLERS = {
    pinwheel_alley: (game, _zone, offset) => zones.createPinwheelAlleyZone(game, offset),
    plinko: (game, _zone, offset) => zones.createPlinkoZone(game, offset),
    plinko_obstacle: (game, _zone, offset) => zones.createPlinkoObstacleZone(game, offset),
    space_station: (game, _zone, offset) => zones.createSpaceStationZone(game, offset),
    skate_park: (game, _zone, offset) => zones.createSkateParkZone(game, offset),
    helix: (game, _zone, offset) => zones.createHelixZone(game, offset),
    pinball: (game, _zone, offset) => zones.createPinballZone(game, offset),
    clockwork: (game, _zone, offset) => zones.createClockworkZone(game, offset),
    bumper_arena: (game, _zone, offset) => zones.createBumperArenaZone(game, offset),
    canyon_run: (game, _zone, offset) => zones.createCanyonRunZone(game, offset),
    volcano: (game, _zone, offset) => zones.createVolcanoZone(game, offset),
    mushroom_bounce: (game, _zone, offset) => zones.createMushroomBounceZone(game, offset),
    wind_tunnel: (game, _zone, offset) => zones.createWindTunnelZone(game, offset),
    cyber_track: (game, _zone, offset) => zones.createCyberTrackZone(game, offset),
    water_slide: (game, _zone, offset) => zones.createWaterSlideZone(game, offset),
    grapple_course: (game, _zone, offset) => zones.createGrappleCourseZone(game, offset),
    ice_cave: (game, _zone, offset) => zones.createIceCaveZone(game, offset),
    antigravity: (game, _zone, offset) => zones.createAntigravityZone(game, offset),
    trampoline_park: (game, _zone, offset) => zones.createTrampolineParkZone(game, offset),
    space_elevator: (game, _zone, offset) => zones.createSpaceElevatorZone(game, offset),
    mystic_forest: (game, _zone, offset) => zones.createMysticForestZone(game, offset),
    cloud_city: (game, _zone, offset) => zones.createCloudCityZone(game, offset),
    desert_ruins: (game, _zone, offset) => zones.createDesertRuinsZone(game, offset),
    neon_grid: (game, _zone, offset) => zones.createNeonGridZone(game, offset),
    ice_bridges: (game, _zone, offset) => zones.createIceBridgesZone(game, offset),
    jungle_run: (game, _zone, offset) => zones.createJungleRunZone(game, offset),
    lava_tubes: (game, _zone, offset) => zones.createLavaTubesZone(game, offset),
    quantum_leap: (game, _zone, offset) => zones.createQuantumLeapZone(game, offset),
    frostbite_cavern: (game, _zone, offset) => zones.createFrostbiteCavernZone(game, offset),
    magnetic_canyon: (game, _zone, offset) => zones.createMagneticCanyonZone(game, offset),
    magnetic_cavern: (game, _zone, offset) => zones.createMagneticCavernZone(game, offset),
    gravity_well: (game, _zone, offset) => zones.createGravityWellZone(game, offset),
    crystal_cavern: (game, _zone, offset) => zones.createCrystalCavernZone(game, offset),
    cyber_ice_track: (game, _zone, offset) => zones.createCyberIceTrackZone(game, offset),
    cyber_reactor: (game, _zone, offset) => zones.createCyberReactorZone(game, offset),
    neon_plunge: (game, _zone, offset) => zones.createNeonPlungeZone(game, offset),
    neon_vortex: (game, _zone, offset) => zones.createNeonVortexZone(game, offset),
    prismatic_speedway: (game, _zone, offset) => zones.createPrismaticSpeedwayZone(game, offset),
    neon_alley: (game, _zone, offset) => zones.createNeonAlleyZone(game, offset),
    chrono_canyon: (game, _zone, offset) => zones.createChronoCanyonZone(game, offset),
    synthwave_surge: (game, _zone, offset) => zones.createSynthwaveSurgeZone(game, offset),
    meteorite_hollow: (game, _zone, offset) => zones.createMeteoriteHollowZone(game, offset),
    radiant_reactor: (game, _zone, offset) => zones.createRadiantReactorZone(game, offset),
    plasma_pipeline: (game, _zone, offset) => zones.createPlasmaPipelineZone(game, offset),
    starlight_ascent: (game, _zone, offset) => zones.createStarlightAscentZone(game, offset),
    zen_garden: (game, _zone, offset) => zones.createZenGardenZone(game, offset),
    toxic_swamp: (game, _zone, offset) => zones.createToxicSwampZone(game, offset),
    galaxy_spiral: (game, _zone, offset) => zones.createGalaxySpiralZone(game, offset),
    glacial_chasm: (game, _zone, offset) => zones.createGlacialChasmZone(game, offset),
    neon_pulse_grid: (game, _zone, offset) => zones.createNeonPulseGridZone(game, offset),
    nebula_nexus: (game, _zone, offset) => zones.createNebulaNexusZone(game, offset),
    quantum_tunnel: (game, _zone, offset) => zones.createQuantumTunnelZone(game, offset),
    abyssal_trench: (game, _zone, offset) => zones.createAbyssalTrenchZone(game, offset),
    aether_core: (game, _zone, offset) => zones.createAetherCoreZone(game, offset),
    void_station: (game, _zone, offset) => zones.createVoidStationZone(game, offset),
    storm_peak: (game, _zone, offset) => zones.createStormPeakZone(game, offset),
    neon_pipeline: (game, _zone, offset) => zones.createNeonPipelineZone(game, offset),
    stellar_forge: (game, _zone, offset) => zones.createStellarForgeZone(game, offset),
    inferno_chamber: (game, _zone, offset) => zones.createInfernoChamberZone(game, offset),
    astral_cascade: (game, _zone, offset) => zones.createAstralCascadeZone(game, offset),
    neon_drift: (game, _zone, offset) => zones.createNeonDriftZone(game, offset),
    cyber_matrix: (game, _zone, offset) => zones.createCyberMatrixZone(game, offset),
    neon_city_heights: (game, _zone, offset) => zones.createNeonCityHeightsZone(game, offset),
    neon_pulse_matrix: (game, _zone, offset) => zones.createNeonPulseMatrixZone(game, offset),
    quantum_core: (game, _zone, offset) => zones.createQuantumCoreZone(game, offset),
    neon_hologram: (game, _zone, offset) => zones.createNeonHologramZone(game, offset),
};

/**
 * Factory stamp type → [module basename in src/zones/, exported builder].
 * The builder is called as `builder(game, offset)`.
 * @type {Record<string, readonly [string, string]>}
 */
export const FACTORY_ZONES = {
    pinwheel_alley: ['pinwheel-alley', 'createPinwheelAlleyZone'],
    plinko: ['plinko-zone', 'createPlinkoZone'],
    plinko_obstacle: ['plinko-obstacle-zone', 'createPlinkoObstacleZone'],
    space_station: ['space-station', 'createSpaceStationZone'],
    skate_park: ['skate-park', 'createSkateParkZone'],
    helix: ['helix-zone', 'createHelixZone'],
    pinball: ['pinball-zone', 'createPinballZone'],
    clockwork: ['clockwork-zone', 'createClockworkZone'],
    bumper_arena: ['bumper-arena', 'createBumperArenaZone'],
    canyon_run: ['canyon-run', 'createCanyonRunZone'],
    volcano: ['volcano-zone', 'createVolcanoZone'],
    mushroom_bounce: ['mushroom-bounce-zone', 'createMushroomBounceZone'],
    wind_tunnel: ['wind-tunnel-zone', 'createWindTunnelZone'],
    cyber_track: ['cyber-track-zone', 'createCyberTrackZone'],
    water_slide: ['water-slide-zone', 'createWaterSlideZone'],
    grapple_course: ['grapple-course-zone', 'createGrappleCourseZone'],
    ice_cave: ['ice-cave-zone', 'createIceCaveZone'],
    antigravity: ['antigravity-zone', 'createAntigravityZone'],
    trampoline_park: ['trampoline-park', 'createTrampolineParkZone'],
    space_elevator: ['space-elevator', 'createSpaceElevatorZone'],
    mystic_forest: ['mystic-forest', 'createMysticForestZone'],
    cloud_city: ['cloud-city', 'createCloudCityZone'],
    desert_ruins: ['desert-ruins', 'createDesertRuinsZone'],
    neon_grid: ['neon-grid', 'createNeonGridZone'],
    ice_bridges: ['ice-bridges', 'createIceBridgesZone'],
    jungle_run: ['jungle-run', 'createJungleRunZone'],
    lava_tubes: ['lava-tubes', 'createLavaTubesZone'],
    quantum_leap: ['quantum-leap', 'createQuantumLeapZone'],
    frostbite_cavern: ['frostbite-cavern', 'createFrostbiteCavernZone'],
    magnetic_canyon: ['magnetic-canyon', 'createMagneticCanyonZone'],
    magnetic_cavern: ['magnetic-cavern', 'createMagneticCavernZone'],
    gravity_well: ['gravity-well', 'createGravityWellZone'],
    cyber_ice_track: ['cyber-ice-track', 'createCyberIceTrackZone'],
    neon_plunge: ['neon-plunge', 'createNeonPlungeZone'],
    prismatic_speedway: ['prismatic-speedway', 'createPrismaticSpeedwayZone'],
    neon_alley: ['neon-alley', 'createNeonAlleyZone'],
    chrono_canyon: ['chrono-canyon', 'createChronoCanyonZone'],
    synthwave_surge: ['synthwave-surge', 'createSynthwaveSurgeZone'],
    meteorite_hollow: ['meteorite-hollow', 'createMeteoriteHollowZone'],
    radiant_reactor: ['radiant-reactor', 'createRadiantReactorZone'],
    plasma_pipeline: ['plasma-pipeline', 'createPlasmaPipelineZone'],
    starlight_ascent: ['starlight-ascent', 'createStarlightAscentZone'],
    zen_garden: ['zen-garden', 'createZenGardenZone'],
    toxic_swamp: ['toxic-swamp', 'createToxicSwampZone'],
    galaxy_spiral: ['galaxy-spiral', 'createGalaxySpiralZone'],
    glacial_chasm: ['glacial-chasm', 'createGlacialChasmZone'],
    neon_pulse_grid: ['neon-pulse-grid', 'createNeonPulseGridZone'],
    nebula_nexus: ['nebula-nexus', 'createNebulaNexusZone'],
    quantum_tunnel: ['quantum-tunnel', 'createQuantumTunnelZone'],
    void_station: ['void-station', 'createVoidStationZone'],
    neon_pipeline: ['neon-pipeline', 'createNeonPipelineZone'],
    cyber_matrix: ['cyber-matrix', 'createCyberMatrixZone'],
};

/**
 * Lazy module loaders, one chunk per zone file. A template-literal import
 * (rather than import.meta.glob) so the same table works under Vite and in
 * Node (headless level harness, scripts).
 * @type {Record<string, () => Promise<Record<string, unknown>>>}
 */
export const ZONE_LOADERS = Object.fromEntries(
    Object.entries(FACTORY_ZONES).map(([type, [file]]) => [type, () => import(`../zones/${file}.js`)]),
);

/** @param {string} type */
async function loadFactoryBuilder(type) {
    const [, exportName] = FACTORY_ZONES[type];
    const mod = await ZONE_LOADERS[type]();
    const builder = mod[exportName];
    if (typeof builder !== 'function') {
        throw new Error(`[ZONE] ${type}: src/zones/${FACTORY_ZONES[type][0]}.js does not export ${exportName}`);
    }
    return /** @type {(game: object, offset: {x:number,y:number,z:number}) => void | Promise<void>} */ (builder);
}

/** @type {Record<string, ZoneHandler>} */
const DYNAMIC_FACTORY_ZONE_HANDLERS = Object.fromEntries(
    Object.keys(FACTORY_ZONES).map((type) => [
        type,
        /** @type {ZoneHandler} */ (async (game, _zone, offset) => (await loadFactoryBuilder(type))(game, offset)),
    ]),
);

/** @type {Record<string, ZoneHandler>} */
const PRIMITIVE_ZONE_HANDLERS = Object.fromEntries(
    PRIMITIVE_TYPES.map((type) => [
        type,
        /** @type {ZoneHandler} */ ((game, zone) => { buildPrimitive(gamePrimitiveHost(game), /** @type {any} */ (zone)); }),
    ]),
);

/** @type {Record<string, ZoneHandler>} */
export const ZONE_HANDLERS = {
    ...BUILTIN_ZONE_HANDLERS,
    ...OLD_FACTORY_ZONE_HANDLERS,
    ...DYNAMIC_FACTORY_ZONE_HANDLERS,
    ...PRIMITIVE_ZONE_HANDLERS,
};

/** Every registered zone.type, sorted (zone-handlers.json is generated from this). */
export const ZONE_TYPES = Object.keys(ZONE_HANDLERS).sort();

/**
 * Await the lazy modules for every factory stamp a level references, in
 * parallel, before zones are built in order.
 * @param {Array<{ type?: string }>} zones
 */
export async function preloadZoneModules(zones) {
    const types = new Set(zones.map((z) => z?.type).filter((t) => t && t in ZONE_LOADERS));
    await Promise.all([...types].map((t) => ZONE_LOADERS[/** @type {string} */ (t)]()));
}

/**
 * @param {object} game
 * @param {{ type?: string, pos?: unknown, [key: string]: unknown }} zone
 */
export async function dispatchZone(game, zone) {
    const handler = ZONE_HANDLERS[zone.type ?? ''];

    if (!handler) {
        console.warn(`[ZONE] Unknown zone type: ${zone.type}`);
        return;
    }

    // v2 maps may write positions as [x, y, z]; stamps always get {x, y, z}.
    const offset = isPrimitiveType(zone.type) ? { x: 0, y: 0, z: 0 } : toVec3(/** @type {any} */ (zone.pos));
    await handler(game, zone, offset);
}
