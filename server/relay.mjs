#!/usr/bin/env node
/**
 * Lightweight WebSocket relay for Marbles 3D party races.
 * Phase 2: ability + input forwarding, synced start, protocol v2 gate.
 *
 * Usage: node server/relay.mjs [--port 8787]
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
    MSG,
    PROTOCOL_VERSION,
    MAX_PLAYERS_PER_ROOM,
    MAX_MESSAGE_BYTES,
    STATE_RATE_HZ,
    ABILITY_RATE_HZ,
    INPUT_RATE_HZ,
    COUNTDOWN_MS,
    parseJsonMessage,
    validateClientMessage,
    serializeMessage,
    hashRoomCode,
    isSupportedProtocolVersion,
} from '../src/game/network/protocol.js';

const port = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--port') || process.env.MARBLES_RELAY_PORT || 8787);

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

/** @type {WeakMap<import('ws').WebSocket, { playerId: string, room: string, name: string, isHost: boolean }>} */
const clients = new WeakMap();

/** @type {WeakMap<import('ws').WebSocket, number>} */
const lastStateSentAt = new WeakMap();
/** @type {WeakMap<import('ws').WebSocket, number>} */
const lastAbilitySentAt = new WeakMap();
/** @type {WeakMap<import('ws').WebSocket, number>} */
const lastInputSentAt = new WeakMap();

const stateMinIntervalMs = 1000 / STATE_RATE_HZ;
const abilityMinIntervalMs = 1000 / ABILITY_RATE_HZ;
const inputMinIntervalMs = 1000 / INPUT_RATE_HZ;

function send(ws, payload) {
    if (ws.readyState === ws.OPEN) {
        ws.send(serializeMessage(payload));
    }
}

function sendError(ws, code, message) {
    send(ws, { type: MSG.ERROR, code, message });
}

function roomPlayers(roomCode) {
    const members = rooms.get(roomCode);
    if (!members) return [];
    return [...members].map((ws) => {
        const meta = clients.get(ws);
        return meta ? { id: meta.playerId, name: meta.name, isHost: meta.isHost } : null;
    }).filter(Boolean);
}

function broadcast(roomCode, payload, except) {
    const members = rooms.get(roomCode);
    if (!members) return;
    for (const ws of members) {
        if (ws !== except) send(ws, payload);
    }
}

function leaveRoom(ws) {
    const meta = clients.get(ws);
    if (!meta) return;

    const members = rooms.get(meta.room);
    if (members) {
        members.delete(ws);
        if (members.size === 0) {
            rooms.delete(meta.room);
        } else {
            const remaining = [...members];
            const hasHost = remaining.some((peer) => clients.get(peer)?.isHost);
            if (!hasHost) {
                const newHost = remaining[0];
                const hostMeta = clients.get(newHost);
                if (hostMeta) {
                    hostMeta.isHost = true;
                }
            }
            broadcast(meta.room, { type: MSG.PLAYER_LEFT, playerId: meta.playerId });
            broadcast(meta.room, { type: MSG.ROOM_STATE, players: roomPlayers(meta.room) });
        }
    }
    clients.delete(ws);
}

function handleJoin(ws, data) {
    if (!isSupportedProtocolVersion(data.protocolVersion)) {
        sendError(ws, 'PROTOCOL_MISMATCH', `Protocol v${PROTOCOL_VERSION} required`);
        return;
    }

    leaveRoom(ws);

    const roomCode = data.room;
    let members = rooms.get(roomCode);
    if (!members) {
        members = new Set();
        rooms.set(roomCode, members);
    }

    if (members.size >= MAX_PLAYERS_PER_ROOM) {
        sendError(ws, 'ROOM_FULL', 'Room is full');
        return;
    }

    const playerId = randomUUID();
    const isHost = members.size === 0;
    const meta = { playerId, room: roomCode, name: data.name, isHost };
    clients.set(ws, meta);
    members.add(ws);

    send(ws, {
        type: MSG.JOINED,
        room: roomCode,
        playerId,
        isHost,
        players: roomPlayers(roomCode),
        protocolVersion: PROTOCOL_VERSION,
    });

    broadcast(roomCode, {
        type: MSG.PLAYER_JOINED,
        player: { id: playerId, name: data.name, isHost },
    }, ws);

    broadcast(roomCode, { type: MSG.ROOM_STATE, players: roomPlayers(roomCode) });
}

