# Language Strategy (ADR)

**Status:** Accepted — July 2026; type-checking rollout refreshed September 2026  
**Scope:** Marbles 3D browser game (`index.html` → `src/main.js`)  
**Related:** [architecture/README.md](./README.md), [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)

## Context

The repo mixes JavaScript mixins, strict TypeScript config (unused on game JS), archived React/TSX, a Filament + Rapier runtime, a small C++ physics WASM module, and an unrelated WebGPU experiment. Language choices were accidental; this ADR makes them explicit.

## Decision summary

| Layer | Language | Rationale |
|-------|----------|-----------|
| Game runtime core | **JavaScript → TypeScript (gradual)** | Phase B composition is done; the composed systems in `src/game/systems/` are `.ts`. Remaining mixin-installed slices (`game-loop/*`, `init/*`, zones) stay JS until touched. |
| UI / HUD | **Vanilla HTML + TS** | `index.html` + `src/hud-manager.ts` ship today; no React in `package.json`. |
| Orphan sequencer / importers | **Archived** | React TSX under `docs/backups/orphan-react-stack/` — not restored without a separate product decision. |
| Numeric physics helpers | **C++ WASM + JS fallbacks** | `wasm/marble_physics.cpp` for batched kernels only; JS mirrors in `wasm-bridge.js` (`@ts-check`, in `tsconfig.json` `include`). |
| Filament / Rapier | **Vendor WASM (official npm)** | Do not fork or wrap in custom C++. |
| Backend / cloud saves | **Python (optional)** | `storage/` FastAPI + GCS; not on the browser critical path. |
| Shaders (main game) | **Filament materials** | `public/*.filmat`, `material-system.ts`. |
| WGSL / compute | **Opt-in, JS** | `src/webgpu/` (boot probe, particle backend) and `src/gpu-chores/`; GPU types come from the `@webgpu/types` devDependency. Filament still renders on WebGL2. |

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
- Pure functions with stable signatures (`math.ts`, `game/systems/*-pure.ts`).
- Composed subsystems (`PhysicsWorld`, `InputSystem`, `RenderPipeline`, `HudController`, `LevelLoader`, `AbilitySystem`, physics backends). Each declares a narrow `*Host` interface for the slice of the game it touches; Filament handles cross that boundary as `FilamentHandle` / `FilamentModule` (`src/types/filament.ts`).
- Public APIs consumed by multiple modules.

**Use `.js` + `// @ts-check` + JSDoc when** a file is stable but tied to browser/GPU globals or SharedArrayBuffer views (`wasm-bridge.js`, `webgpu/boot-probe.js`, `webgpu/particle-backend.js`, `game/state/*`, `levels/*`, `abilities/registry.js`, `game/network/protocol.js`). A plain `.js` file is **not** type-checked: `checkJs` is `false`, so JS is checked only when it is in `include` **and** carries `@ts-check`.

**Keep unchecked `.js` (for now) for:**

- Filament-heavy runtime slices: `game-loop/sync.js` (last to migrate) and the other mixin-installed `game-loop/*`, `init/*`, `game-logic/*`, `zone-setup/*` files.
- Zone factories (`src/zones/*.js`) — migrate per-zone only when touched for other reasons.
- Numeric hot-loop WebGPU helpers (`webgpu/camera-math.js`, `occlusion.js`, `gpu-chores/cpu-jobs.js`, …): in `include`, but not `@ts-check` yet — `noUncheckedIndexedAccess` makes typed-array indexing noisy, so opt in per file when touched.
- `index.html` inline scripts (none planned).

**Type-checking rollout:**

| Phase | `include` scope | Status |
|-------|-----------------|--------|
| **Pilot** | `src/math.ts`, `types/geometry.ts` | ✅ (the old `math.js` re-export shim has been removed; import `../math.ts` directly) |
| **Slice 1** | `src/wasm-bridge.js`, `src/game/state/*.js` | ✅ `@ts-check` + `types/game-state.ts`, `types/wasm-physics.ts` |
| **Slice 2** | Pure systems → `.ts`: `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec` | ✅ |
| **Slice 3** | `levels/catalog.js`, `levels/campaign.js`, `types/map.ts`, `abilities/registry.js` | ✅ |
| **Slice 4** | `physics-world-pure`, `physics-backend-pure`, `input-target-lock`, network protocol validators | ✅ |
| **Slice 5** (Sept 2026) | Composed systems → `.ts`: `physics-world`, `input-system`, `render-pipeline`, `level-loader`, `hud-controller`, `ability-system`, `physics-backend`; `game-loop/{helpers,loop}.ts`; `HUDManager` typed against `HudHost`; `@ts-check` on `webgpu/boot-probe.js` and `webgpu/particle-backend.js` (real `GPUDevice`/`GPUCanvasContext` via `@webgpu/types`); `wasm-bridge.js`, `webgpu/**`, `gpu-chores/**` added to `include` | ✅ |
| **Not yet** | `game-loop/sync.js` (Filament-heavy, migrate last), remaining `game-loop/*`, `src/zones/**`, other `@ts-check`-less JS in `webgpu/` and `gpu-chores/` | Type when touched |

