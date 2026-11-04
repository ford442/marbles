/**
 * Fixed-timestep accumulator. Rapier always advances by `step` seconds; the
 * render loop feeds wall-clock frame time in and gets back how many steps to
 * run, so simulation speed no longer depends on display refresh rate.
 *
 * `timeScale` (slow-mo / focus) scales the time fed into the accumulator, not
 * the step size, so every step stays identical across devices and backends.
 * `alpha` is how far the leftover time sits between the last two steps, for
 * render interpolation.
 */

export const DEFAULT_FIXED_STEP = 1 / 60;
export const DEFAULT_MAX_SUBSTEPS = 5;
/** Longest frame fed to the accumulator (tab switch, breakpoint, GC stall). */
export const MAX_FRAME_DT = 0.25;

export interface FixedStepClockOptions {
    step?: number;
    maxSubsteps?: number;
}

export class FixedStepClock {
    readonly step: number;
    readonly maxSubsteps: number;
    accumulator: number;
    timeScale: number;
    /** Steps returned by the most recent `advance()`. */
    lastSubsteps: number;
    /** Total simulated seconds since construction or `reset()`. */
    simTime: number;

    constructor({ step = DEFAULT_FIXED_STEP, maxSubsteps = DEFAULT_MAX_SUBSTEPS }: FixedStepClockOptions = {}) {
        if (!(step > 0)) throw new Error(`FixedStepClock: step must be > 0 (got ${step})`);
        this.step = step;
        this.maxSubsteps = Math.max(1, Math.floor(maxSubsteps));
        this.accumulator = 0;
        this.timeScale = 1;
        this.lastSubsteps = 0;
        this.simTime = 0;
    }

    /**
     * Feed one frame of wall-clock time; returns how many fixed steps to run.
     * Time beyond `maxSubsteps` steps is dropped (the game slows down instead
     * of spiralling).
     */
    advance(frameDtSec: number): number {
        const dt = Number.isFinite(frameDtSec) ? Math.min(Math.max(frameDtSec, 0), MAX_FRAME_DT) : 0;
        const scale = Number.isFinite(this.timeScale) ? Math.max(this.timeScale, 0) : 1;
        this.accumulator += dt * scale;

        // Tolerance absorbs float drift so e.g. 2 × (1/120) frames reliably
        // produce exactly one 1/60 step.
        const epsilon = this.step * 1e-6;
        let steps = Math.floor((this.accumulator + epsilon) / this.step);
        if (steps > this.maxSubsteps) {
            steps = this.maxSubsteps;
            this.accumulator = 0;
        } else {
            this.accumulator = Math.max(0, this.accumulator - steps * this.step);
        }
        this.lastSubsteps = steps;
        this.simTime += steps * this.step;
        return steps;
    }

    /** Simulated seconds the last `advance()` will cover. */
    get lastSimDt(): number {
        return this.lastSubsteps * this.step;
    }

    /** Fraction [0, 1) of a step left in the accumulator. */
    get alpha(): number {
        const a = this.accumulator / this.step;
        return a < 0 ? 0 : a >= 1 ? 1 : a;
    }

    reset(): void {
        this.accumulator = 0;
        this.lastSubsteps = 0;
        this.simTime = 0;
    }
}
