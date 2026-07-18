# Orphan React / TSX Stack (Archived)

**Decision:** Archived July 2026 — **not part of the shipped Marbles 3D game**.

## Contents

| Path | Purpose |
|------|---------|
| `components/` | MainLayout, AISwarmModal, ImportRbsModal, shader gallery |
| `sequencer/` | EffectsChain, SequencerGrid |
| `importers/` | AI song + `.rbs` parsers and modals |
| `services/shaderApi.ts` | Remote shader API client |
| `shaders/*.wgsl` | WGSL samples for gallery demo |
| `__tests__/` | React Testing Library specs |

## Why archived

- Root `package.json` has **no** `react`, `react-dom`, or `@testing-library/react`.
- Nothing in `index.html` or `src/main.js` imports these modules.
- Tests fail normal CI expectations without adding a full React toolchain to the game package.

## If reviving

1. Create a **separate package** (e.g. `packages/sequencer/`) with its own `package.json` and Vite entry.
2. Do **not** re-merge into `src/` on the `main.js` graph.
3. See [language-strategy.md](../../architecture/language-strategy.md).

## Related archive

WebGPU WASM renderer experiment: `docs/backups/experimental-wasm-renderer/`.
