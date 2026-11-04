/**
 * Completability harness over every shipped manifest map: static checks
 * (finite bodies, ground under spawn, goals supported and clear of spawn,
 * colliders within bounds), a 600-step reachability smoke, and — when the map
 * records a `solution` — a replay that must reach a goal within the
 * tolerance of medals.parTime. Every manifest map must pass.
 */
import { manifestLevels } from './level-sources.js';
import { buildHeadlessLevel } from '../../src/game/headless/headless-level.js';
import {
    staticChecks, reachabilitySmoke, replaySolution, solutionProblems,
} from '../../src/game/headless/level-checks.js';

console.log('test_manifest_levels.js');

const failures = [];
let solved = 0;
const levels = manifestLevels();
for (const { id, file, level } of levels) {
    const problems = [];
    try {
        problems.push(...staticChecks(await buildHeadlessLevel(level), level));
        problems.push(...reachabilitySmoke(await buildHeadlessLevel(level), level).problems);
        if (level.solution) {
            const res = replaySolution(await buildHeadlessLevel(level), level);
            problems.push(...solutionProblems(res, level));
            if (res.reached) solved++;
        }
    } catch (err) {
        problems.push(`crashed while building: ${err instanceof Error ? err.message : err}`);
    }
    if (problems.length) failures.push(`${id} (${file}):\n    - ${problems.join('\n    - ')}`);
}

if (failures.length) {
    console.error(`✗ ${failures.length} manifest map(s) failed the completability harness:\n  ${failures.join('\n  ')}`);
    console.error('  Debug with: npm run level:lab -- <map.json> [--trace]');
    process.exit(1);
}
console.log(`✓ ${levels.length} manifest maps pass static + smoke checks; ${solved} recorded solutions replay within par tolerance`);
