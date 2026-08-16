/**
 * Zone creation methods
 * Aggregates track, interactive, and themed zone creation methods.
 */

import { interactiveCreationMethods } from './interactive-creation.js';
import { trackCreationMethods } from './track-creation.js';
import { themedCreationMethods } from './themed-creation.js';

export const creationMethods = {
    ...trackCreationMethods,
    ...interactiveCreationMethods,
    ...themedCreationMethods,
};

export { interactiveCreationMethods } from './interactive-creation.js';
export { trackCreationMethods } from './track-creation.js';
export { themedCreationMethods } from './themed-creation.js';
