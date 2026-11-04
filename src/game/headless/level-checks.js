// @ts-check
/**
 * Level completability checks over a headless-built level
 * (headless-level.js). Pure reporting: each check returns problem strings;
 * tests/levels/ decides which levels must be clean.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import {
    KILL_PLANE_Y, isFiniteVec, inGoalRange, spawnReferenceMarble, stepHeadless,
} from './headless-level.js';
import { applyVelocityChange } from '../systems/body-impulse.ts';
import { JUMP_DV_MAX, JUMP_DV_MIN } from '../../abilities/movement-tuning.js';
import { DEFAULT_FIXED_STEP } from '../systems/fixed-step-clock.ts';

/** Spawn must have ground within this distance straight below it. */
export const SPAWN_GROUND_MAX_DIST = 30;
/** A goal range is "floating" when nothing is within this far below it. */
export const GOAL_SUPPORT_MAX_DROP = 6;
/** Reachability smoke length (10 s at the fixed step). */
export const SMOKE_STEPS = 600;
/** The marble must rest/roll on geometry this long before any fall. */
export const SMOKE_MIN_GROUNDED_STEPS = 60;
/** Without declared bounds, nothing may sit further than this from the origin. */
export const DEFAULT_WORLD_LIMIT = 5000;

const DOWN = { x: 0, y: -1, z: 0 };

/** @param {{ x: number, y: number, z: number, w: number }} q */
function isFiniteQuat(q) {
    return [q.x, q.y, q.z, q.w].every(Number.isFinite);
}

/**
 * World-space AABB of a cuboid or ball collider (others: null).
 * @param {RAPIER.Collider} c
 * @returns {{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } } | null}
 */
