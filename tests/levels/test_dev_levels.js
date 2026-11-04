/**
 * Every remaining DEV_LEVELS entry must at least build headlessly and pass
 * the static + smoke checks; ones that don't get fixed, ported, or deleted
 * (see docs/architecture/level-pipeline.md).
 */
import { devLevels } from './level-sources.js';
import { buildHeadlessLevel } from '../../src/game/headless/headless-level.js';
import { staticChecks, reachabilitySmoke } from '../../src/game/headless/level-checks.js';

console.log('test_dev_levels.js');

const failures = [];
const levels = await devLevels();
for (const { id, level } of levels) {
    const problems = [];
    try {
        problems.push(...staticChecks(await buildHeadlessLevel(level), level));
        problems.push(...reachabilitySmoke(await buildHeadlessLevel(level), level).problems);
    } catch (err) {
        problems.push(`crashed while building: ${err instanceof Error ? err.message : err}`);
    }
    if (problems.length) failures.push(`${id}:\n    - ${problems.join('\n    - ')}`);
}

if (failures.length) {
    console.error(`✗ ${failures.length} DEV_LEVELS entr(ies) failed:\n  ${failures.join('\n  ')}`);
    console.error('  Debug with: npm run level:lab -- --dev <id>');
    process.exit(1);
}
console.log(`✓ ${levels.length} DEV_LEVELS entries build and pass static + smoke checks`);
