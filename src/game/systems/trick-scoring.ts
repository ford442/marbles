import type { TrickState } from '../../types/game-state.js';

const TWO_PI = Math.PI * 2;

export interface LandingTrickInput {
    airTime?: number;
    spin?: number;
    wallRides?: number;
    wallBounces?: number;
    flips?: number;
    rolls?: number;
    maxAltitude?: number;
    startAltitude?: number;
}

export interface LandingTrickResult {
    points: number;
    messages: string[];
}

/** Pure landing-trick score breakdown (mirrors game-logic/core.js award logic). */
export function computeLandingTrickScore(trickState: LandingTrickInput | TrickState): LandingTrickResult {
    const airTime = trickState.airTime ?? 0;
    const spin = trickState.spin ?? 0;
    const wallRides = trickState.wallRides ?? 0;
    const wallBounces = trickState.wallBounces ?? 0;
    const flips = trickState.flips ?? 0;
    const rolls = trickState.rolls ?? 0;
    const maxAltitude = trickState.maxAltitude ?? 0;
    const startAltitude = trickState.startAltitude ?? 0;

    if (airTime <= 30 && wallRides <= 0 && wallBounces <= 0) {
        return { points: 0, messages: [] };
    }

    let points = Math.floor(airTime * 2);
    const messages: string[] = [];

    const totalFlips = Math.floor(Math.abs(flips) / TWO_PI);
    const totalRolls = Math.floor(Math.abs(rolls) / TWO_PI);

    if (totalFlips > 0) {
        points += totalFlips * 100;
        messages.push(totalFlips > 1 ? `x${totalFlips} Flip` : (flips > 0 ? 'Front Flip' : 'Back Flip'));
    }

    if (totalRolls > 0) {
        points += totalRolls * 100;
        messages.push(totalRolls > 1 ? `x${totalRolls} Roll` : 'Barrel Roll');
    }

    if (totalFlips === 0 && totalRolls === 0 && spin > TWO_PI) {
        const totalSpins = Math.floor(spin / TWO_PI);
        points += totalSpins * 50;
        messages.push(totalSpins > 1 ? `x${totalSpins} Spin` : 'Spin');
    } else if (spin > Math.PI) {
        points += Math.floor(spin * 10);
    }

    const verticalDistance = maxAltitude - startAltitude;
    if (verticalDistance > 15.0 && airTime > 60) {
        points += 100;
        messages.push('Sky High!');
    }

    if (airTime > 150) {
        points += 50;
        messages.push('Hang Time!');
    }

    if (wallRides > 0) {
        points += wallRides * 25;
        messages.push('Wall Rider!');
    }

    if (wallBounces > 0) {
        points += wallBounces * 40;
        messages.push('Wall Bouncer!');
    }

    return { points, messages };
}

export function applyComboMultiplier(basePoints: number, combo: number): number {
    const clamped = Math.max(1, Math.min(10, combo));
    return basePoints * clamped;
}
