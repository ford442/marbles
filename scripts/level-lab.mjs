#!/usr/bin/env node
// @ts-check
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- a script .d.ts (no @types/node) can only be included this way
/// <reference path="./level-lab.node.d.ts" />
/**
 * Level lab: build a map headlessly and report what the CI harness
 * (tests/levels/) will say about it, plus tools for authoring a `solution`.
 *
 *   npm run level:lab -- assets/maps/quantum_core.json            # checks + smoke + solution replay
 *   npm run level:lab -- assets/maps/quantum_core.json --trace    # also print the solution trajectory
 *   npm run level:lab -- assets/maps/quantum_core.json --greedy   # try the greedy autopilot, print its inputs
 *   npm run level:lab -- assets/maps/x.json --waypoints '[[0,40],[8,52],[0,70]]' [--speed 9] [--yaw-step 5] [--hysteresis 0]
 *                                                                 # drive waypoints, print a solution
 *   add --write to a --greedy / --waypoints run to store the solution (inputs + par) in the map file
 *   npm run level:lab -- --dev neon_drift_run                     # a DEV_LEVELS entry instead of a file
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { mapToRuntimeLevel } from '../src/levels/map-normalize.js';
import { buildHeadlessLevel, stepHeadless, spawnReferenceMarble } from '../src/game/headless/headless-level.js';
import {
    staticChecks, reachabilitySmoke, replaySolution, solutionProblems, greedySolve, autopilotSolve,
} from '../src/game/headless/level-checks.js';

/** @typedef {import('../src/types/map.ts').MapDefinition} MapDefinition */
/** @typedef {import('../src/types/map.ts').RuntimeLevel} RuntimeLevel */
/** @typedef {{ x: number, y: number, z: number }} XYZ */

const args = process.argv.slice(2);
/** @param {string} name */
const flag = (name) => args.includes(name);
const devIdx = args.indexOf('--dev');

/** @type {RuntimeLevel} */
let level;
/** @type {string} */
let label;
/** @type {string | undefined} */
let file;
if (devIdx >= 0) {
    const { DEV_LEVELS } = await import('../src/levels.ts');
    const id = args[devIdx + 1] ?? '';
    const devLevel = DEV_LEVELS[id];
    if (!devLevel) throw new Error(`no DEV_LEVELS entry "${id}"`);
    // Same assertion as catalog.js loadDevLevels: DEV_LEVELS entries are code-authored runtime levels.
    level = /** @type {RuntimeLevel} */ ({ ...devLevel, source: 'code' });
    label = `DEV_LEVELS.${id}`;
} else {
    file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
    if (!file) {
        console.error('usage: level-lab.mjs <map.json> [--trace] [--greedy] | --dev <id>');
        process.exit(2);
    }
    // Boundary: an authored map file; the checks below are what report on it.
    const mapDef = /** @type {MapDefinition} */ (JSON.parse(fs.readFileSync(file, 'utf8')));
    level = mapToRuntimeLevel(mapDef, 'json');
    label = path.relative(process.cwd(), file);
}

/**
 * Replace (or append) the top-level "solution" block in a map's source text,
 * leaving the rest of the hand-formatted file untouched.
 * @param {string} text map file source
 * @param {{ inputs: object[], par: number, tolerance?: number }} solution
 * @returns {string}
 */
function spliceSolution(text, solution) {
    const prev = JSON.parse(text).solution;
    const sol = { ...(prev?.tolerance !== undefined ? { tolerance: prev.tolerance } : {}), ...solution };
    const lines = sol.inputs.map((seg) => `      ${JSON.stringify(seg).replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/":/g, '": ').replace(/,"/g, ', "')}`);
    const extra = Object.entries(sol).filter(([k]) => k !== 'inputs').map(([k, v]) => `,\n    "${k}": ${JSON.stringify(v)}`).join('');
    const block = `"solution": {\n    "inputs": [\n${lines.join(',\n')}\n    ]${extra}\n  }`;
    const start = text.search(/\n {2}"solution"\s*:/);
    if (start >= 0) {
        const open = text.indexOf('{', start);
        let depth = 0;
        let end = open;
        for (; end < text.length; end++) {
            if (text[end] === '{') depth++;
            else if (text[end] === '}' && --depth === 0) break;
        }
        return `${text.slice(0, start)}\n  ${block}${text.slice(end + 1)}`;
    }
    const close = text.lastIndexOf('}');
    return `${text.slice(0, close).trimEnd()},\n  ${block}\n}\n`;
}

