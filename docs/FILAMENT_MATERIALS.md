# Filament runtime and materials

Filament loads a compiled material only if it was compiled by the `matc` of the **same release** as the runtime (the package carries a material version: Filament 1.N.x emits and accepts version N). So the runtime and the compiled materials are pinned together in [`scripts/filament.json`](../scripts/filament.json) and rebuilt by script.

| Command | What it does |
|---|---|
| `npm run vendor:filament` | Downloads the pinned web release (sha256-checked) and writes `public/filament.js` (with one local patch), `public/filament.wasm` and `docs/reference/filament.d.ts`. |
| `npm run build:materials` | Compiles every material in `scripts/filament.json` with the pinned release's `matc` and rewrites `scripts/materials.lock.json`. |
| `npm run check:materials` | Verifies the committed runtime against the pin and recompiles the materials into a temp dir to compare with the committed binaries. CI runs this. |

`matc` is downloaded on first use into `node_modules/.cache/filament/<version>/` (Linux x64 and macOS; override the location with `FILAMENT_TOOLS_DIR`). To use your own binary set `MATC=/path/to/matc`; it is rejected unless it emits the pinned material version. `tests/test_filament_pipeline.js` (in `npm test`) checks the committed state without network or `matc`: runtime checksums, each binary's material version, and that no `.mat` changed since its binary was built.

## Materials

| Source | Compiled | Loaded |
|---|---|---|
| `public/custom_material.mat` | `public/baked_color.filmat` | always |
| `public/custom_material_procedural.mat` | `public/baked_procedural.filament` | with `?proceduralMaterial=1` |
| `custom_material_enhanced`, `galactic_core`, `neon_glow`, `shadow_ninja`, `volcanic_magma` | not shipped | compiled by `build:materials` only to prove they still build |
| `public/marble_materials.mat` | — | reference notes; every block is commented out |

Flags: `--api opengl --platform mobile` (WebGL 2 is the ESSL 3.0 "mobile" family). `--optimize-size` would shrink the binaries roughly 3× in exchange for less-optimised shaders; it is not used.

To ship a new material: add `{ "source": ..., "output": ... }` to `materials` in `scripts/filament.json`, run `npm run build:materials`, commit the binary and the lock.

## Upgrading Filament

1. In `scripts/filament.json` set `version`, `materialVersion` (the minor number) and the three archive checksums.
2. `npm run vendor:filament`, then `npm run build:materials`.
3. Bump `CACHE_VERSION` in `public/sw.js` so installed clients switch runtime and materials together.
4. `npm test`, then the browser checks (`npm run test:e2e:smoke`, `npm run test:e2e:actions`).

The npm `filament` package stopped at 1.53.4, which is why the runtime is vendored from the GitHub release instead of installed.

## Two rules the runtime enforces by aborting

Filament's web build has no exceptions: a failed precondition calls `abort()`, which kills the engine for the session. A `try/catch` does not help.

- **Unknown uniform.** `setFloatParameter('name', …)` with a name the material does not declare aborts. Every literal name set in `src/` is checked against `custom_material_procedural.mat` by `tests/test_filament_pipeline.js`.
- **One frame at a time.** `renderer.render(swapChain, view)` in the JS bindings is already `beginFrame` + `renderView` + `endFrame` + `engine.execute()`. Wrapping it in another `beginFrame`/`endFrame` aborts on 1.59 ("SwapChain must remain valid until endFrame is called").

## State of the procedural material

Until November 2026 the committed `baked_procedural.filament` was material version 71 while the runtime was 1.53.4, so it could never load and `?proceduralMaterial=1` silently fell back to the simple material. It now compiles from source and loads. That code path had never run against a real material; the fixes needed to get a level on screen are in, but its look has not been reviewed, so it stays opt-in.
