/**
 * Compatibility shim — implementation lives in `math.ts`.
 * Existing JS modules may keep `import … from './math.js'`.
 */
export { quatFromEuler, quaternionToMat4 } from './math.ts';
