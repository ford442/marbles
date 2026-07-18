# Marbles 3D Game - Agent Guide

> **Superseded for agent ops** by root [AGENTS.md](../AGENTS.md). This file is a historical reference only — many sections describe archived React/sequencer surfaces and outdated project layout.

This document provides essential information for AI coding agents working on the Marbles 3D project.

## Project Overview

**Marbles** is a browser-based 3D marble roller game that combines:
- **Physics Simulation**: Rapier3D-Compat for realistic physics (gravity: -9.81 m/s²)
- **3D Rendering**: Google Filament (WASM) for high-performance WebGL2 rendering
- **Build System**: Vite for development and production builds
- **UI Layer**: Vanilla HTML HUD (`index.html`, `hud-manager.js`); React stack archived under `docs/backups/orphan-react-stack/`
- **Backend**: Python FastAPI with Google Cloud Storage integration
- **WASM physics helpers**: C++ numeric kernels (`wasm/`) — see `docs/architecture/language-strategy.md`

The game features **14 manifest JSON levels** in normal play (plus ~58 dev-only entries with `?devLevels=1`), diverse zones, scoring goals, checkpoints, collectibles, power-ups, and marble types defined in `assets/marbles/`.

## Technology Stack

| Component | Technology | Version / Notes |
|-----------|------------|-----------------|
| Build Tool | Vite | ^7.3.1 |
| 3D Engine | Filament (Google) | ^1.51.5, loaded via global `filament.js` script tag |
| Debug Renderer | Simplified WebGL2 | Opt-in with `?renderer=simple`, shares Rapier/game state through a Filament-like adapter |
| Physics Engine | Rapier3D-Compat | ^0.13.0 (`@dimforge/rapier3d-compat`) |
| Language | JavaScript (ES Modules) + TypeScript/TSX | Mixed codebase |
| UI Framework | React | Used in sequencer/importer modals |
| Backend | Python + FastAPI | Storage API for songs/samples/shaders |
| Cloud Storage | Google Cloud Storage (GCS) | Via `google-cloud-storage` |
| Caching | `aiocache` (memory) | In Python backend |
| Deployment | Paramiko (SFTP) | `deploy.py` uploads `dist/` to remote server |
| CI/CD | GitHub Actions | Node 20, pnpm 9, Emscripten 3.1.50 |
| Devcontainer | Ubuntu base | Node LTS, Python 3.11, Emscripten 3.1.50, VNC |

## Project Structure

