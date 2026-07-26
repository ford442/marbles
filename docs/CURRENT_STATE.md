# Marbles 3D — Current State

Single-page dashboard for contributors and agents. Canonical detail lives in linked docs — this file is the index.

Last aligned with repo audit: July 2026.

## Health checklist

| Check | Status | Command / location |
|-------|--------|-------------------|
| Unit tests | ✅ | `npm run test:unit` (38 files, including rebuilt WASM parity) |
| Lint | ✅ | `npm run lint` |
| Typecheck | ✅ | `npm run typecheck` (narrow `include`; widening is Phase C) |
| Asset validation | ✅ | `npm run validate:assets` (CI + optional local hook) |
| CI build | ✅ | [.github/workflows/debug_build.yml](../.github/workflows/debug_build.yml) — rebuilds WASM before unit/parity, then Vite |
| E2E smoke | ⚠️ optional | `e2e-smoke` job, `continue-on-error: true`; local: `npm run test:e2e:smoke` |
| Playwright full e2e | Manual | `npm run dev` then `npm run test:e2e` (missile lifecycle) |

Headless WebGL + Filament in CI may flake occasionally; the smoke job is intentionally non-blocking until signal is stable.

## Level catalog

Counts from [architecture/level-inventory.json](architecture/level-inventory.json) (regenerate: `node scripts/generate-level-inventory.cjs`):

| Metric | Count |
|--------|------:|
| Shipped (manifest) | 24 |
| `DEV_LEVELS` entries | 52 |
| Unique level ids | 76 |
| Map JSON files on disk | 28 (including 4 archived prototypes) |

Policy: [architecture/level-pipeline.md](architecture/level-pipeline.md). Campaign content ships as JSON + manifest only.

## Architecture migration (Phase A / B / C)

Canonical checklist: [architecture/README.md](architecture/README.md).

| Phase | Focus | Status |
|-------|-------|--------|
| **A** | Single home per concern (`src/game-loop/`, thin re-exports) | ✅ largely complete |
| **B** | Composition — explicit subsystem delegation + closed legacy method lists | ✅ complete |
| **C** | TypeScript on pure systems + `@ts-check` state | In progress |

Language boundaries (no React/three.js in game bundle): [architecture/language-strategy.md](architecture/language-strategy.md).

## Runtime dependencies

Only two npm **runtime** dependencies — keep it that way:

| Package | Role |
|---------|------|
| `filament` | WebGL2 PBR renderer |
| `@dimforge/rapier3d-compat` | Physics |

Dev tooling (Vite, Playwright, ESLint, TypeScript) stays in `devDependencies`.

## Backend scope

Optional **Marbles cloud sync** when `VITE_MARBLES_API_URL` is set (campaign progress + ghost leaderboards). **Not required for local play.**

| Surface | Path | Notes |
|---------|------|-------|
| Marbles API | `/v1/marbles/*` | Always mounted |
| Legacy music/sequencer | `/api/songs`, `/api/samples`, … | Archived; off when `ENABLE_LEGACY_MUSIC_API=0` |

Details: [backend/README.md](../backend/README.md).

## Services

| Service | Required? | Notes |
|---------|-----------|-------|
| Vite dev server | Yes (to play) | `npm run dev` → :5173 |
| Party relay | No | `npm run relay` — [multiplayer.md](multiplayer.md) |
| Python storage API | No | GCP credentials for cloud features |

## Archived code (do not restore to `src/`)

Intentional archive — reduces noise for contributors:

| Location | Contents |
|----------|----------|
| [backups/README.md](backups/README.md) | Index |
| [backups/orphan-react-stack/](backups/orphan-react-stack/) | React sequencer/importers |
| [backups/experimental-wasm-renderer/](backups/experimental-wasm-renderer/) | C++ Dawn WebGPU experiment |
| [backups/GAME_ANALYSIS-2025.md](backups/GAME_ANALYSIS-2025.md) | Historical 7-level analysis |

## CI and E2E

**Main CI** (`debug_build.yml`): install Emscripten → build WASM → validate assets → unit tests → lint → typecheck → Vite build → explicit WASM parity → upload `dist/` artifact.

**E2E smoke** (optional job, `needs: ci`):

```bash
npm run build
npm run preview -- --port 5173 &
BASE_URL=http://localhost:5173 npm run test:e2e:smoke
```

Requires `npx playwright install chromium` locally.

## Optional local pre-commit hook

CI runs `validate:assets` on every push/PR. To opt in locally:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

See [CONTRIBUTING.md](CONTRIBUTING.md#asset-validation).

## Related docs

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — runtime entry graph
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add content
- [AGENTS.md](../AGENTS.md) — Cursor Cloud agent ops (prefer over `docs/AGENTS.md`)
- Historical game analysis stub: [GAME_ANALYSIS.md](GAME_ANALYSIS.md)
