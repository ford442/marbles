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
import { installZoneMethods } from '../../zones/methods/index.js';
import { installKnownMethods } from '../systems/method-installer.js';
import { ZoneSetupCore } from '../../zone-setup/core.js';
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
 * (frame-input.js), so recorded solutions are only valid for this marble.
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
 * @returns {any}
 */
export function createRenderStub() {
    const target = function renderStub() {};
    /** @type {any} */
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

export class HeadlessGame {
    /** @param {{ gravity?: { x: number, y: number, z: number } }} [options] */
    constructor({ gravity = { x: 0, y: -9.81, z: 0 } } = {}) {
        bindGameState(/** @type {any} */ (this), createGameState({ doc: null }));
        const stub = createRenderStub();
        const world = new RAPIER.World(gravity);
        world.timestep = DEFAULT_FIXED_STEP;
        Object.assign(this, {
            Filament: stub, engine: stub, scene: stub, material: stub,
            vb: stub, ib: stub, sphereVb: stub, sphereIb: stub,
            headless: true,
            world,
            /** Simulated seconds since the level was built. */
            simTime: 0,
        });
        Object.assign(this, {
            physicsWorld: new PhysicsWorld(/** @type {any} */ (this)),
            physicsQueries: new GamePhysicsQueries(/** @type {any} */ (this)),
        });
    }
}

installZoneMethods(HeadlessGame);
installKnownMethods(HeadlessGame, ZoneSetupCore, ['createZone']);
for (const name of PHYSICS_WORLD_METHODS) {
    /** @type {any} */ (HeadlessGame.prototype)[name] = function delegated(/** @type {unknown[]} */ ...args) {
        return this.physicsWorld[name](...args);
    };
}

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
 * @param {any} level
 * @param {{ verbose?: boolean, seed?: number }} [options]
 * @returns {Promise<HeadlessGame & Record<string, any>>}
 */
export async function buildHeadlessLevel(level, { verbose = false, seed = HEADLESS_RANDOM_SEED } = {}) {
    await initHeadlessRapier();
    const game = /** @type {any} */ (new HeadlessGame());
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
        game.world.propagateModifiedBodyPositionsToColliders();
        game.world.updateSceneQueries();
    } finally {
        Math.random = realRandom;
        restore?.();
    }
    return game;
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
 * @param {any} game
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
    const entry = { rigidBody: body, initialPos: { ...pos }, respawnPos: { ...pos }, radius: marble.radius };
    game.marbles.push(entry);
    game.playerMarble = entry;
    return entry;
}

/**
 * Animate legacy kinematic stamps the way game-loop/dynamics-tick.js does,
 * but from simulated time instead of the wall clock.
 * @param {any} game
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
 * @param {any} game
 * @param {number} steps
 * @param {{ beforeStep?: (game: any, i: number) => void, afterStep?: (game: any, i: number) => boolean | void }} [hooks]
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

/**
 * True when `p` is inside a level goal range (`goals[].range`).
 * @param {{ range: { x: number[], y: number[], z: number[] } }} goal
 * @param {{ x: number, y: number, z: number }} p
 */
export function inGoalRange(goal, p) {
    const r = goal.range;
    return p.x >= r.x[0] && p.x <= r.x[1] && p.y >= r.y[0] && p.y <= r.y[1] && p.z >= r.z[0] && p.z <= r.z[1];
}
