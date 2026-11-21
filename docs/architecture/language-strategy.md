# Language Strategy (ADR)

**Status:** Accepted — July 2026; type-checking rollout refreshed September 2026  
**Scope:** Marbles 3D browser game (`index.html` → `src/main.js`)  
**Related:** [architecture/README.md](./README.md), [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)

## Context

The repo mixes JavaScript mixins, strict TypeScript config (unused on game JS), archived React/TSX, a Filament + Rapier runtime, a small C++ physics WASM module, and an unrelated WebGPU experiment. Language choices were accidental; this ADR makes them explicit.

## Decision summary

| Layer | Language | Rationale |
|-------|----------|-----------|
| Game runtime core | **JavaScript → TypeScript (gradual)** | Done (Phase D): composed systems and feature slices are `.ts` or `@ts-check` JS; all of `src/` is type-checked. New runtime code is `.ts`. |
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

**Use `.js` + `// @ts-check` + JSDoc when** a file is stable but tied to browser/GPU globals or SharedArrayBuffer views (`wasm-bridge.js`, `webgpu/*`, `gpu-chores/*`), is imported by Node tests or the relay under its `.js` name (`game/state/*`, `levels/*`, `game/network/protocol.js`, `pwa/pwa-state.js`), is generated (`marbles_data.js`), or is a zone factory (`src/zones/*.js`, typed `@param {ZoneBuildHost} game`). A plain `.js` file is **not** type-checked: `checkJs` is `false`, so a JS file without `@ts-check` is outside the typed set, and `npm run typecheck:coverage` reports it.

**Every file in `src/` is now typed** (Phase D, Nov 2026): 146 `.ts` files and 136 `@ts-check` `.js` files, 100% of `src/` LOC (`src/types/generated/` excluded from the count).

### Compiler settings

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `compilerOptions.types: ["@webgpu/types"]`, and

```json
"include": ["src/**/*.ts", "src/**/*.js", "scripts/level-lab.mjs"]
```

`erasableSyntaxOnly` keeps every `.ts` file runnable under Node's `--experimental-strip-types` (tests, level lab): no enums, namespaces or constructor parameter properties, and explicit `.ts` import extensions. Class fields that are only typed — assigned in the constructor, as the original JS did — are written `declare foo: T`, so they are erased instead of being emitted as ES2022 field initialisers (which also kept the entry chunk inside its size budget).

### Coverage ratchet

`npm run typecheck:coverage` (`scripts/ts-coverage.mjs`, run in CI after Typecheck) counts the files in the tsconfig program that are `.ts` or `@ts-check` JS and compares against `scripts/ts-coverage-baseline.json`:

