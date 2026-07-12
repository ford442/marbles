/**
 * Single zone-type registry. Maps levels.js `zone.type` strings to setup handlers.
 *
 * Built-in handlers call methods mixed in via zones/methods (applyZoneMethods).
 * Factory handlers delegate to src/zones/<name>.js builders.
 */
import * as zones from '../zones/index.js';
import { createModelZone } from '../assets/gltf-track-loader.js';

/** @typedef {(game: object, zone: object, offset: {x:number,y:number,z:number}) => void | Promise<void>} ZoneHandler */

/** @type {Record<string, ZoneHandler>} */
const BUILTIN_ZONE_HANDLERS = {
    floor: (game, zone, offset) => game.createFloorZone(offset, zone.size, zone.rotY, zone.color),
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
    checkpoint: (game, zone, offset) => game.createCheckpointZone(offset, zone.size),
    domino: (game, _zone, offset) => game.createDominoZone(offset),
    pyramid: (game, _zone, offset) => game.createPyramidZone(offset),
    powerup: (game, _zone, offset) => game.createPowerUpZone(offset),
    moving: (game, _zone, offset) => game.createMovingZone(offset),
};

/** @type {Record<string, ZoneHandler>} */
const FACTORY_ZONE_HANDLERS = {
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
    cyber_ice_track: (game, _zone, offset) => zones.createCyberIceTrackZone(game, offset),
    neon_plunge: (game, _zone, offset) => zones.createNeonPlungeZone(game, offset),
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
    void_station: (game, _zone, offset) => zones.createVoidStationZone(game, offset),
    storm_peak: (game, _zone, offset) => zones.createStormPeakZone(game, offset),
    stellar_forge: (game, _zone, offset) => zones.createStellarForgeZone(game, offset),
};

/** @type {Record<string, ZoneHandler>} */
export const ZONE_HANDLERS = {
    ...BUILTIN_ZONE_HANDLERS,
    ...FACTORY_ZONE_HANDLERS,
};

/**
 * @param {object} game
 * @param {{ type?: string, pos?: { x?: number, y?: number, z?: number }, [key: string]: unknown }} zone
 */
export async function dispatchZone(game, zone) {
    const pos = zone.pos || { x: 0, y: 0, z: 0 };
    const offset = { x: pos.x, y: pos.y, z: pos.z };
    const handler = ZONE_HANDLERS[zone.type ?? ''];

    if (!handler) {
        console.warn(`[ZONE] Unknown zone type: ${zone.type}`);
        return;
    }

    await handler(game, zone, offset);
}
