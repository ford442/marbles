# Host-Authoritative Physics (Party Race Phase 3)

Design for competitive Party Race mode where one client (the room host) simulates Rapier physics for all player marbles.

## Authority model — Option A

The **host client** runs a single Rapier world containing:

- All level static/dynamic geometry (existing level load)
- One dynamic marble rigid body per connected player (`networkMarbles` map)

Non-host clients:

- Send **input snapshots** at 30 Hz (`input` message, Phase 2 wire format)
- Do **not** send transform `state` when `?hostAuth=1` is active
- Predict local marble movement between host corrections
- Render remote marbles as interpolated ghosts from host snapshots

```
Client A (host)  ──input──►  (local) ──► HostSim ──state×N──►  Relay  ──►  Client B
Client B         ──input──►  Relay ──► HostSim (host reads buffers)
```

## Wire protocol (Phase 3 additions)

| Direction | Message | Notes |
|-----------|---------|-------|
| Client → Relay | `input` | 30 Hz bitfield + yaw/pitch (Phase 2) |
| Client → Relay | `state` | **Disabled** for clients in host-auth mode |
| Host → Relay | `state` | Includes optional `playerId` for each simulated marble |
| Relay → All | `state` | Forwarded with `playerId`; clients buffer all ids |

Enable host authority in dev with `?hostAuth=1` on the game URL during Party Race.

## Prediction and reconciliation

**Owning client (`ClientPrediction`):**

1. Record local input ring buffer (~12 frames)
2. Continue running local Rapier on `playerMarble` for responsiveness
3. On host `state` for own `playerId`:
   - Error ≤ 0.5 u → soft blend (25%) toward host position
   - Error > 5 u → hard snap + console warning

**Remote marbles:** unchanged Phase 1 ghost interpolation via `RemotePlayers` + `sampleReplayAtTime`.

Future work: rewind/replay input buffer on correction (Frame Advantage style) — not in spike.

## Abilities

Phase 2 **visual + local force** ability sync remains on all clients.

Phase 3 v1: host does **not** re-simulate ability projectiles authoritatively. Host validates cooldowns in a follow-up PR. Clients keep cosmetic prediction from Phase 2.

## Host migration

**Phase 3 v1 limitation:** if the host disconnects mid-race, the relay performs best-effort host promotion (Phase 1 behavior) but **does not migrate simulation state**. The race should pause/abort; players return to lobby and start fresh.

Documented in [`docs/multiplayer.md`](../multiplayer.md).

## Determinism

Cross-browser/platform determinism is an **explicit non-goal**. The reference environment is the host's browser + Rapier WASM build. Ranked seasons (Phase 4) require Option C (headless sim) or a controlled host stack.

## Desync handling

| Severity | Threshold | Action |
|----------|-----------|--------|
| Soft | > 2 u for 500 ms (Phase 2 metric) | Yellow HUD pill (`#mp-desync-pill`) |
| Hard | > 5 u vs host snapshot | Snap local marble to host state |

## Implementation map

| Module | Role |
|--------|------|
| [`src/game/network/host-sim.js`](../../src/game/network/host-sim.js) | Host tick: apply inputs, step world, broadcast snapshots |
| [`src/game/network/client-prediction.js`](../../src/game/network/client-prediction.js) | Input buffer + reconcile |
| [`src/game/systems/physics-world.js`](../../src/game/systems/physics-world.js) | `createNetworkMarble`, `applyInputToMarble`, `removeNetworkMarbles` |
| [`src/game/network/input-bitfield.js`](../../src/game/network/input-bitfield.js) | Shared input encoding |
| [`scripts/stress-relay.mjs`](../../scripts/stress-relay.mjs) | 4-client relay load test |

## Stress test

Terminal 1:

```bash
npm run relay
```

Terminal 2:

```bash
node scripts/stress-relay.mjs --duration 10
```

Expect relay to remain responsive on localhost; watch for `ROOM_FULL` or `BAD_MESSAGE` errors.

## Option C (future)

A Rust/C++ or Node headless Rapier service aligns with the existing [`wasm/`](../../wasm/) numeric kernel direction but is **out of scope** for Phase 3 spike. Re-evaluate when ranked seasons (Phase 4) require persistent authoritative sims.