- typed file count and typed LOC share may not drop;
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` count may not grow (the baseline's 8 are the deliberate negative fixtures in `game/create-runtime.types-test.ts` and similar).

`--list` prints untyped files, `--json` emits machine-readable output, `--update` rewrites the baseline after coverage improves.

### Host types (no mixins)

The game object is assembled from feature slices (`*_SLICES`, see `game/systems/slice-composition.ts`) and composed systems (`game/create-runtime.ts`). Every slice and system declares a narrow `*Host` built from `Pick`s of shared contracts instead of re-declaring fields:

- `types/engine-context.ts` — `EngineContext`: Rapier world, Filament handles, lights, budgets, services.
- `types/frame-host.ts` — `FrameState` / `FrameHost` for frame slices.
- `types/zone-host.ts` — `ZoneBuildHost` for zone factories and `zones/methods/*`.
- `types/settings.ts` — `GameSettings`.
- `types/game-host.ts` — `GameHost`, the intersection of the composed systems' hosts (what `createRuntime` takes).
- `types/marbles-game-host.ts` — `MarblesGameHost` = `GameHost` & every directory's `*SlicesHost`; `main.js` builds the object against it.

`game/create-runtime.types-test.ts` fails the typecheck if `createRuntime` stops rejecting a host missing a required field, if any member of `GameHost`, `FrameHost` or `MarblesGameHost` collapses to `never` (two hosts disagree about a field), or if any of them grows an index signature.

### Schema-generated types

`npm run gen:schema-types` (`scripts/gen-schema-types.mjs`, `json-schema-to-typescript`) writes `src/types/generated/{map,marble,sound}-schema.ts` from `assets/schemas/*.json`; `npm run validate:assets` runs it with `--check`, so CI fails on a stale file. `types/map.ts` names parts of the generated `MapSchema` (it declares no authored field itself); `zone-setup/primitives.ts`, the map editor, `levels/map-normalize.js`, workshop import/export and `scripts/level-lab.mjs` all use it. Edit the schema, regenerate, commit both.

**Type-checking rollout:**

| Phase | Scope | Status |
|-------|-------|--------|
| **Pilot** | `src/math.ts`, `types/geometry.ts` | ✅ |
| **Slice 1** | `src/wasm-bridge.js`, `src/game/state/*.js` | ✅ `@ts-check` + `types/game-state.ts`, `types/wasm-physics.ts` |
| **Slice 2** | Pure systems → `.ts`: `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec` | ✅ |
| **Slice 3** | `levels/catalog.js`, `levels/campaign.js`, `types/map.ts`, `abilities/registry.js` | ✅ |
| **Slice 4** | `physics-world-pure`, `physics-backend-pure`, `input-target-lock`, network protocol validators | ✅ |
| **Slice 5** (Sept 2026) | Composed systems → `.ts`; `game-loop/{helpers,loop}.ts`; `HUDManager` typed against `HudHost`; `@webgpu/types` | ✅ |
| **Slice 6** (Oct 2026) | Physics correctness: `physics-queries.ts`, `fixed-step-clock.ts`, `body-impulse.ts`; raycast call sites checked | ✅ |
| **Slice 7** (Nov 2026) | `GameHost` + `create-runtime.ts` (negative fixture `create-runtime.types-test.ts`); frame slices typed against `FrameHost` | ✅ |
| **Phase D** (Nov 2026) | Every `install*Methods` slice composed (`method-installer.js` and `types/mixin-host.ts` deleted); `init/`, `game-loop/` (incl. `sync.ts`), `game-logic/`, `abilities/`, `zone-setup/`, `zones/**`, editor, audio, rendering, perf, `webgpu/`, `gpu-chores/`, `main.js` typed; `include` = all of `src/`; ratchet + schema types | ✅ 100% |

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
| MarblePhysics | `wasm/` → `public/wasm/` | Batched float kernels (force fields, damping, springs, segment projection) |
| Filament | `filament` npm | Primary renderer |
| Rapier | `@dimforge/rapier3d-compat` | Physics simulation |

## Pilot module: `math.ts`

First fully typed runtime module:

- `src/types/geometry.ts` — `Vec3`, `Quat`, `Mat4`
- `src/math.ts` — `quatFromYawPitchRoll`, `quaternionToMat4`

There is no `math.js` shim any more; JS and TS callers import `math.ts` directly (Vite and Node's type stripping both resolve the explicit `.ts` extension).

## Typed state, pure systems, and composed systems

- `src/types/game-state.ts` — `GameState`, `PhysicsState`, `AbilityState`, … factory return shapes
- `src/types/wasm-physics.ts` — `MarblePhysicsApi` (used by `@ts-check` on `wasm-bridge.js`)
- `src/types/global.d.ts` — `Window` extensions for game bootstrap flags (`webgpuProbe`, `webgpuParticlesReady`, …)
- `src/types/filament.ts` — `FilamentModule` / `FilamentHandle` boundary aliases (deliberately `any`)
- `src/game/state/*.js` — `@ts-check` factories; JSDoc `@returns` wired to `GameState` slices
- Pure systems in `.ts`, imported directly (no `.js` shims): `ability-cooldown`, `trick-scoring`, `campaign-progress`, `replay-codec`, `physics-world-pure`, `physics-backend-pure`, `input-target-lock`
- Composed systems in `.ts`, each exporting its `*Host` interface: `PhysicsWorldHost`, `InputSystemHost`, `RenderPipelineHost`, `HudControllerHost` (extends `HudHost`), `AbilityHost`, `PhysicsBackendHost`, `LevelLoaderDeps`. `main.js` (`@ts-check`) builds the game as a `MarblesGameHost`, so these contracts are enforced at every `new X(host)` call site.
- `src/types/map.ts` is derived from the schema-generated `MapSchema`; `RuntimeLevel` retains `unknown` extension fields used by zone handlers.
- `src/levels/{catalog,campaign}.js` and `src/abilities/registry.js` are strict checked JavaScript with typed public catalog, chapter, registry, and mask APIs.
- `src/game/network/protocol.js` remains strict checked JavaScript because the browser and Node 20 relay execute the same file; discriminated wire contracts live in `protocol-types.ts`.

Tests run under Node's native type stripping, so `.ts` modules must stay erasable-syntax only (no enums, namespaces, or constructor parameter properties) and use explicit `.ts` import extensions.

There are no intentional exclusions left in `src/`; the only untyped TypeScript surface is the Filament boundary (`FilamentHandle` / `FilamentModule`, deliberately `any`).

## Compatibility shims

The `install*Methods` installers and `game/systems/method-installer.js` were **deleted** in Phase D (Nov 2026); see [README.md](./README.md#adding-behaviour-no-mixins).


The root `src/*-methods.js` deprecation shims (`ability-`, `init-`, `game-logic-`, `zone-setup-`, `marble-management-`, `physics-factory-`, `input-methods.js`) were **deleted** in September 2026 once no import remained; `main.js` imports the canonical `abilities/`, `init/`, `game-logic/`, and `zone-setup/` index modules directly. There are no `.js` re-export shims for the `.ts` systems. Do not add new ones.

## Consequences

- **Positive:** Clear boundary for C++ vs JS vs TS; less accidental React/WebGPU scope creep; `typecheck` covers all of `src/` and the ratchet keeps it there.
- **Negative:** Contributors must read this ADR before adding languages; `@ts-check` files need JSDoc for anything TypeScript cannot infer.
- **Neutral:** Python backend unchanged; Filament/Rapier versions follow upstream.

## Review triggers

Revisit this ADR when:

- The Filament boundary gets real types (replacing `FilamentHandle` / `FilamentModule`).
- Multiplayer or worker threads require SharedArrayBuffer physics sharing.
- A second UI product (sequencer) is greenlit.
- WebGPU post-processing ships inside the main game (not a side tool).
