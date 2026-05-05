# Project Structure

This document outlines the reorganized Marbles 3D project structure for better code organization and clarity.

## Root Level Files

Essential configuration files only:
- `package.json` - Project dependencies and scripts
- `vite.config.js` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `index.html` - Web entry point
- `CLAUDE.md` - AI assistant guidelines (development)
- `README.md` - Project overview
- Config files: `.eslintrc.js`, `.prettierrc`, `.env.example`, etc.

## Directory Structure

### `/src` - Application Source Code
Main game implementation:
- `main.js` - Game initialization and core loop
- `**-methods.js` - Game system mixins (physics, rendering, logic, input, etc.)
- `zones/` - Level definitions
- `components/` - UI components (React/TSX)
- `services/` - Game services (audio, input, etc.)
- `shaders/` - Custom shaders
- `sequencer/` - Animation/timing system
- `importers/` - Data importers
- `__tests__/` - Unit tests
- `assets/` - AssetRegistry and asset loading logic

### `/assets` - Game Assets & Definitions
Game data and configuration:
- `maps/` - Level/zone definitions (JSON)
- `marbles/` - Marble type definitions
- `sounds/` - Audio definitions
- `schemas/` - JSON schema validation files
- `manifest.json` - Asset catalog

### `/docs` - Documentation
All project documentation:
- Core docs: `CONTRIBUTING.md`, `BUGFIXES.md`, `GAME_ANALYSIS.md`
- Guides: `MARBLE_RENDERING_GUIDE.md`, `RENDERING_ENHANCEMENTS.md`
- `/plans/` - Level designs and planning documents
- `/backups/` - Archived/backup source files
- `/reports/` - Validation reports and screenshots
- `/test-results/` - Test execution results
- `/ai-workflows/` - AI workflow documentation and examples

### `/backend` - Server & Backend Code
Python backend services:
- `storage/` - Storage service, routes, and data management
- `core/` - Core backend logic (app_storage_manager)
- `shared/` - Shared utilities and templates

### `/tests` - Test Suite
Test files:
- `test*.js` - JavaScript tests
- `test*.cjs` - CommonJS tests
- Prefer `src/__tests__/` for unit tests; use `/tests` for integration/smoke tests

### `/scripts` - Build & Utility Scripts
- `deploy.py` - Deployment script
- Other build/automation scripts

### `/public` - Static Web Assets
- Served directly by Vite
- Public images, fonts, and static content

### `/verification` - QA & Verification
Screenshot verification and manual testing:
- Verification images and test scripts
- `/screenshots/`, `/videos/` - Test artifacts

### `/wasm_renderer` - WASM Module (Optional)
Separate C++ WebAssembly project:
- `CMakeLists.txt` - Build configuration
- `main.cpp` - WASM source
- May be disabled or separated based on architecture

## File Organization Rules

### Config & Setup
- Keep at root: `package.json`, `vite.config.js`, `tsconfig.json`, `index.html`
- Documentation at root: `README.md`, `CLAUDE.md`

### Source Code
- Game logic → `src/`
- Game assets/data → `assets/`
- Asset management code → `src/assets/`

### Documentation
- User-facing docs → `docs/` root
- Planning/design docs → `docs/plans/`
- Verification artifacts → `docs/reports/` or `verification/`
- Backup files → `docs/backups/`

### Testing
- Unit tests → `src/__tests__/`
- Integration tests → `tests/`

### Backend
- All Python services → `backend/` (storage, core, shared)

## Import Paths

After reorganization, imports remain consistent:
```javascript
// Asset definitions (in assets/ at root)
import assetRegistry from './src/assets/AssetRegistry.js';

// Game methods (in src/)
import { MarblesGame } from './src/main.js';
```

Vite handles path resolution automatically. No changes needed to existing imports.

## Migration Notes

- All file moves preserve git history (rename detection)
- No breaking changes to imports or references
- Backend code paths changed: `storage/` → `backend/storage/`, `universal/` → `backend/core/`
- Documentation moved: `AGENTS.md` → `docs/AGENTS.md`, `ai-workflows/` → `docs/ai-workflows/`
- Test files: `test*.js` → `tests/` directory

## Future Improvements

- Consider moving `verification/` scripts to `tests/`
- Consider extracting `wasm_renderer/` as submodule if it grows
- May want separate `docs/api/` for API documentation
- Could add `docs/architecture/` for technical deep-dives
