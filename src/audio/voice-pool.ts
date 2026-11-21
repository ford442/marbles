/**
 * Bounded concurrent one-shot voices — prevents AudioBufferSource / node leaks under spam.
 */

/** A node torn down after a voice ends; scheduled sources also get `stop()`. */
export type StoppableNode = AudioNode & { stop?: () => void };

export class VoicePool {
    declare maxVoices: number;
    /** Opaque per-voice tokens (identity only). */
    declare active: Set<object>;
    declare dropped: number;

    constructor(maxVoices = 28) {
        this.maxVoices = maxVoices;
        this.active = new Set();
        this.dropped = 0;
    }

    get activeCount(): number {
        return this.active.size;
    }

    /**
     * @returns false when pool is full (caller should skip playback)
     */
    tryAcquire(token: object): boolean {
        if (this.active.size >= this.maxVoices) {
            this.dropped += 1;
            return false;
        }
        this.active.add(token);
        return true;
    }

    release(token: object): void {
        this.active.delete(token);
    }

    reset(): void {
        this.active.clear();
        this.dropped = 0;
    }
}

/**
 * Schedule node teardown after playback ends.
 * @param stopAt context time
 */
export function scheduleVoiceStop(
    ctx: BaseAudioContext,
    nodes: readonly StoppableNode[],
    stopAt: number,
    onDone: () => void,
): void {
    const delayMs = Math.max(0, (stopAt - ctx.currentTime) * 1000 + 50);
    setTimeout(() => {
        for (const node of nodes) {
            try {
                if (node.stop) node.stop();
                node.disconnect();
            } catch {
                /* already stopped */
            }
        }
        onDone();
    }, delayMs);
}
