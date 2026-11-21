// @ts-check
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

/** @typedef {import('../types/geometry.ts').Vec3} Vec3 */
/** @typedef {import('./primitives.ts').Vec3Input} Vec3Input */
/** @typedef {import('../types/map.ts').MapZoneDefinition} MapZoneDefinition */
/** @typedef {import('../types/map.ts').NormalizedZoneDefinition} NormalizedZoneDefinition */
/** @typedef {import('../types/map.ts').PrimitiveZoneDefinition} PrimitiveZoneDefinition */

/**
 * A zone as `dispatchZone` receives it: authored (`[x, y, z]` vectors allowed)
 * or normalized by map-normalize.
 * @typedef {MapZoneDefinition | NormalizedZoneDefinition} DispatchZone
 */
/** @typedef {Exclude<DispatchZone, PrimitiveZoneDefinition>} StampZoneInput */

/**
 * What the zone handlers call on the game: the built-in stamp builders
 * (`zones/methods/*`), the model loader, the v2 primitive adapter and the
 * lazily loaded factory builders (`ZoneBuildHost`).
 * @typedef {Pick<import('../zones/methods/track-creation.ts').ZoneTrackCreation,
 *     | 'createFloorZone' | 'createTrackZone' | 'createLandingZone' | 'createJumpZone' | 'createSlalomZone'
 *     | 'createStaircaseZone' | 'createSplitZone' | 'createSpiralZone' | 'createZigZagZone' | 'createLoopZone'
 *     | 'createBlockZone' | 'createMovingZone'>
 *   & Pick<import('../zones/methods/themed-creation.ts').ZoneThemedCreation,
 *     | 'createForestZone' | 'createOrchardZone' | 'createNeonCityZone' | 'createBowlingZone' | 'createCastleZone'
 *     | 'createDominoZone' | 'createPyramidZone'>
 *   & Pick<import('../zones/methods/interactive-creation.ts').ZoneInteractiveCreation,
 *     | 'createGoalZone' | 'createCheckpointZone' | 'createCollectiblePickup' | 'createGrappleAnchorZone'
 *     | 'createPowerUpZone'>
 *   & import('../assets/gltf-track-loader.js').ModelZoneHost
 *   & import('./primitive-host.js').GamePrimitiveSource
 *   & import('../types/zone-host.ts').ZoneBuildHost} ZoneDispatchHost
 */

/** @typedef {(game: ZoneDispatchHost, zone: StampZoneInput, offset: Vec3) => void | Promise<void>} ZoneHandler */
/** @typedef {(game: ZoneDispatchHost, zone: PrimitiveZoneDefinition) => void} PrimitiveZoneHandler */
/** @typedef {(game: import('../types/zone-host.ts').ZoneBuildHost, offset: Vec3) => void | Promise<void>} FactoryZoneBuilder */

/**
 * @param {Vec3Input | undefined} v
 * @returns {Vec3 | undefined}
 */
const optionalVec3 = (v) => (v ? toVec3(v) : undefined);

/**
 * An open stamp field that must be a vector (`orchard.center`), as `{x, y, z}`
 * or `[x, y, z]`.
 * @param {unknown} v
 * @param {string} label
 * @returns {Vec3}
 */
function requireVec3(v, label) {
    if (Array.isArray(v)) return { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) };
    if (typeof v === 'object' && v !== null && 'x' in v && 'y' in v && 'z' in v
        && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
        return { x: v.x, y: v.y, z: v.z };
    }
    throw new TypeError(`[ZONE] ${label} must be a vector`);
}

/** @param {unknown} v */
const optionalNumber = (v) => (typeof v === 'number' ? v : undefined);

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
    orchard: (game, zone, _offset) => game.createOrchardZone(requireVec3(zone['center'], 'orchard.center'), optionalNumber(zone['radius'])),
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
    neon_hologram: ['neon-hologram', 'createNeonHologramZone'],
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

/**
 * @param {string} type
 * @returns {Promise<FactoryZoneBuilder>}
 */
async function loadFactoryBuilder(type) {
    const entry = FACTORY_ZONES[type];
    const load = ZONE_LOADERS[type];
    if (!entry || !load) throw new Error(`[ZONE] ${type} is not a factory zone`);
    const [file, exportName] = entry;
    const mod = await load();
    const builder = mod[exportName];
    if (typeof builder !== 'function') {
        throw new Error(`[ZONE] ${type}: src/zones/${file}.js does not export ${exportName}`);
    }
    // Module boundary: the export was checked to be a function above.
    return /** @type {FactoryZoneBuilder} */ (builder);
}

/** @type {Record<string, ZoneHandler>} */
const FACTORY_ZONE_HANDLERS = Object.fromEntries(
    Object.keys(FACTORY_ZONES).map((type) => [
        type,
        /** @type {ZoneHandler} */ (async (game, _zone, offset) => (await loadFactoryBuilder(type))(game, offset)),
    ]),
);

/** @type {Record<string, PrimitiveZoneHandler>} */
const PRIMITIVE_ZONE_HANDLERS = Object.fromEntries(
    PRIMITIVE_TYPES.map((type) => [
        type,
        /** @type {PrimitiveZoneHandler} */ ((game, zone) => { buildPrimitive(gamePrimitiveHost(game), zone); }),
    ]),
);

/** Stamp handlers (built-in + lazy factory), keyed by `zone.type`. */
const STAMP_ZONE_HANDLERS = { ...BUILTIN_ZONE_HANDLERS, ...FACTORY_ZONE_HANDLERS };

/** @type {Record<string, ZoneHandler | PrimitiveZoneHandler>} */
export const ZONE_HANDLERS = {
    ...STAMP_ZONE_HANDLERS,
    ...PRIMITIVE_ZONE_HANDLERS,
};

/** Every registered zone.type, sorted (zone-handlers.json is generated from this). */
export const ZONE_TYPES = Object.keys(ZONE_HANDLERS).sort();

/**
 * Await the lazy modules for every factory stamp a level references, in
 * parallel, before zones are built in order.
 * @param {Array<{ type?: string } | null | undefined>} zones
 */
export async function preloadZoneModules(zones) {
    /** @type {Set<string>} */
    const types = new Set();
    for (const z of zones) {
        const t = z?.type;
        if (t && t in ZONE_LOADERS) types.add(t);
    }
    await Promise.all([...types].map((t) => ZONE_LOADERS[t]?.()));
}

/**
 * @param {DispatchZone} zone
 * @returns {zone is PrimitiveZoneDefinition}
 */
function isPrimitiveZone(zone) {
    return isPrimitiveType(zone.type);
}

/**
 * @param {ZoneDispatchHost} game
 * @param {DispatchZone} zone
 */
export async function dispatchZone(game, zone) {
    if (isPrimitiveZone(zone)) {
        PRIMITIVE_ZONE_HANDLERS[zone.type]?.(game, zone);
        return;
    }

    const handler = STAMP_ZONE_HANDLERS[zone.type ?? ''];

    if (!handler) {
        console.warn(`[ZONE] Unknown zone type: ${zone.type}`);
        return;
    }

    // v2 maps may write positions as [x, y, z]; stamps always get {x, y, z}.
    await handler(game, zone, toVec3(zone.pos));
}
