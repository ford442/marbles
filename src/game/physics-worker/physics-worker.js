// @ts-check
import { createWorkerSim } from './worker-sim.js';
import { initMarblePhysicsWasm } from '../../wasm-bridge.js';

const sim = createWorkerSim({
    post: (msg) => self.postMessage(msg),
});

initMarblePhysicsWasm().catch(() => {});

/** @param {MessageEvent<import('./protocol.js').WorkerInboundMessage>} event posted by `WorkerPhysicsBackend` */
self.onmessage = (event) => {
    sim.handleMessage(event.data);
};