```
marbles/
├── index.html              # Main HTML entry point with UI overlay (~2750 lines)
├── package.json            # Dependencies and npm scripts
├── vite.config.js          # Vite configuration with COOP/COEP headers
├── tsconfig.json           # TypeScript configuration (strict, noEmit)
├── deploy.py               # Python deployment script (SFTP to remote server)
├── .eslintrc.js            # ESLint configuration
├── .prettierrc             # Prettier configuration
├── .devcontainer/          # Devcontainer config (Dockerfile + devcontainer.json)
├── public/                 # Static assets
│   ├── baked_color.filmat  # Pre-compiled Filament material
│   ├── custom_material.mat # Source material definition
│   ├── filament.js         # Filament JS loader
│   └── filament.wasm       # Filament WASM binary
├── src/                    # Source code
│   ├── main.js             # Core MarblesGame class constructor
│   ├── init-methods.js     # Initialization mixin (Filament, physics, UI)
│   ├── input-methods.js    # Input handling mixin
│   ├── zone-setup-methods.js    # Zone dispatcher mixin
│   ├── physics-factory-methods.js # Physics body creation utilities
│   ├── marble-management-methods.js # Marble spawning & management
│   ├── game-logic-methods.js      # Scoring, goals, collectibles
│   ├── ability-methods.js         # Abilities (dash, EMP, black hole, etc.)
│   ├── game-loop-methods.js       # Main loop dispatcher
│   ├── game-loop-render-methods.js # Rendering pipeline
│   ├── game-loop-sync-methods.js  # Physics-visual sync
│   ├── hud-manager.js             # HUD rendering and state display
│   ├── audio.js                   # Audio system with spatial sounds
│   ├── material-system.js         # Material management
│   ├── material-presets.js        # Material preset definitions
│   ├── gpu-instancing.js          # GPU instancing utilities
│   ├── gpu-particles.js           # GPU particle system
│   ├── levels/catalog.js   # Runtime catalog (manifest JSON + optional DEV_LEVELS)
│   ├── levels.js           # Dev-only level definitions (?devLevels=1)
│   ├── math.js             # quaternionToMat4 helper
│   ├── sphere.js           # UV sphere generator with TBN frames
│   ├── cube-geometry.js    # Cube vertex/index buffers
│   ├── zones/              # 50+ zone implementations
│   │   ├── methods/        # Zone utilities (creation, physics, types, visuals)
│   │   └── *.js            # Individual zone factories
│   ├── components/         # React/TSX UI components (AISwarmModal, MainLayout, etc.)
│   ├── sequencer/          # React sequencer UI (EffectsChain, SequencerGrid)
│   ├── importers/          # AI song and .rbs importers
│   │   ├── ai-song/        # AI song importer logic
│   │   └── rbs/            # .rbs file importer logic
│   ├── services/           # Service modules (shaderApi.ts)
│   ├── shaders/            # WGSL shaders (breath.wgsl, breath-swarm-merged.wgsl)
│   ├── assets/             # Asset registry
│   └── __tests__/          # React component tests (5 files)
├── storage/                # Python FastAPI backend (modular)
│   ├── main.py             # FastAPI app entry point
│   ├── config.py           # GCS storage map config
│   ├── models.py           # Pydantic models
│   ├── cache.py            # Caching setup
│   ├── client.py           # GCS client initialization
│   ├── io.py               # I/O utilities
│   ├── routes/             # API routers (admin, songs, samples, music, shaders, storage, health)
│   └── services/           # Business logic (index, sync)
├── universal/              # Standalone utilities
│   └── app_storage_manager.py # Monolithic FastAPI duplicate (legacy)
├── docs/backups/
│   ├── orphan-react-stack/     # Archived React sequencer / importers (non-runtime)
│   └── experimental-wasm-renderer/  # Archived WebGPU experiment (non-runtime)
├── wasm/                   # MarblePhysics C++ helpers (Emscripten → public/wasm/)
├── assets/                 # Game assets
│   ├── maps/               # Level definitions
│   ├── marbles/            # Marble definitions
│   ├── schemas/            # JSON schemas for validation
│   ├── sounds/             # Sound definitions
│   └── manifest.json       # Asset registry
├── scripts/                # Build/validation scripts
│   ├── validate-assets.cjs # JSON asset validation against schemas
│   └── verify_syntax.js    # Syntax verification
└── .github/workflows/      # CI/CD workflows
    ├── debug_build.yml     # Build workflow (Node 20, Emscripten)
    └── codespaces-prebuild.yml # Devcontainer validation
```

## Build and Development Commands

