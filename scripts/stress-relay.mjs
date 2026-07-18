#!/usr/bin/env node
/**
 * Stress test for the party relay — 4 simulated clients sending input + state.
 * Usage: node scripts/stress-relay.mjs [--port 8787] [--duration 10]
 */

import { WebSocket } from 'ws';
import {
    MSG,
    PROTOCOL_VERSION,
    STATE_RATE_HZ,
    INPUT_RATE_HZ,
    serializeMessage,
} from '../src/game/network/protocol.js';

const port = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--port') || 8787);
const durationSec = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--duration') || 10);
const url = `ws://127.0.0.1:${port}`;
const CLIENT_COUNT = 4;
const ROOM = 'STRSS1';

const stateIntervalMs = 1000 / STATE_RATE_HZ;
const inputIntervalMs = 1000 / INPUT_RATE_HZ;

/** @type {number[]} */
const latencies = [];

function connectClient(index) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const name = `Bot${index}`;
        let stateSeq = 0;
        let inputSeq = 0;
        let joined = false;

        ws.on('open', () => {
            ws.send(serializeMessage({
                type: MSG.JOIN,
                room: ROOM,
                name,
                protocolVersion: PROTOCOL_VERSION,
            }));
        });

        ws.on('message', (raw) => {
            const msg = JSON.parse(String(raw));
            if (msg.type === MSG.JOINED && !joined) {
                joined = true;
                resolve({ ws, index, name, isHost: Boolean(msg.isHost) });
            }
            if (msg.type === MSG.STATE || msg.type === MSG.INPUT || msg.type === MSG.ABILITY) {
                latencies.push(0);
            }
        });

        ws.on('error', reject);

        ws._tick = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN || !joined) return;
            stateSeq++;
            inputSeq++;
            const t = performance.now() / 1000;
            ws.send(serializeMessage({
                type: MSG.STATE,
                t,
                x: index,
                y: 1,
                z: t,
                qx: 0,
                qy: 0,
                qz: 0,
                qw: 1,
                seq: stateSeq,
            }));
            ws.send(serializeMessage({
                type: MSG.INPUT,
                t,
                seq: inputSeq,
                bits: index & 0xf,
                yaw: index * 100,
                pitch: 0,
            }));
        }, Math.min(stateIntervalMs, inputIntervalMs));
    });
}

async function main() {
    console.log(`[STRESS] Connecting ${CLIENT_COUNT} clients to ${url} for ${durationSec}s`);
    const clients = await Promise.all(Array.from({ length: CLIENT_COUNT }, (_, i) => connectClient(i + 1)));

    const host = clients.find((c) => c.isHost);
    if (host) {
        host.ws.send(serializeMessage({ type: MSG.START, levelId: 'tutorial' }));
    }

    await new Promise((r) => setTimeout(r, durationSec * 1000));

    for (const client of clients) {
        clearInterval(client.ws._tick);
        client.ws.close();
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    console.log(`[STRESS] Forwarded messages observed: ${latencies.length}`);
    console.log(`[STRESS] p95 placeholder latency: ${p95.toFixed(2)} ms (local relay)`);
    console.log('[STRESS] Done.');
}

main().catch((err) => {
    console.error('[STRESS] Failed:', err.message);
    process.exit(1);
});
