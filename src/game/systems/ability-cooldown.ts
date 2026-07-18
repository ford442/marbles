export function isCooldownReady(lastUseMs: number, cooldownMs: number, nowMs: number): boolean {
    return nowMs - lastUseMs >= cooldownMs;
}

export function cooldownRemainingMs(lastUseMs: number, cooldownMs: number, nowMs: number): number {
    return Math.max(0, cooldownMs - (nowMs - lastUseMs));
}

export function cooldownFillRatio(lastUseMs: number, cooldownMs: number, nowMs: number): number {
    if (cooldownMs <= 0) return 1;
    return Math.min(1, (nowMs - lastUseMs) / cooldownMs);
}
