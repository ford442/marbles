import { createWorkerSim } from './worker-sim.js';
import { initMarblePhysicsWasm } from '../../wasm-bridge.js';

const sim = createWorkerSim({
    post: (msg) => self.postMessage(msg),
});

initMarblePhysicsWasm().catch(() => {});

self.onmessage = (event) => {
    sim.handleMessage(event.data);
};
