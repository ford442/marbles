/**
 * Attach a closed, reviewable list of legacy methods to a game prototype.
 * This is the compatibility boundary for code that has not yet become a
 * first-class subsystem; additions must be named explicitly by the caller.
 *
 * @param {Function} targetClass
 * @param {Function} sourceClass
 * @param {string[]} methodNames
 */
export function installKnownMethods(targetClass, sourceClass, methodNames) {
    for (const name of methodNames) {
        const method = sourceClass.prototype[name];
        if (typeof method !== 'function') {
            throw new Error(`Cannot install missing method ${sourceClass.name}.${name}`);
        }
        targetClass.prototype[name] = method;
    }
}
