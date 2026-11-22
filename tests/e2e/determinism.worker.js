import { runBothBackends } from '../support/physics-determinism.js';

self.onmessage = async (event) => {
    try {
        const results = [];
        for (const hz of event.data.rates) {
            const r = await runBothBackends({ hz });
            results.push({ hz: r.hz, rapier: r.rapier, firstMismatch: r.firstMismatch, main: r.main.digest, worker: r.worker.digest });
        }
        self.postMessage({ results });
    } catch (err) {
        self.postMessage({ error: String(err?.stack || err) });
    }
};
