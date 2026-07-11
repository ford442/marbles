# Language Strategy (ADR)

**Status:** Accepted — July 2026  
**Scope:** Marbles 3D browser game (`index.html` → `src/main.js`)  
**Related:** [architecture/README.md](./README.md), [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)

## Context

The repo mixes JavaScript mixins, strict TypeScript config (unused on game JS), archived React/TSX, a Filament + Rapier runtime, a small C++ physics WASM module, and an unrelated WebGPU experiment. Language choices were accidental; this ADR makes them explicit.

## Decision summary

| Layer | Language | Rationale |
|-------|----------|-----------|
| Game runtime core | **JavaScript → TypeScript (gradual)** | Mixin assembly stays until Phase B composition; new pure modules and migrated hot paths use `.ts` with strict types. |
| UI / HUD | **Vanilla HTML + JS** | `index.html` + `hud-manager.js` ship today; no React in `package.json`. |
| Orphan sequencer / importers | **Archived** | React TSX under `docs/backups/orphan-react-stack/` — not restored without a separate product decision. |
| Numeric physics helpers | **C++ WASM + JS fallbacks** | `wasm/marble_physics.cpp` for batched kernels only; JS mirrors in `wasm-bridge.js`. |
| Filament / Rapier | **Vendor WASM (official npm)** | Do not fork or wrap in custom C++. |
| Backend / cloud saves | **Python (optional)** | `storage/` FastAPI + GCS; not on the browser critical path. |
| Shaders (main game) | **Filament materials** | `public/*.filmat`, `material-system.js`. |
| WGSL / compute experiments | **Deferred** | Future GPU particles or post-FX only after Filament path is stable. |

## When to use C++

**Use C++ WASM when all of the following hold:**

1. **Hot path** — called every frame for many entities (e.g. force fields, damping batches).
2. **Numeric kernel** — pure float math, no DOM, no Filament/Rapier API calls.
3. **Measurable cost** — scalar JS or Embind `{x,y,z}` allocations show up in profiling.
4. **JS fallback required** — every export has an identical implementation in `wasm-bridge.js` + `tests/test_wasm_bridge.js`.

**Do not use C++ for:**

- Rapier body iteration (data lives in Rapier’s WASM heap; copying dominates).
- Filament entity / transform work (stay in JS sync layer).
- One-off zone setup or level loading.
- UI, audio, HUD, or networking.
- “Might be faster someday” without benchmark numbers in `docs/PERFORMANCE_BASELINE.md`.

**Process for new C++ helpers:**

1. Implement scalar + batch in `wasm/marble_physics.cpp`.
2. Add JS fallback + parity tests.
3. Wire through `wasm-bridge.js` with `HEAPF32` batch runner when `N > FORCE_BATCH_THRESHOLD`.
4. Document benchmark delta before expanding scope.

## When to use TypeScript

**Use `.ts` for:**

- Shared types (`src/types/*`).
- Pure functions with stable signatures (`math.ts`, future `game/systems/*`).
- New subsystems in Phase B (`PhysicsWorld`, `LevelLoader`, etc.).
- Public APIs consumed by multiple modules.

**Keep `.js` (for now) for:**

- `MarblesGame` mixin methods still being decomposed.
- Zone factories (`src/zones/*.js`) — migrate per-zone only when touched for other reasons.
- `index.html` inline scripts (none planned).

**Type-checking rollout:**

| Phase | `checkJs` scope | Action |
|-------|-----------------|--------|
| **Now** | `src/math.js` shim + all `src/**/*.ts` | Pilot: `math.ts` + `types/geometry.ts` |
| **Next** | `+ src/wasm-bridge.js`, `src/game/state/*.js` | JSDoc + `@ts-check` on high-value bridges |
| **Later** | `+ src/game/systems/`, `src/levels/catalog.js` | Level/ability types; then mixin extraction |
| **Not yet** | `src/zones/**`, `src/game-loop/render.js` | Large files; type after subsystem split |

`npm run typecheck` must pass at each phase before widening `include`.

## UI stack

**Decision: stay vanilla for the shipped game.**

- HUD: DOM in `index.html`, logic in `hud-manager.js`.
- No `react` / `react-dom` in root `package.json`.
- If a music sequencer or shader gallery returns, it must be a **separate package** (e.g. `packages/sequencer/`) with its own deps and entry — not mixed into `src/main.js`.

## Archived surfaces (explicit decisions)

### React / TSX orphans — **KEEP ARCHIVED**

| Location | Contents | Decision |
|----------|----------|----------|
| `docs/backups/orphan-react-stack/` | Sequencer, Shadertoy gallery, AI/RBS importers, React tests | **Do not restore** to `src/`. Reference only. Spin out to `packages/*` if product revives. |

Tests there expect `@testing-library/react` and are intentionally **not** in `npm run test:unit`.

### `wasm_renderer/` WebGPU experiment — **ARCHIVED (non-runtime)**

| Location | Contents | Decision |
|----------|----------|----------|
| `docs/backups/experimental-wasm-renderer/` | C++ WebGPU + Dawn stub, React bridge samples | **Do not integrate** with Filament game loop. Different renderer (WebGPU compute) from Marbles’ Filament + Rapier path. Revive only for a standalone shader tool or after a dedicated rendering ADR. |

Previously lived at repo root `wasm_renderer/`; moved July 2026. Only referenced from archived React shader components.

**Contrast with active WASM:**

| Module | Path | Role |
|--------|------|------|
| MarblePhysics | `wasm/` → `public/wasm/` | Batched float kernels (force fields, damping) |
| Filament | `filament` npm | Primary renderer |
| Rapier | `@dimforge/rapier3d-compat` | Physics simulation |

## Pilot module: `math.ts`

First fully typed runtime module:

- `src/types/geometry.ts` — `Vec3`, `Quat`, `Mat4`
- `src/math.ts` — `quatFromEuler`, `quaternionToMat4`
- `src/math.js` — thin re-export shim so existing JS imports unchanged

Downstream JS (`game-loop/sync.js`, zones, abilities) imports `./math.js` and receives typed implementations via Vite + `tsc`.

## Consequences

- **Positive:** Clear boundary for C++ vs JS vs TS; less accidental React/WebGPU scope creep; `typecheck` becomes meaningful as `include` grows.
- **Negative:** Dual `.js` shims during migration; contributors must read this ADR before adding languages.
- **Neutral:** Python backend unchanged; Filament/Rapier versions follow upstream.

## Review triggers

Revisit this ADR when:

- Phase B replaces mixins with composed subsystems.
- Multiplayer or worker threads require SharedArrayBuffer physics sharing.
- A second UI product (sequencer) is greenlit.
- WebGPU post-processing ships inside the main game (not a side tool).
