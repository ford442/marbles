/**
 * Bounded concurrent one-shot voices — prevents AudioBufferSource / node leaks under spam.
 */

export class VoicePool {
    /**
     * @param {number} maxVoices
     */
    constructor(maxVoices = 28) {
        this.maxVoices = maxVoices;
        /** @type {Set<object>} */
        this.active = new Set();
        this.dropped = 0;
    }

    get activeCount() {
        return this.active.size;
    }

    /**
     * @returns {boolean} false when pool is full (caller should skip playback)
     */
    tryAcquire(token) {
        if (this.active.size >= this.maxVoices) {
            this.dropped += 1;
            return false;
        }
        this.active.add(token);
        return true;
    }

    /**
     * @param {object} token
     */
    release(token) {
        this.active.delete(token);
    }

    reset() {
        this.active.clear();
        this.dropped = 0;
    }
}

/**
 * Schedule node teardown after playback ends.
 * @param {AudioContext} ctx
 * @param {AudioNode[]} nodes
 * @param {number} stopAt context time
 * @param {() => void} onDone
 */
export function scheduleVoiceStop(ctx, nodes, stopAt, onDone) {
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