export function colliderAabb(c) {
    const t = c.translation();
    const shape = /** @type {any} */ (c.shape);
    if (shape.type === RAPIER.ShapeType.Ball) {
        const r = shape.radius;
        return { min: { x: t.x - r, y: t.y - r, z: t.z - r }, max: { x: t.x + r, y: t.y + r, z: t.z + r } };
    }
    if (shape.type !== RAPIER.ShapeType.Cuboid) return null;
    const h = shape.halfExtents;
    const q = c.rotation();
    // |R|·h — rotation matrix rows from the quaternion.
    const xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z;
    const xy = q.x * q.y, xz = q.x * q.z, yz = q.y * q.z;
    const wx = q.w * q.x, wy = q.w * q.y, wz = q.w * q.z;
    const r = [
        [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
    ];
    const e = r.map((row) => Math.abs(row[0]) * h.x + Math.abs(row[1]) * h.y + Math.abs(row[2]) * h.z);
    return { min: { x: t.x - e[0], y: t.y - e[1], z: t.z - e[2] }, max: { x: t.x + e[0], y: t.y + e[1], z: t.z + e[2] } };
}

/**
 * @param {any} game
 * @returns {string[]}
 */
export function checkFiniteBodies(game) {
    /** @type {string[]} */
    const problems = [];
    game.world.colliders.forEach((/** @type {RAPIER.Collider} */ c) => {
        const t = c.translation();
        const q = c.rotation();
        const shape = /** @type {any} */ (c.shape);
        const where = `collider ${c.handle} at (${t.x}, ${t.y}, ${t.z})`;
        if (!isFiniteVec(t)) problems.push(`${where}: non-finite position`);
        if (!isFiniteQuat(q)) problems.push(`${where}: non-finite rotation`);
        if (shape.type === RAPIER.ShapeType.Cuboid) {
            const h = shape.halfExtents;
            if (!isFiniteVec(h) || !(h.x > 0 && h.y > 0 && h.z > 0)) {
                problems.push(`${where}: invalid half-extents (${h.x}, ${h.y}, ${h.z})`);
            }
        } else if (shape.type === RAPIER.ShapeType.Ball && !(Number.isFinite(shape.radius) && shape.radius > 0)) {
            problems.push(`${where}: invalid radius ${shape.radius}`);
        }
    });
    if (game.world.colliders.len() === 0) problems.push('level built no colliders');
    return problems;
}

/**
 * @param {any} game
 * @param {{ x: number, y: number, z: number }} origin
 * @param {number} maxDist
 */
function solidBelow(game, origin, maxDist) {
    return game.physicsQueries.castRay(origin, DOWN, maxDist, { excludeSensors: true });
}

/**
 * @param {any} game
 * @param {any} level runtime level
 * @returns {string[]}
 */
export function checkSpawnAndGoals(game, level) {
    /** @type {string[]} */
    const problems = [];
    const spawn = level.spawn;
    if (!spawn || !isFiniteVec(spawn)) return ['spawn is missing or non-finite'];

    const ground = solidBelow(game, spawn, SPAWN_GROUND_MAX_DIST);
    if (!ground) problems.push(`no ground within ${SPAWN_GROUND_MAX_DIST} m below spawn (${spawn.x}, ${spawn.y}, ${spawn.z})`);

    const goals = level.goals || [];
    if (goals.length === 0 && !level.goalless) problems.push('level has no goals (set "goalless": true for free-roam maps)');
    for (const goal of goals) {
        const r = goal.range;
        if (inGoalRange({ range: { x: [r.x[0] - 0.5, r.x[1] + 0.5], y: [r.y[0] - 0.5, r.y[1] + 0.5], z: [r.z[0] - 0.5, r.z[1] + 0.5] } }, spawn)) {
            problems.push(`goal ${goal.id} overlaps the spawn`);
        }
        // Supported if any of a 3×3 grid of rays from the range's top finds
        // geometry inside the range or within GOAL_SUPPORT_MAX_DROP below it.
        const depth = (r.y[1] - r.y[0]) + GOAL_SUPPORT_MAX_DROP;
        let supported = false;
        for (const fx of [0.15, 0.5, 0.85]) {
            for (const fz of [0.15, 0.5, 0.85]) {
                const o = { x: r.x[0] + (r.x[1] - r.x[0]) * fx, y: r.y[1], z: r.z[0] + (r.z[1] - r.z[0]) * fz };
                if (solidBelow(game, o, depth)) supported = true;
            }
        }
        if (!supported) {
            problems.push(`goal ${goal.id} floats: nothing within ${GOAL_SUPPORT_MAX_DROP} m below its range`);
        }
    }
    return problems;
}

/**
 * @param {any} game
 * @param {any} level
 * @returns {string[]}
 */
export function checkBounds(game, level) {
    /** @type {string[]} */
    const problems = [];
    const b = level.bounds;
    const lim = DEFAULT_WORLD_LIMIT;
    const min = b ? toVec(b.min) : { x: -lim, y: -lim, z: -lim };
    const max = b ? toVec(b.max) : { x: lim, y: lim, z: lim };
    game.world.colliders.forEach((/** @type {RAPIER.Collider} */ c) => {
        const box = colliderAabb(c);
        if (!box || !isFiniteVec(box.min) || !isFiniteVec(box.max)) return;
        if (box.min.x < min.x || box.min.y < min.y || box.min.z < min.z
            || box.max.x > max.x || box.max.y > max.y || box.max.z > max.z) {
            const t = c.translation();
            problems.push(`collider at (${t.x.toFixed(1)}, ${t.y.toFixed(1)}, ${t.z.toFixed(1)}) extends past ${b ? 'declared bounds' : `±${lim} m`}`);
        }
    });
    return problems;
}

/** @param {any} v */
function toVec(v) {
    return Array.isArray(v) ? { x: v[0], y: v[1], z: v[2] } : v;
}

/**
 * @param {any} game
 * @param {any} marble
 */
function isGrounded(game, marble) {
    const p = marble.rigidBody.translation();
    const hit = game.physicsQueries.castRay(p, DOWN, marble.radius + 0.2, { excludeBody: marble.rigidBody, excludeSensors: true });
    return Boolean(hit);
}

/**
 * Drop the reference marble at spawn and step SMOKE_STEPS with no input.
 * Passes when the marble lands and stays on geometry for
 * SMOKE_MIN_GROUNDED_STEPS before it ever falls below the kill plane —
 * levels may legitimately roll the marble off an edge without input, but a
 * NaN or missing floor never gives it ground.
 * @param {any} game
 * @param {any} level
 */
export function reachabilitySmoke(game, level) {
    const marble = spawnReferenceMarble(game, level.spawn);
    let grounded = 0;
    let fellAt = -1;
    let nonFinite = false;
    let reachedGoal = false;
    stepHeadless(game, SMOKE_STEPS, {
        afterStep: (_g, i) => {
            const p = marble.rigidBody.translation();
            if (!isFiniteVec(p)) { nonFinite = true; return true; }
            if (isGrounded(game, marble)) grounded++;
            if ((level.goals || []).some((/** @type {any} */ goal) => inGoalRange(goal, p))) reachedGoal = true;
            if (p.y < KILL_PLANE_Y) { fellAt = i; return true; }
            return false;
        },
    });
    /** @type {string[]} */
    const problems = [];
    if (nonFinite) problems.push('marble position became non-finite');
    else if (grounded < SMOKE_MIN_GROUNDED_STEPS) {
        problems.push(fellAt >= 0
            ? `marble fell out of the world after ${(fellAt * DEFAULT_FIXED_STEP).toFixed(2)} s having touched ground for only ${grounded} steps`
            : `marble never settled on geometry (${grounded} grounded steps)`);
    }
    return { problems, grounded, fellAt, reachedGoal, final: marble.rigidBody.translation() };
}

/** Same impulse the game applies per 60 Hz frame for held movement keys (frame-input.js). */
export const MOVE_IMPULSE_PER_STEP = 0.5;

/**
 * Replay a map's `solution` input track on the reference marble.
 * Movement mirrors frame-input.js (aim-relative impulses); `jump` applies a
 * ground jump on the segment's first step if grounded, with Δv from
 * `jumpCharge` (0 → JUMP_DV_MIN, 1 → JUMP_DV_MAX, default 1).
 * @param {any} game
 * @param {any} level
 * @returns {{ reached: boolean, timeSec: number, fell: boolean, final: { x: number, y: number, z: number } }}
 */
export function replaySolution(game, level) {
    const marble = spawnReferenceMarble(game, level.spawn);
    const rb = marble.rigidBody;
    const goals = level.goals || [];
    let step = 0;
    for (const seg of level.solution?.inputs ?? []) {
        const yaw = ((seg.yawDeg ?? 0) * Math.PI) / 180;
        const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const right = { x: Math.sin(yaw - Math.PI / 2), z: Math.cos(yaw - Math.PI / 2) };
        const keys = new Set(seg.keys ?? []);
        let done = false;
        stepHeadless(game, seg.frames, {
            beforeStep: (_g, i) => {
                const k = MOVE_IMPULSE_PER_STEP;
                let ix = 0;
                let iz = 0;
                if (keys.has('forward')) { ix += fwd.x * k; iz += fwd.z * k; }
                if (keys.has('back')) { ix -= fwd.x * k; iz -= fwd.z * k; }
                if (keys.has('left')) { ix += right.x * k; iz += right.z * k; }
                if (keys.has('right')) { ix -= right.x * k; iz -= right.z * k; }
                if (ix || iz) rb.applyImpulse({ x: ix, y: 0, z: iz }, true);
                if (i === 0 && keys.has('jump') && isGrounded(game, marble)) {
                    const charge = Math.min(Math.max(seg.jumpCharge ?? 1, 0), 1);
                    applyVelocityChange(rb, { x: 0, y: JUMP_DV_MIN + (JUMP_DV_MAX - JUMP_DV_MIN) * charge, z: 0 });
                }
            },
            afterStep: () => {
                step++;
                const p = rb.translation();
                if (goals.some((/** @type {any} */ goal) => inGoalRange(goal, p))) { done = true; return true; }
                return p.y < KILL_PLANE_Y || !isFiniteVec(p);
            },
        });
        const p = rb.translation();
        if (done) return { reached: true, timeSec: step * DEFAULT_FIXED_STEP, fell: false, final: p };
        if (p.y < KILL_PLANE_Y || !isFiniteVec(p)) return { reached: false, timeSec: step * DEFAULT_FIXED_STEP, fell: true, final: p };
    }
    return { reached: false, timeSec: step * DEFAULT_FIXED_STEP, fell: false, final: rb.translation() };
}

/** Default allowed relative deviation of a solution's time from medals.parTime. */
export const DEFAULT_SOLUTION_TOLERANCE = 0.5;

/**
 * Problems with a replayed solution: it must reach a goal, and when the map
 * has a parTime, finish within ±tolerance of it (a much faster solution means
 * par is too generous; a much slower one means the track is suspect).
 * @param {{ reached: boolean, timeSec: number, fell: boolean }} res
 * @param {any} level
 * @returns {string[]}
 */
export function solutionProblems(res, level) {
    if (!res.reached) return [`solution ${res.fell ? 'fell out of the world' : 'ran out of input'} after ${res.timeSec.toFixed(2)} s`];
    const par = level.medals?.parTime;
    if (!par) return [];
    const tol = level.solution?.tolerance ?? DEFAULT_SOLUTION_TOLERANCE;
    const lo = par * (1 - tol);
    const hi = par * (1 + tol);
    return res.timeSec < lo || res.timeSec > hi
        ? [`solution time ${res.timeSec.toFixed(2)} s is outside parTime ${par} s ±${Math.round(tol * 100)}% [${lo.toFixed(1)}, ${hi.toFixed(1)}]`]
        : [];
}

/**
 * All static checks for one built level.
 * @param {any} game
 * @param {any} level
 */
export function staticChecks(game, level) {
    return [...checkFiniteBodies(game), ...checkSpawnAndGoals(game, level), ...checkBounds(game, level)];
}

/**
 * @typedef {{ at: number[], speed?: number, jump?: number, radius?: number }} Waypoint
 * `at` is [x, z] or [x, y, z]; `speed` caps the approach speed (m/s); `jump`
 * (0–1 charge) jumps once on arrival; `radius` is the arrival distance (m).
 */

/**
 * Autopilot: a velocity controller that drives the reference marble through
 * `waypoints` (then the goal centre) using only the inputs a player has —
 * an aim yaw, the forward key, and ground jumps. Each step it aims at the
 * difference between the desired and current velocity, so it brakes and
 * corrects drift instead of overshooting. When it reaches a goal the inputs
 * it used are returned as a `solution` track (the format `replaySolution`
 * consumes), which is evidence the level can be finished.
 *
 * With no waypoints it is the greedy solver used to triage code levels.
 * @param {any} game  freshly built level (spawns its own marble)
 * @param {any} level
 * `yawStepDeg` quantises the aim (coarser → fewer segments); `hysteresis`
 * (m/s) widens the forward-key on/off band.
 * @param {{ waypoints?: Array<Waypoint | number[]>, maxSteps?: number, maxSpeed?: number, ledgeJumps?: boolean, yawStepDeg?: number, hysteresis?: number }} [options]
 */
export function autopilotSolve(game, level, { waypoints = [], maxSteps = 3600, maxSpeed = 9, ledgeJumps = true, yawStepDeg = 5, hysteresis = 0 } = {}) {
    const marble = spawnReferenceMarble(game, level.spawn);
    const rb = marble.rigidBody;
    const goals = level.goals || [];
    const target = goals[0]?.range;
    if (!target) return { reached: false, timeSec: 0, inputs: [], final: rb.translation() };
    const centre = {
        x: (target.x[0] + target.x[1]) / 2,
        y: (target.y[0] + target.y[1]) / 2,
        z: (target.z[0] + target.z[1]) / 2,
    };
    /** @type {Array<{ at: { x: number, y: number | null, z: number }, speed: number, jump: number | null, radius: number }>} */
    const route = waypoints.map((w) => {
        const wp = Array.isArray(w) ? { at: w } : w;
        const a = wp.at;
        const at = a.length === 2 ? { x: a[0], y: null, z: a[1] } : { x: a[0], y: a[1], z: a[2] };
        return { at, speed: wp.speed ?? maxSpeed, jump: wp.jump ?? null, radius: wp.radius ?? 2.5 };
    });
    route.push({ at: centre, speed: maxSpeed, jump: null, radius: 0 });

    /** @type {Array<{ frames: number, keys: string[], yawDeg: number, jumpCharge?: number }>} */
    const inputs = [];
    let leg = 0;
    /** @type {number | null} */
    let pendingJump = null;
    let thrusting = false;
    let lastJump = -1000;
    let reached = false;
    let steps = 0;

    stepHeadless(game, maxSteps, {
        beforeStep: (_g, i) => {
            const p = rb.translation();
            const v = rb.linvel();
            let wp = route[leg];
            while (leg < route.length - 1 && Math.hypot(wp.at.x - p.x, wp.at.z - p.z) < wp.radius) {
                if (wp.jump != null && isGrounded(game, marble)) pendingJump = wp.jump;
                leg++;
                wp = route[leg];
            }
            const dx = wp.at.x - p.x;
            const dz = wp.at.z - p.z;
            const dist = Math.hypot(dx, dz) || 1;
            const speed = Math.min(wp.speed, 1.5 + dist * 2);
            const ex = (dx / dist) * speed - v.x;
            const ez = (dz / dist) * speed - v.z;
            const yawDeg = (Math.round((Math.atan2(ex, ez) * 180) / Math.PI / yawStepDeg) * yawStepDeg + 360) % 360;
            // Optional hysteresis keeps the forward key from toggling every step.
            const err = Math.hypot(ex, ez);
            thrusting = thrusting ? err > 0.6 - hysteresis : err > 0.6 + hysteresis;
            /** @type {string[]} */
            const keys = thrusting ? ['forward'] : [];

            const grounded = isGrounded(game, marble);
            let charge = /** @type {number | null} */ (null);
            if (pendingJump != null && grounded) { charge = pendingJump; pendingJump = null; }
            if (charge == null && grounded && i - lastJump > 45) {
                const aim = Math.atan2(dx, dz);
                const ahead = { x: p.x + Math.sin(aim) * 1.5, y: p.y, z: p.z + Math.cos(aim) * 1.5 };
                const ledge = ledgeJumps && !game.physicsQueries.castRay(ahead, DOWN, 4, { excludeBody: rb, excludeSensors: true });
                const goalAbove = leg === route.length - 1 && centre.y > p.y + 1.5 && dist < 14;
                if (ledge || goalAbove) charge = 1;
            }
            if (charge != null) { keys.push('jump'); lastJump = i; }

            const yaw = (yawDeg * Math.PI) / 180;
            if (keys.includes('forward')) {
                rb.applyImpulse({ x: Math.sin(yaw) * MOVE_IMPULSE_PER_STEP, y: 0, z: Math.cos(yaw) * MOVE_IMPULSE_PER_STEP }, true);
            }
            if (charge != null) applyVelocityChange(rb, { x: 0, y: JUMP_DV_MIN + (JUMP_DV_MAX - JUMP_DV_MIN) * charge, z: 0 });

            const last = inputs[inputs.length - 1];
            // A jump fires on a segment's first frame, so it always opens one;
            // coasting segments merge regardless of yaw (no key, no effect).
            const coast = keys.length === 0 && last?.keys.length === 0;
            if (last && charge == null && (coast || (!last.keys.includes('jump') && last.yawDeg === yawDeg && last.keys.join() === keys.join()))) {
                last.frames++;
            } else {
                /** @type {{ frames: number, keys: string[], yawDeg: number, jumpCharge?: number }} */
                const seg = { frames: 1, keys, yawDeg };
                if (charge != null && charge !== 1) seg.jumpCharge = charge;
                inputs.push(seg);
            }
        },
        afterStep: () => {
            steps++;
            const p = rb.translation();
            if (goals.some((/** @type {any} */ g) => inGoalRange(g, p))) { reached = true; return true; }
            return p.y < KILL_PLANE_Y || !isFiniteVec(p);
        },
    });
    return { reached, timeSec: steps * DEFAULT_FIXED_STEP, inputs: reached ? inputs : [], final: rb.translation(), leg };
}

/** Greedy triage solver: the autopilot with no authored waypoints. */
export function greedySolve(game, level, options = {}) {
    return autopilotSolve(game, level, { ...options, waypoints: [] });
}