```bash
# Development server (serves on localhost with hot reload)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

## Code Organization & Architecture

### Mixin-Based Game Architecture

The `MarblesGame` class in `src/main.js` is the core of the application. Instead of deep inheritance, functionality is composed via **mixins**:

```javascript
class MarblesGame { constructor() { /* massive state initialization */ } }
applyZoneMethods(MarblesGame);
applyInputMethods(MarblesGame);
applyInitMethods(MarblesGame);
applyZoneSetupMethods(MarblesGame);
applyPhysicsFactoryMethods(MarblesGame);
applyMarbleManagementMethods(MarblesGame);
applyGameLogicMethods(MarblesGame);
applyAbilityMethods(MarblesGame);
applyGameLoopMethods(MarblesGame);
applyGameLoopRenderMethods(MarblesGame);
applyGameLoopSyncMethods(MarblesGame);
```

Each mixin file exports:
- A class (e.g., `InitMethods`, `ZoneSetupMethods`)
- An `apply*Methods(targetClass)` function that copies all prototype methods onto the target class

### State Management

The `MarblesGame` constructor initializes a monolithic state object with ~300 lines of property assignments, tracking:
- `this.marbles` — active marble objects
- `this.staticBodies` / `this.staticEntities` — level geometry
- `this.dynamicObjects` — moving/rotating platforms
- `this.checkpoints`, `this.collectibles`, `this.powerUps`
- `this.activeEffects`, ability cooldowns, energy bars
- Camera state, input keys, gamepad state, HUD references

### Level & Zone System

- **Production levels** live in `assets/maps/*.json` + `assets/manifest.json`, loaded via `src/levels/catalog.js`.
- **Dev levels** remain in `src/levels.js` (`DEV_LEVELS`) for WIP content when `?devLevels=1`.
- **Zones** are created via `ZoneSetupMethods.createZone(zone)`, which dispatches through a large `switch` statement to either:
  - Methods on `this` (e.g., `this.createFloorZone()`)
  - Standalone factory functions imported from `src/zones/*.js` or legacy zone files
- There are 50+ zone implementations covering themes like frostbite caverns, toxic swamps, volcano, laser grids, cyber ice tracks, neon alleys, gravity wells, and more.

### Physics + Rendering Sync

- **Rapier** handles all physics simulation.
- **Filament** handles all rendering.
- Every frame, physics transforms are extracted from rigid bodies, converted via `quaternionToMat4()`, and applied to Filament renderable entities via `TransformManager`.
- Scale is applied separately by multiplying the upper 3x3 matrix columns.
- For agent/browser debugging, `?renderer=simple` uses the same game loop and Rapier state but draws a reduced WebGL2 top-down view. Check `window.rendererType`, `window.usingSimpleRenderer`, and `window.rendererFallbackReason` before assuming which renderer is active. See `docs/RENDERER_FALLBACK.md`.
- For performance debugging, use `?perf=1` or `?fps=1` and press `F2` to toggle the FPS/frame-time overlay. `window.perfMonitor.getLevelSummary()` and `window.perfLevelLoads` expose sampled level metrics; see `docs/PERFORMANCE_BASELINE.md`.
- Filament static box visuals are auto-batched after zone creation. Use `?staticBatch=0` / `?noStaticBatch` to compare the pre-batch path; physics fixed bodies remain individual.
- CPU-side visual culling is enabled by default on the Filament path. Use `?culling=0`, `?noCulling`, or `?noCull` for A/B checks. It hides culled static batches from the Filament scene and skips far power-up, collectible, and visual-particle transform writes while leaving physics/gameplay state active.

### React / TSX UI Layer

A subset of the project uses React/TypeScript:
- `src/components/MainLayout.tsx`, `AISwarmModal.tsx`, `ImportRbsModal.tsx`
- `src/sequencer/EffectsChain.tsx`, `src/sequencer/SequencerGrid.tsx`
- `src/importers/ai-song/` and `src/importers/rbs/` — importer logic and modals

### Math & Geometry Helpers

- `src/math.js` — `quaternionToMat4()`, `quatFromEuler()`
- `src/sphere.js` — `createSphere()` generates UV spheres with TBN frame quaternions
- `src/cube-geometry.js` — Cube vertex and index buffer generation

## Development Conventions

### Code Style (from `.eslintrc.js`)
- Extends: `eslint:recommended`, `@typescript-eslint/recommended`
- Target: ES2021+, modules
- `prefer-const: error`, `no-var: error`
- `max-len: warn` (100 characters)
- `complexity: warn` (max 10)
- `max-params: warn` (max 4)
- `no-bitwise: off` (allowed for performance work)
- `no-console: off` (debugging allowed)

### Formatting (from `.prettierrc`)
- Semi: true
- Single quotes
- Trailing commas: `es5`
- Print width: 100
- Tab width: 2 spaces
- End of line: `lf`

### TypeScript (from `tsconfig.json`)
- `target: ES2022`, `module: ESNext`, `moduleResolution: node`
- `strict: true` (all strict flags enabled)
- `allowJs: true`, `checkJs: false` — JS files can import TS, but JS is not type-checked
- `noEmit: true` — TypeScript is used for type-checking only; Vite handles compilation
- `isolatedModules: true`

### General Conventions
- Use **ES Modules** with `.js` extension in imports
- Use `this.Filament.*` and `RAPIER.*` namespaces explicitly
- Physics-related names: `rigidBody`, `world`, `collider`
- Visual-related names: `entity`, `material`, `mesh`
- No `_` prefix convention for private members

## Testing Strategy

### Automated Tests
- **No test runner script** is defined in `package.json`.
- **5 React component tests** exist in `src/__tests__/` using `@testing-library/react` patterns:
  - `AISwarmModal.test.tsx`
  - `EffectsChain.test.tsx`
  - `MainLayout.test.tsx`
  - `RbsParser.test.ts`
  - `SequencerGrid.test.tsx`
- These tests are shallow UI tests for the sequencer/importer components and are **not wired to run automatically**.
- **There are no automated tests for the core 3D game logic.**

### Manual Testing
1. Run `npm run dev` and open the browser
2. Verify marbles fall and collide with level geometry
3. Test all camera modes and controls
4. Check that scoring works in goal zones
5. Verify respawn when marbles fall below the level

### Browser Requirements
- WebGL2 support
- WASM support
- SharedArrayBuffer (requires COOP/COEP headers — configured in Vite)

## Deployment & CI/CD

### Local Deployment (`deploy.py`)
```bash
# 1. Build first
npm run build

# 2. Deploy (requires paramiko: pip install paramiko)
python deploy.py
```

- Uses **Paramiko** to recursively SFTP upload the `dist/` directory.
- Target server: `1ink.us:22` (user: `ford442`)
- Remote path: `test.1ink.us/marbles`

### GitHub Actions
**`.github/workflows/debug_build.yml`**:
- Triggers on push to `main`/`debug-ci` and pull requests to `main`
- Sets up Node 20, pnpm 9, Emscripten 3.1.50
- Runs `npm install` → `npm run build`
- Uploads `dist/`, `public/*.wasm`, `public/*.js` as artifacts (7-day retention)

## Security Considerations

- **`deploy.py` contains a hardcoded password.** If modifying this file, do not expose the credential in outputs. Consider refactoring to use environment variables or `getpass.getpass()` instead.
- The Python backend (`storage/`) has hardcoded CORS origins allowing `localhost` and `*.1ink.us` domains.

## Important Configuration

### Vite Configuration (`vite.config.js`)

Critical for SharedArrayBuffer support:
```javascript
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}
```

Dependencies excluded from optimization (WASM modules):
- `filament`
- `@dimforge/rapier3d-compat`

Static asset handling:
```javascript
assetsInclude: ['**/*.wasm', '**/*.filmat']
```

### Material System

The game uses custom Filament materials (`public/custom_material.mat` and variants):
- Parameters: `baseColor` (float3), `roughness` (float)
- Shading model: lit, opaque
- Pre-compiled to `public/baked_color.filmat` for runtime

### Devcontainer

The project includes a `.devcontainer/` configuration for GitHub Codespaces:
- **Base image**: `mcr.microsoft.com/devcontainers/base:ubuntu`
- **Node**: LTS with node-gyp dependencies
- **Python**: 3.11 with tools
- **Emscripten**: 3.1.50 (installed at `/opt/emsdk`)
- **Desktop**: VNC access via port 6080
- **Forwarded ports**: 3000, 5173, 6080, 8080

### MarblePhysics WASM (`wasm/`)

Custom C++ helpers for batched float kernels (force fields, damping). Built with Emscripten; consumed via `src/wasm-bridge.js`. See `docs/architecture/language-strategy.md` for when to add C++ vs JS.

Archived WebGPU renderer: `docs/backups/experimental-wasm-renderer/` (not on the game runtime path).

## Common Issues & Troubleshooting

1. **Filament WASM loading**: The module uses a UMD pattern with dynamic import. The loading code captures the module via a `loadClassExtensions` hook.
2. **SharedArrayBuffer errors**: Ensure Vite dev server headers are configured correctly (COOP/COEP).
3. **Physics-Visual sync**: Always use `quaternionToMat4()` for transform conversion. Remember to apply scale separately.
4. **Marble scaling**: Physics radius and visual scale are separate. The `scale` property in marble objects is typically `radius / 0.5`.
5. **Python backend dependencies**: There is no `requirements.txt` or `pyproject.toml`. Required packages (fastapi, uvicorn, pydantic, google-cloud-storage, aiocache, paramiko) must be installed manually.

## File Modification Guidelines

- **Adding new campaign levels**: Create `assets/maps/<id>.json`, register in `manifest.json`, use zone `type` stamps from `registry.js`. See `docs/CONTRIBUTING.md` and `docs/architecture/level-pipeline.md`.
- **Adding dev/WIP levels**: Optional entry in `src/levels.js` behind `?devLevels=1`.
- **Adding marble types**: Extend the marble data in `src/marbles_data.js` or `marble-management-methods.js`
- **Modifying physics**: Use Rapier APIs via `RAPIER.*` namespace after `RAPIER.init()`
- **Modifying rendering**: Use Filament APIs via `this.Filament.*` after initialization
- **Modifying UI**: Edit React/TSX files in `src/components/` or `src/sequencer/`
- **Material changes**: Edit `public/custom_material.mat`, recompile with Filament `matc` tool to `public/baked_color.filmat`
- **Python backend changes**: Prefer editing files under `storage/routes/` and `storage/services/` rather than the monolithic `universal/app_storage_manager.py`
- **Asset validation**: Run `node scripts/validate-assets.cjs` to validate JSON assets against schemas
