// @ts-check
/**
 * Validation error scopes around GPU object creation. Without one, a bad
 * pipeline only surfaces as an `uncapturederror` event (and a later invalid
 * dispatch), so callers can't fall back. With one, creation rejects and the
 * caller drops to its CPU path.
 */

/**
 * @template T
 * @param {GPUDevice} device
 * @param {string} label What was being created — ends up in the error message.
 * @param {() => T} create
 * @returns {Promise<T>}
 */
export async function withValidationScope(device, label, create) {
    if (typeof device.pushErrorScope !== 'function') return create();
    device.pushErrorScope('validation');
    /** @type {T | undefined} */
    let value;
    /** @type {unknown} */
    let thrown = null;
    try {
        value = create();
    } catch (err) {
        thrown = err;
    }
    // Always pop, even when create() threw, or the scope stack leaks.
    const error = await device.popErrorScope();
    if (error) throw new Error(`[WebGPU] ${label}: ${error.message}`);
    if (thrown) throw thrown;
    return /** @type {T} */ (value);
}