Current `tsconfig.json` `include` (kept in sync with the file — update both together):

```json
"src/types/**/*.d.ts",
"src/types/**/*.ts",
"src/game/**/*.ts",
"src/game/state/**/*.js",
"src/game/systems/**/*.js",
"src/game/network/**/*.js",
"src/game/physics-worker/**/*.js",
"src/game/level-behaviors/**/*.js",
"src/hud-manager.ts",
"src/material-system.ts",
"src/levels.ts",
"src/math.ts",
"src/levels/catalog.js",
"src/levels/campaign.js",
"src/abilities/registry.js",
"src/game-loop/**/*.ts",
"src/wasm-bridge.js",
"src/webgpu/**/*.js",
"src/gpu-chores/**/*.js"
```

`compilerOptions.types` is `["@webgpu/types"]`. `npm run typecheck` must pass at each phase before widening `include`.

## UI stack

**Decision: stay vanilla for the shipped game.**

- HUD: DOM in `index.html`, logic in `hud-manager.ts` (`HUDManager<Host extends HudHost>`).
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

There is no `math.js` shim any more; JS and TS callers import `math.ts` directly (Vite and Node's type stripping both resolve the explicit `.ts` extension).

## Typed state, pure systems, and composed systems

- `src/types/game-state.ts` — `GameState`, `PhysicsState`, `AbilityState`, … factory return shapes
- `src/types/wasm-physics.ts` — `MarblePhysicsApi` (used by `@ts-check` on `wasm-bridge.js`)
- `src/types/global.d.ts` — `Window` extensions for game bootstrap flags (`webgpuProbe`, `webgpuParticlesReady`, …)
- `src/types/filament.ts` — `FilamentModule` / `FilamentHandle` boundary aliases (deliberately `any`)
- `src/game/state/*.js` — `@ts-check` factories; JSDoc `@returns` wired to `GameState` slices
- Pure systems in `.ts`, imported directly (no `.js` shims): `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec`, `physics-world-pure`, `physics-backend-pure`, `input-target-lock`
- Composed systems in `.ts`, each exporting its `*Host` interface: `PhysicsWorldHost`, `InputSystemHost`, `RenderPipelineHost`, `HudControllerHost` (extends `HudHost`), `AbilityHost`, `PhysicsBackendHost`, `LevelLoaderDeps`. `main.js` (JS, unchecked) still wires them together, so these interfaces document the contract the game object must satisfy but are not enforced at the `new X(this)` call sites.
- `src/types/map.ts` mirrors the declared map schema while retaining `unknown` extension fields used by legacy and specialized maps.
- `src/levels/{catalog,campaign}.js` and `src/abilities/registry.js` are strict checked JavaScript with typed public catalog, chapter, registry, and mask APIs.
- `src/game/network/protocol.js` remains strict checked JavaScript because the browser and Node 20 relay execute the same file; discriminated wire contracts live in `protocol-types.ts`.

Tests run under Node's native type stripping, so `.ts` modules must stay erasable-syntax only (no enums, namespaces, or constructor parameter properties) and use explicit `.ts` import extensions.

Intentional remaining exclusions are `game-loop/sync.js`, the other mixin-installed frame slices, `src/zones/**`, renderer/material implementations, and editor implementation files.

## Compatibility shims

The root `src/*-methods.js` deprecation shims (`ability-`, `init-`, `game-logic-`, `zone-setup-`, `marble-management-`, `physics-factory-`, `input-methods.js`) were **deleted** in September 2026 once no import remained; `main.js` imports the canonical `abilities/`, `init/`, `game-logic/`, and `zone-setup/` index modules directly. There are no `.js` re-export shims for the `.ts` systems. Do not add new ones.

## Consequences

- **Positive:** Clear boundary for C++ vs JS vs TS; less accidental React/WebGPU scope creep; `typecheck` becomes meaningful as `include` grows.
- **Negative:** Contributors must read this ADR before adding languages; `@ts-check` files need JSDoc for anything TypeScript cannot infer.
- **Neutral:** Python backend unchanged; Filament/Rapier versions follow upstream.

## Review triggers

Revisit this ADR when:

- `game-loop/sync.js` or the zone factories are migrated to TypeScript.
- Multiplayer or worker threads require SharedArrayBuffer physics sharing.
- A second UI product (sequencer) is greenlit.
- WebGPU post-processing ships inside the main game (not a side tool).
