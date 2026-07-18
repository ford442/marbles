# Multiplayer (Party Race)

Phase 1 delivers **lobby + room codes + transform sync**. Phase 2 adds **ability visibility**, **synced countdown**, **input bitfields**, and a **desync HUD**. Phase 3 (spike, `?hostAuth=1`) adds optional **host-authoritative physics** — see [host-authority.md](./architecture/host-authority.md).

## Quick start

Terminal 1 — relay server (default `ws://localhost:8787`):

```bash
npm run relay
```

Terminal 2 — game:

```bash
npm run dev
```

Optional — relay + vite together:

```bash
npm run dev:party
```

1. Open `http://localhost:5173` in two browsers (or one normal + one incognito).
2. Click **Party Race** on the main menu.
3. Browser A: note the room code → **Create Room**.
4. Browser B: enter the same code → **Join Room**.
5. Host (first player in room) clicks **Start Race** when 2+ players are listed.

Host-authoritative physics spike (Phase 3):

```bash
http://localhost:5173/?hostAuth=1
```

Set a custom relay URL at build time:

```bash
VITE_RELAY_URL=ws://my-host:8787 npm run dev
```

## Architecture

### Phase 1 — Transform sync (default)

```
Browser A (local Rapier)  ──state 20Hz──►  Relay  ──►  Browser B (renders remote marble)
Browser B (local Rapier)  ──state 20Hz──►  Relay  ──►  Browser A (renders remote marble)
```

### Phase 2 — Abilities + inputs + synced start

```
All clients ──ability 30Hz──► Relay ──► peers (visual FX + local-only forces)
All clients ──input 30Hz───► Relay ──► peers (buffered; host consumes in Phase 3)
Host ──start──► Relay ──starting(startAtMs, seed)──► aligned 3-2-1-GO
```

| Component | Path |
|-----------|------|
| Protocol + validation | `src/game/network/protocol.js` (v2) |
| Input bitfield | `src/game/network/input-bitfield.js` |
| Ability sync | `src/game/network/ability-sync.js` |
| Desync HUD | `src/game/network/desync-indicator.js` |
| WebSocket client | `src/game/network/network-client.js` |
| Remote marble rendering | `src/game/network/remote-players.js` |
| Lobby UI | `src/init/multiplayer-menu.js` |
| Relay server | `server/relay.mjs` |

Remote marbles are **visual-only** (no collider), same pattern as ghost replay. Interpolation reuses `sampleReplayAtTime` from the ghost codec.

## Protocol v2

**Version gate:** clients send `protocolVersion: 2` on join. Mismatch → `{ type: 'error', code: 'PROTOCOL_MISMATCH' }`.

### Client → relay

| Type | Fields | Rate limit |
|------|--------|------------|
| `join` | `room`, `name`, `protocolVersion` | — |
| `leave` | — | — |
| `start` | `levelId` (host only) | — |
| `state` | `t`, `x/y/z`, `qx/qy/qz/qw`, `seq`, optional `playerId` (host auth) | 20 Hz |
| `ability` | `id`, `t`, `seq`, `ox/oy/oz`, `dx/dy/dz`, optional `charge` | 30 Hz |
| `input` | `t`, `seq`, `bits`, `yaw`, `pitch` | 30 Hz |
| `ping` | `t` | — |

Ability `id` values must exist in `ABILITY_REGISTRY` (`src/abilities/registry.js`).

### Relay → client

| Type | Notes |
|------|-------|
| `starting` | Adds `startAtMs`, `seed`, `protocolVersion` |
| `ability` | Adds `playerId`; relay broadcasts |
| `input` | Adds `playerId`; relay broadcasts |
| `state` | Adds `playerId` |

### Synced countdown

On `start`, relay sets `startAtMs = Date.now() + 3200` (3×800 ms + GO). All clients load the level paused, run countdown UI aligned to `startAtMs`, and set `levelStartTime = startAtMs` at GO so network `t` timestamps match.

### Ability sync rules

- Caster runs full local ability (Rapier projectiles, cooldowns).
- On success, client emits `ability` message.
- Peers spawn **visual-only** FX via `ability-sync.js`.
- Explosions / black holes apply forces to the **local `playerMarble` only** (party feel without shared physics).
- Deterministic cosmetic variance: `seed ^ hash(playerId, seq)`.

### Input bitfield

```
bits[0:7]   movement WASD / arrows
bits[8:15]  ability keys (ALL_ABILITY_IDS order, first 8)
bits[16]    charging (jump / mouse hold)
bits[17]    grapple held
bits[18:31] reserved
```

`yaw` / `pitch` are degrees ×10 as int16.

### Desync indicator

When remote state streams show velocity/position inconsistency (> 2 u), a yellow **Drift** pill appears (`#mp-desync-pill`). Expected in Phase 1–2 arcade mode until host authority is enabled.

## Disconnect handling

| Event | Client behavior | Server behavior |
|-------|-----------------|-----------------|
| Player closes tab | Relay removes peer, broadcasts `player_left` | Room kept if others remain |
| Host leaves | Next peer becomes host (`room_state` update) | Host migration is **best-effort** |
| Relay unreachable | `onDisconnected` fires; banner shown in HUD | N/A |
| Return to menu | `network.disconnect()` + `remotePlayers.clear()` | `leave` or implicit on socket close |

**Known limitations:**

- Phase 1–2: no shared physics — positions diverge on collisions.
- Phase 3 spike: host auth requires `?hostAuth=1`; host migration does not transfer sim state.
- No reconnection or late-join mid-race.
- Competitive ranked modes require Phase 4 (cloud ghosts / headless sim).

## Security

- All payloads are `JSON.parse` + **whitelist validation** — no `eval`, no dynamic code execution.
- Message size capped at 4 KB; state/ability/input rate limited server-side.
- Room codes are 4–8 uppercase alphanumeric characters.
- Unknown message types and malformed fields are rejected with `error` responses.

## Roadmap

| Phase | Scope |
|-------|-------|
| **1** | Lobby, room codes, transform sync |
| **2** | Ability events, input bitfields, synced countdown, desync HUD, protocol v2 |
| **3** | Host-authoritative physics + client prediction (`?hostAuth=1` spike) |
| **4** | Global ghost leaderboards via `/v1/marbles/ghosts` + `/v1/marbles/leaderboards/{levelId}` ([`backend/README.md`](../../backend/README.md)) |

## Testing

```bash
npm run test:unit          # includes test_network_protocol.js
node scripts/stress-relay.mjs   # requires relay running
```

## Library evaluation (future)

| Option | Pros | Cons |
|--------|------|------|
| **Custom WS relay** (current) | Minimal deps, full control | No matchmaking, no persistence |
| [Colyseus](https://colyseus.io/) | Rooms, state schema | Heavier; physics authority TBD |
| [PartyKit](https://www.partykit.io/) | Edge rooms | Vendor tie-in |

**Recommendation:** Keep the custom relay for Phase 1–2. Phase 3 spike uses host client sim; re-evaluate headless sim for Phase 4.

## Determinism reality check

Rapier WASM in each browser is **not** cross-platform deterministic. Phase 1–2 avoids this by not syncing physics — only transforms (+ visual abilities). Host authority (Phase 3) uses the host browser as reference. Ranked modes should use Option C (headless sim) — see [host-authority.md](./architecture/host-authority.md).
