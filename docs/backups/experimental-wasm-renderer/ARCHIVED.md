# Experimental WebGPU WASM Renderer (Archived)

**Decision:** Archived July 2026 — **not integrated** with the Marbles Filament + Rapier game loop.

This was a C++ / Emscripten / WebGPU (Dawn) experiment for WGSL compute shaders and a React toggle UI. It targets a different rendering stack than the shipped game (`filament` npm + `index.html` → `src/main.js`).

## Why archived

- No imports from the active runtime graph.
- Only referenced from `docs/backups/orphan-react-stack/` shader gallery components.
- Overlaps conceptually with Filament but does not share entities, materials, or the game loop.
- Reviving it requires a separate product decision (shader playground) or a future rendering ADR — not incremental game work.

## Active WASM in Marbles

Use `wasm/marble_physics.cpp` for numeric physics kernels (`npm run build:wasm`). See [language-strategy.md](../../architecture/language-strategy.md).

## Build (reference only)

```bash
cd docs/backups/experimental-wasm-renderer
./build.sh   # requires Emscripten
```

See `README.md` in this folder for the original API notes.
