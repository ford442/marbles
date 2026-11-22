// @ts-check
/**
 * Headless level host: builds a level's real zone code (built-in stamps,
 * lazy factory zones and v2 primitives) into a real Rapier world with
 * Filament stubbed out, then steps it at the fixed physics step.
 *
 * Used by the completability harness (tests/levels/) and intended for
 * server-side ghost / race verification (#438): one code path decides whether
 * a level can be finished.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { createGameState, bindGameState } from '../state/index.js';
import { ZONE_METHOD_SLICES } from '../../zones/methods/index.ts';
import { ZoneSetupCore } from '../../zone-setup/core.ts';
import {
    composeSlices, defineSlice, forwardMethods, forwardSliceMethods,
} from '../systems/slice-composition.ts';
import { PhysicsWorld } from '../systems/physics-world.ts';
import { GamePhysicsQueries } from '../systems/physics-queries.ts';
import { DEFAULT_FIXED_STEP } from '../systems/fixed-step-clock.ts';
import { preloadZoneModules } from '../../zone-setup/registry.js';
import { quatFromYawPitchRoll } from '../../math.ts';

/** Marbles below this height are respawned in-game (game-logic/core.js). */
export const KILL_PLANE_Y = -20;

/**
 * Reference marble for completability: the default-unlocked starter
 * (assets/marbles/classic_red.json). Held-key movement is a raw impulse
 * (frame-input.ts), so recorded solutions are only valid for this marble.
 */
export const REFERENCE_MARBLE = Object.freeze({
    radius: 0.5, friction: 0.015, restitution: 0.8, density: 1.5, linearDamping: 0.08, angularDamping: 0.08,
});

let rapierReady = /** @type {Promise<void> | null} */ (null);
export function initHeadlessRapier() {
    rapierReady ??= RAPIER.init();
    return rapierReady;
}

/**
 * A callable, infinitely chainable no-op standing in for Filament, the
 * engine, scene, materials and buffers. Every property and call returns the
 * stub; it is not thenable and coerces to 0.
 * @returns {import('../../types/filament.ts').FilamentHandle}
 */
export function createRenderStub() {
    const target = function renderStub() {};
    /** @type {import('../../types/filament.ts').FilamentHandle} */
    const stub = new Proxy(target, {
        get(_t, prop) {
            if (prop === 'then') return undefined;
            if (prop === Symbol.toPrimitive) return () => 0;
            if (prop === Symbol.iterator) return function* empty() {};
            return stub;
        },
        apply() { return stub; },
        construct() { return stub; },
    });
    return stub;
}

const PHYSICS_WORLD_METHODS = [
    'isStaticBatchingEnabled', 'resolveStaticSurfacePreset', 'getStaticBatchKey',
    'createStaticMaterialInstance', 'queueStaticBoxBatch', 'getDecorativeBatchKey',
    'queueDecorativeBatch', 'queueDecorativeBoxes', 'flushDecorativeBatches',
    'createPhaseBox', 'createStaticBox', 'createDynamicBox', 'createRotatingBox',
];

/**
 * What the zone-building slices are constructed against.
 * @typedef {import('../../zones/methods/index.ts').ZoneMethodSlicesHost
 *   & import('../../zone-setup/core.ts').ZoneSetupCoreHost} HeadlessSliceHost
 */

/**
 * The zone-building slices a level build needs: zone methods plus `createZone`.
 * @type {import('../systems/slice-composition.ts').SliceSpec<HeadlessSliceHost>[]}
 */
const HEADLESS_SLICES = [
    ...ZONE_METHOD_SLICES,
    defineSlice('zoneSetupCoreSlice', ZoneSetupCore, ['createZone']),
];

/**
 * A reference marble (`spawnReferenceMarble`): the only marbles a headless
 * level ever holds.
 * @typedef {object} HeadlessMarble
 * @property {RAPIER.RigidBody} rigidBody
 * @property {import('../../types/geometry.ts').Vec3} initialPos
 * @property {import('../../types/geometry.ts').Vec3} respawnPos
 * @property {number} radius
 */

