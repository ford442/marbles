const TWO_PI = Math.PI * 2;

/**
 * @param {number} lastUseMs
 * @param {number} cooldownMs
 * @param {number} nowMs
 */
export function isCooldownReady(lastUseMs, cooldownMs, nowMs) {
    return nowMs - lastUseMs >= cooldownMs;
}

/**
 * @param {number} lastUseMs
 * @param {number} cooldownMs
 * @param {number} nowMs
 */
export function cooldownRemainingMs(lastUseMs, cooldownMs, nowMs) {
    return Math.max(0, cooldownMs - (nowMs - lastUseMs));
}

/**
 * @param {number} lastUseMs
 * @param {number} cooldownMs
 * @param {number} nowMs
 */
export function cooldownFillRatio(lastUseMs, cooldownMs, nowMs) {
    if (cooldownMs <= 0) return 1;
    return Math.min(1, (nowMs - lastUseMs) / cooldownMs);
}
