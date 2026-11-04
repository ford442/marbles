#!/usr/bin/env node
/**
 * Level lab: build a map headlessly and report what the CI harness
 * (tests/levels/) will say about it, plus tools for authoring a `solution`.
 *
 *   npm run level:lab -- assets/maps/quantum_core.json            # checks + smoke + solution replay
 *   npm run level:lab -- assets/maps/quantum_core.json --trace    # also print the solution trajectory
 *   npm run level:lab -- assets/maps/quantum_core.json --greedy   # try the greedy autopilot, print its inputs
 *   npm run level:lab -- assets/maps/x.json --waypoints '[[0,40],[8,52],[0,70]]' [--speed 9] [--yaw-step 5] [--hysteresis 0]
 *                                                                 # drive waypoints, print a solution
 *   npm run level:lab -- --dev neon_drift_run                     # a DEV_LEVELS entry instead of a file
 */
import fs from 'node:fs';
import path from 'node:path';
import { mapToRuntimeLevel } from '../src/levels/map-normalize.js';
import { buildHeadlessLevel, stepHeadless, spawnReferenceMarble } from '../src/game/headless/headless-level.js';
import {
    staticChecks, reachabilitySmoke, replaySolution, solutionProblems, greedySolve, autopilotSolve,
} from '../src/game/headless/level-checks.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const devIdx = args.indexOf('--dev');

let level;
let label;
if (devIdx >= 0) {
    const { DEV_LEVELS } = await import('../src/levels.ts');
    const id = args[devIdx + 1];
    if (!DEV_LEVELS[id]) throw new Error(`no DEV_LEVELS entry "${id}"`);
    level = { ...DEV_LEVELS[id], source: 'code' };
    label = `DEV_LEVELS.${id}`;
} else {
    const file = args.find((a) => !a.startsWith('--'));
    if (!file) {
        console.error('usage: level-lab.mjs <map.json> [--trace] [--greedy] | --dev <id>');
        process.exit(2);
    }
    level = mapToRuntimeLevel(JSON.parse(fs.readFileSync(file, 'utf8')), 'json');
    label = path.relative(process.cwd(), file);
}

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
        const traced = { ...level, solution: level.solution };
        let total = 0;
        for (let n = 1; n <= traced.solution.inputs.length; n++) {
            const partial = { ...traced, solution: { inputs: traced.solution.inputs.slice(0, n) } };
            const r = replaySolution(await buildHeadlessLevel(level), partial);
            total += traced.solution.inputs[n - 1].frames;
            console.log(`  seg ${n} (${traced.solution.inputs[n - 1].keys?.join('+') || 'coast'} @${traced.solution.inputs[n - 1].yawDeg ?? 0}°) → ${fmt(r.final)} t=${(total / 60).toFixed(2)}${r.reached ? ' GOAL' : ''}${r.fell ? ' FELL' : ''}`);
            if (r.reached || r.fell) break;
        }
    }
}

if (flag('--greedy')) {
    const res = greedySolve(await buildHeadlessLevel(level), level);
    console.log(res.reached
        ? `✓ greedy autopilot reached the goal in ${res.timeSec.toFixed(2)} s:\n${JSON.stringify({ inputs: res.inputs })}`
        : '✗ greedy autopilot did not reach the goal');
}

const wpIdx = args.indexOf('--waypoints');
if (wpIdx >= 0) {
    // --waypoints '[[0,40],{"at":[8,50],"speed":6},[0,70]]' [--speed 9]
    const waypoints = JSON.parse(args[wpIdx + 1]);
    const num = (name) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : undefined; };
    const opts = { maxSpeed: num('--speed'), yawStepDeg: num('--yaw-step'), hysteresis: num('--hysteresis') };
    const res = autopilotSolve(await buildHeadlessLevel(level), level, {
        waypoints, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
    });
    console.log(res.reached
        ? `✓ autopilot reached the goal in ${res.timeSec.toFixed(2)} s (${res.inputs.length} segments):\n"solution": ${JSON.stringify({ inputs: res.inputs })}`
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