function handleState(ws, data) {
    const meta = clients.get(ws);
    if (!meta) {
        sendError(ws, 'NOT_IN_ROOM', 'Join a room before sending state');
        return;
    }

    const now = Date.now();
    const last = lastStateSentAt.get(ws) || 0;
    if (!meta.isHost && now - last < stateMinIntervalMs - 2) {
        return;
    }
    if (!meta.isHost) {
        lastStateSentAt.set(ws, now);
    }

    broadcast(meta.room, {
        type: MSG.STATE,
        playerId: data.playerId || meta.playerId,
        t: data.t,
        x: data.x,
        y: data.y,
        z: data.z,
        qx: data.qx,
        qy: data.qy,
        qz: data.qz,
        qw: data.qw,
        seq: data.seq,
    }, ws);
}

function handleAbility(ws, data) {
    const meta = clients.get(ws);
    if (!meta) {
        sendError(ws, 'NOT_IN_ROOM', 'Join a room before sending ability');
        return;
    }

    const now = Date.now();
    const last = lastAbilitySentAt.get(ws) || 0;
    if (now - last < abilityMinIntervalMs - 2) {
        return;
    }
    lastAbilitySentAt.set(ws, now);

    broadcast(meta.room, {
        type: MSG.ABILITY,
        playerId: meta.playerId,
        id: data.id,
        t: data.t,
        seq: data.seq,
        ox: data.ox,
        oy: data.oy,
        oz: data.oz,
        dx: data.dx,
        dy: data.dy,
        dz: data.dz,
        ...(data.charge !== undefined ? { charge: data.charge } : {}),
    }, ws);
}

function handleInput(ws, data) {
    const meta = clients.get(ws);
    if (!meta) {
        sendError(ws, 'NOT_IN_ROOM', 'Join a room before sending input');
        return;
    }

    const now = Date.now();
    const last = lastInputSentAt.get(ws) || 0;
    if (now - last < inputMinIntervalMs - 2) {
        return;
    }
    lastInputSentAt.set(ws, now);

    broadcast(meta.room, {
        type: MSG.INPUT,
        playerId: meta.playerId,
        t: data.t,
        seq: data.seq,
        bits: data.bits,
        yaw: data.yaw,
        pitch: data.pitch,
    }, ws);
}

function handleStart(ws, data) {
    const meta = clients.get(ws);
    if (!meta) {
        sendError(ws, 'NOT_IN_ROOM', 'Join a room before starting');
        return;
    }
    if (!meta.isHost) {
        sendError(ws, 'NOT_HOST', 'Only the host can start the race');
        return;
    }

    const startAtMs = Date.now() + COUNTDOWN_MS;

    broadcast(meta.room, {
        type: MSG.STARTING,
        levelId: data.levelId,
        hostId: meta.playerId,
        startAtMs,
        seed: hashRoomCode(meta.room),
        protocolVersion: PROTOCOL_VERSION,
    });
}

const httpServer = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Marbles 3D relay — connect via WebSocket\n');
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        const parsed = parseJsonMessage(text);
        if (!parsed.ok) {
            sendError(ws, 'BAD_MESSAGE', parsed.error);
            return;
        }

        const validated = validateClientMessage(parsed.data);
        if (!validated.ok) {
            sendError(ws, 'BAD_MESSAGE', validated.error);
            return;
        }

        const msg = validated.data;
        switch (msg.type) {
            case MSG.JOIN:
                handleJoin(ws, msg);
                break;
            case MSG.LEAVE:
                leaveRoom(ws);
                send(ws, { type: MSG.JOINED, room: null, playerId: null, players: [] });
                break;
            case MSG.STATE:
                handleState(ws, msg);
                break;
            case MSG.ABILITY:
                handleAbility(ws, msg);
                break;
            case MSG.INPUT:
                handleInput(ws, msg);
                break;
            case MSG.START:
                handleStart(ws, msg);
                break;
            case MSG.PING:
                send(ws, { type: MSG.PONG, t: msg.t });
                break;
            default:
                sendError(ws, 'BAD_MESSAGE', 'Unsupported message');
        }
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
});

httpServer.listen(port, () => {
    console.log(`[RELAY] Marbles 3D party relay listening on ws://0.0.0.0:${port} (protocol v${PROTOCOL_VERSION})`);
});
