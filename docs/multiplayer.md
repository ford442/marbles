# Multiplayer (Party Race)

Phase 1 delivers **lobby + room codes + transform sync** between browsers. Each client runs local Rapier physics; the relay only forwards validated JSON state packets. This is arcade party mode, not competitive-fair netplay.

## Quick start

Terminal 1 — relay server (default `ws://localhost:8787`):

```bash
npm run relay
```

Terminal 2 — game:

```bash
npm run dev
```

1. Open `http://localhost:5173` in two browsers (or one normal + one incognito).
2. Click **Party Race** on the main menu.
3. Browser A: note the room code → **Create Room**.
4. Browser B: enter the same code → **Join Room**.
5. Host (first player in room) clicks **Start Race** when 2+ players are listed.

Set a custom relay URL at build time:

```bash
VITE_RELAY_URL=ws://my-host:8787 npm run dev
```

## Architecture (Phase 1)

```
Browser A (local Rapier)  ──state 20Hz──►  Relay  ──►  Browser B (renders remote marble)
Browser B (local Rapier)  ──state 20Hz──►  Relay  ──►  Browser A (renders remote marble)
```

| Component | Path |
|-----------|------|
| Protocol + validation | `src/game/network/protocol.js` |
| WebSocket client | `src/game/network/network-client.js` |
| Remote marble rendering | `src/game/network/remote-players.js` |
| Lobby UI | `src/init/multiplayer-menu.js` |
| Relay server | `server/relay.mjs` |

Remote marbles are **visual-only** (no collider), same pattern as ghost replay. Interpolation reuses `sampleReplayAtTime` from the ghost codec.

## Disconnect handling

| Event | Client behavior | Server behavior |
|-------|-----------------|-----------------|
| Player closes tab | Relay removes peer, broadcasts `player_left` | Room kept if others remain |
| Host leaves | Next peer becomes host (`room_state` update) | Host migration is **best-effort** in Phase 1 |
| Relay unreachable | `onDisconnected` fires; banner shown in HUD | N/A |
| Return to menu | `network.disconnect()` + `remotePlayers.clear()` | `leave` or implicit on socket close |

**Phase 1 limitations (documented):**

- No host-authoritative physics — positions will diverge on bumps/collisions.
- No reconnection or late-join mid-race.
- Host migration does not migrate simulation state; a new host can only start a fresh race.
- Competitive ranked modes require Phase 3 (host authority + reconciliation) or a headless sim (Option C).

## Security

- All payloads are `JSON.parse` + **whitelist validation** — no `eval`, no `Function`, no dynamic code execution.
- Message size capped at 4 KB; state rate limited server-side to 20 Hz.
- Room codes are 4–8 uppercase alphanumeric characters.
- Unknown message types and malformed fields are rejected with `error` responses.

## Roadmap

| Phase | Scope |
|-------|--------|
| **1** (this) | Lobby, room codes, transform sync, disconnect docs |
| **2** | Ability events via `ABILITY_REGISTRY` ids; bit-packed inputs |
| **3** | Host-authoritative physics + client prediction/reconciliation |
| **4** | Ranked seasons via `backend/storage` ghost/replay blobs |

## Library evaluation (future)

| Option | Pros | Cons |
|--------|------|------|
| **Custom WS relay** (current) | Minimal deps, full control, easy self-host | No matchmaking, no persistence |
| [Colyseus](https://colyseus.io/) | Rooms, state schema, ecosystem | Heavier; still need physics authority decision |
| [PartyKit](https://www.partykit.io/) | Edge rooms, Durable Objects | Vendor tie-in |
| [peerjs](https://peerjs.com/) | Direct P2P, low latency | NAT traversal pain; no dedicated host sim |

**Recommendation:** Keep the custom relay for Phase 1–2. Re-evaluate Colyseus or a Rust/WS headless sim when moving to host authority (Phase 3).

## Determinism reality check

Rapier WASM in each browser is **not** cross-platform deterministic. Phase 1 avoids this by not syncing physics — only transforms. Future competitive modes should use:

- **Option A:** Host-authoritative physics (host sim, clients predict) — recommended next step.
- **Option B:** Input lockstep + checksum desync detection — high engineering cost.
- **Option C:** Shared C++/Rust headless sim on server — aligns with existing `wasm/` module direction.