/**
 * A recordable solution: inputs plus the replay time as `par` (drift-checked by the harness).
 * @param {{ inputs: object[], timeSec: number }} res
 */
function record(res) {
    const solution = { inputs: res.inputs, par: Number(res.timeSec.toFixed(2)) };
    if (flag('--write') && file) {
        // Keep any hand-tuned medals tolerance; replace inputs + par.
        fs.writeFileSync(file, spliceSolution(fs.readFileSync(file, 'utf8'), solution));
        console.log(`  wrote solution to ${file}`);
    }
    return solution;
}

/** @param {XYZ} p */
const fmt = (p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
console.log(`▶ ${label} — ${level.name}`);

const staticProblems = staticChecks(await buildHeadlessLevel(level), level);
console.log(staticProblems.length ? `✗ static:\n  - ${staticProblems.join('\n  - ')}` : '✓ static checks');

const smoke = reachabilitySmoke(await buildHeadlessLevel(level), level);
console.log(smoke.problems.length
    ? `✗ smoke: ${smoke.problems.join('; ')}`
    : `✓ smoke (grounded ${smoke.grounded} steps, end ${fmt(smoke.final)}${smoke.reachedGoal ? ', reached goal' : ''})`);

if (level.solution) {
    const res = replaySolution(await buildHeadlessLevel(level), level);
    const par = level.medals?.parTime;
    const problems = solutionProblems(res, level);
    console.log(problems.length
        ? `✗ ${problems.join('; ')} (ended at ${fmt(res.final)})`
        : `✓ solution reaches the goal in ${res.timeSec.toFixed(2)} s${par ? ` (parTime ${par} s)` : ''}`);

    if (flag('--trace')) {
        // Per-segment end positions (replays each prefix of the track).
        const inputs = level.solution.inputs;
        let total = 0;
        for (let n = 1; n <= inputs.length; n++) {
            const seg = inputs[n - 1];
            if (!seg) break;
            const partial = { ...level, solution: { inputs: inputs.slice(0, n) } };
            const r = replaySolution(await buildHeadlessLevel(level), partial);
            total += seg.frames;
            console.log(`  seg ${n} (${seg.keys?.join('+') || 'coast'} @${seg.yawDeg ?? 0}°) → ${fmt(r.final)} t=${(total / 60).toFixed(2)}${r.reached ? ' GOAL' : ''}${r.fell ? ' FELL' : ''}`);
            if (r.reached || r.fell) break;
        }
    }
}

if (flag('--greedy')) {
    const res = greedySolve(await buildHeadlessLevel(level), level);
    console.log(res.reached
        ? `✓ greedy autopilot reached the goal in ${res.timeSec.toFixed(2)} s:\n${JSON.stringify(record(res))}`
        : '✗ greedy autopilot did not reach the goal');
}

const wpIdx = args.indexOf('--waypoints');
if (wpIdx >= 0) {
    // --waypoints '[[0,40],{"at":[8,50],"speed":6},[0,70]]' [--speed 9]
    // Boundary: CLI JSON, passed through to autopilotSolve as before.
    const waypoints = JSON.parse(args[wpIdx + 1] ?? '');
    /** @param {string} name */
    const num = (name) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : undefined; };
    const opts = { maxSpeed: num('--speed'), yawStepDeg: num('--yaw-step'), hysteresis: num('--hysteresis') };
    const res = autopilotSolve(await buildHeadlessLevel(level), level, {
        waypoints, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
    });
    console.log(res.reached
        ? `✓ autopilot reached the goal in ${res.timeSec.toFixed(2)} s (${res.inputs.length} segments):\n"solution": ${JSON.stringify(record(res))}`
        : `✗ autopilot stopped at ${fmt(res.final)} on leg ${res.leg} after ${res.timeSec.toFixed(2)} s`);
}

if (flag('--coast')) {
    const game = await buildHeadlessLevel(level);
    const m = spawnReferenceMarble(game, level.spawn);
    stepHeadless(game, 900, {
        afterStep: (_g, i) => {
            if (i % 30 === 0) console.log(`  t=${(i / 60).toFixed(1)} ${fmt(m.rigidBody.translation())}`);
            return m.rigidBody.translation().y < -20;
        },
    });
}