/**
 * A built headless level as the harness and the checks use it: the members
 * `HeadlessGame` assigns, the grouped state `bindGameState` mirrors onto it,
 * and the methods forwarded to its slices / `physicsWorld`.
 * @typedef {HeadlessGame
 *   & Pick<import('../../types/frame-host.ts').FrameState, 'movingPlatforms' | 'rotatingPlatforms'>
 *   & Pick<import('../../zone-setup/core.ts').ZoneSetupCore, 'createZone'>
 *   & {
 *     marbles: HeadlessMarble[],
 *     playerMarble: HeadlessMarble | null,
 *     zoneScope?: import('../../zone-setup/primitives.ts').ZoneScope | null,
 *   }} HeadlessLevel
 */

export class HeadlessGame {
    /** @param {{ gravity?: { x: number, y: number, z: number } }} [options] */
    constructor({ gravity = { x: 0, y: -9.81, z: 0 } } = {}) {
        bindGameState(this, createGameState({ doc: null }));
        // Composition boundary: the grouped state is mirrored onto `this` above,
        // the engine handles below are render stubs, and the slice methods are
        // forwarded on the prototype, so `this` stands in for the full
        // zone-build host (GPU-side services such as the effect pool stay unset).
        composeSlices(/** @type {HeadlessSliceHost} */ (/** @type {unknown} */ (this)), HEADLESS_SLICES);
        const stub = createRenderStub();
        const world = new RAPIER.World(gravity);
        world.timestep = DEFAULT_FIXED_STEP;
        /** @type {import('../../types/filament.ts').FilamentModule} */
        this.Filament = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.engine = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.scene = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.material = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.vb = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.ib = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.sphereVb = stub;
        /** @type {import('../../types/filament.ts').FilamentHandle} */
        this.sphereIb = stub;
        /** @type {true} */
        this.headless = true;
        this.world = world;
        /** Simulated seconds since the level was built. */
        this.simTime = 0;
        // Same boundary as above: `PhysicsWorld` reads the mirrored state lists.
        const physicsWorld = new PhysicsWorld(/** @type {import('../systems/physics-world.ts').PhysicsWorldHost} */ (/** @type {unknown} */ (this)));
        const physicsQueries = new GamePhysicsQueries(this);
        this.physicsWorld = physicsWorld;
        this.physicsQueries = physicsQueries;
    }
}

forwardSliceMethods(HeadlessGame, HEADLESS_SLICES);
forwardMethods(HeadlessGame, 'physicsWorld', PHYSICS_WORLD_METHODS);

/** Seed for the deterministic `Math.random` used while zones build. */
export const HEADLESS_RANDOM_SEED = 0x5eed;

/**
 * mulberry32: a small deterministic PRNG with Math.random's contract.
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Build every zone of a runtime level (see map-normalize.js / DEV_LEVELS).
 * Console noise from zone builders is silenced unless `verbose`.
 * Some zones randomise their layout (castle, trampoline park, gravity well…),
 * so `Math.random` is seeded during the build: every build of a level is
 * identical and a recorded `solution` replays exactly. In game those layouts
 * still vary, so a solution there proves the seeded layout is finishable.
 * @param {{ zones?: import('../../zone-setup/registry.js').DispatchZone[] | null }} level
 * @param {{ verbose?: boolean, seed?: number }} [options]
 * @returns {Promise<HeadlessLevel>}
 */
export async function buildHeadlessLevel(level, { verbose = false, seed = HEADLESS_RANDOM_SEED } = {}) {
    await initHeadlessRapier();
    const game = /** @type {HeadlessLevel} */ (new HeadlessGame());
    const restore = verbose ? null : muteConsole();
    const realRandom = Math.random;
    Math.random = seededRandom(seed);
    try {
        await preloadZoneModules(level.zones || []);
        for (const zone of level.zones || []) {
            await game.createZone(zone);
        }
        game.physicsWorld.flushStaticBatches?.();
        // Static checks ray-cast before the first step.
        refreshSceneQueries(game.world);
    } finally {
        Math.random = realRandom;
        restore?.();
    }
    return game;
}

/**
 * Make ray casts see colliders created since the last step. Rapier's scene
 * queries read the broad-phase BVH, which only `step()` rebuilds (0.13's
 * `updateSceneQueries()` is gone), so run one zero-length step: poses and
 * velocities are untouched and later steps follow the same trajectory.
 * @param {RAPIER.World} world
 */
export function refreshSceneQueries(world) {
    const dt = world.timestep;
    world.timestep = 0;
    try {
        world.step();
    } finally {
        world.timestep = dt;
    }
}

function muteConsole() {
    const saved = { log: console.log, warn: console.warn, info: console.info };
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    return () => Object.assign(console, saved);
}

/**
 * Drop a reference marble at `pos`.
 * @param {HeadlessLevel} game
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ radius: number, friction: number, restitution: number, density: number, linearDamping?: number, angularDamping?: number }} [marble]
 */
export function spawnReferenceMarble(game, pos, marble = REFERENCE_MARBLE) {
    const body = game.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setLinearDamping(marble.linearDamping ?? 0)
            .setAngularDamping(marble.angularDamping ?? 0)
            .setCanSleep(false)
            .setCcdEnabled(true),
    );
    game.world.createCollider(
        RAPIER.ColliderDesc.ball(marble.radius)
            .setFriction(marble.friction)
            .setRestitution(marble.restitution)
            .setDensity(marble.density),
        body,
    );
    /** @type {HeadlessMarble} */
    const entry = { rigidBody: body, initialPos: { ...pos }, respawnPos: { ...pos }, radius: marble.radius };
    game.marbles.push(entry);
    game.playerMarble = entry;
    return entry;
}

/**
 * Animate legacy kinematic stamps the way game-loop/dynamics-tick.js does,
 * but from simulated time instead of the wall clock.
 * @param {HeadlessLevel} game
 */
function tickLegacyPlatforms(game) {
    const t = game.simTime;
    for (const p of game.movingPlatforms) {
        let { x, y, z } = p.initialPos;
        const off = Math.sin(t * p.speed) * p.amplitude;
        if (p.type === 'horizontal') x = p.center + off;
        if (p.type === 'vertical') y = p.center + off;
        if (p.type === 'depth') z = p.center + off;
        p.rigidBody.setNextKinematicTranslation({ x, y, z });
    }
    for (const p of game.rotatingPlatforms) {
        // createRotatingBox's speed is radians per 60 Hz frame.
        p.angle += p.speed * (DEFAULT_FIXED_STEP * 60);
        p.rigidBody.setNextKinematicRotation(quatFromYawPitchRoll({ yaw: p.angle }));
    }
}

/**
 * Advance the level by `steps` fixed steps. `beforeStep(game, i)` can apply
 * input; `afterStep(game, i)` returning `true` stops early.
 * @param {HeadlessLevel} game
 * @param {number} steps
 * @param {{ beforeStep?: (game: HeadlessLevel, i: number) => void, afterStep?: (game: HeadlessLevel, i: number) => boolean | void }} [hooks]
 * @returns {number} steps actually taken
 */
export function stepHeadless(game, steps, { beforeStep, afterStep } = {}) {
    const dt = DEFAULT_FIXED_STEP;
    for (let i = 0; i < steps; i++) {
        beforeStep?.(game, i);
        tickLegacyPlatforms(game);
        game.zoneScope?.tick(game, dt);
        game.world.timestep = dt;
        game.world.step();
        game.simTime += dt;
        if (afterStep?.(game, i)) return i + 1;
    }
    return steps;
}

/** @param {{ x: number, y: number, z: number }} v */
export function isFiniteVec(v) {
    return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** @typedef {{ x: readonly [number, number], y: readonly [number, number], z: readonly [number, number] }} GoalRange */

/**
 * True when `p` is inside a level goal range (`goals[].range`).
 * @param {{ range: GoalRange }} goal
 * @param {{ x: number, y: number, z: number }} p
 */
export function inGoalRange(goal, p) {
    const r = goal.range;
    return p.x >= r.x[0] && p.x <= r.x[1] && p.y >= r.y[0] && p.y <= r.y[1] && p.z >= r.z[0] && p.z <= r.z[1];
}
