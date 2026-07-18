# AGENTS.md

## Cursor Cloud specific instructions

Marbles 3D is a browser-based 3D marble roller game (Vite + Google Filament for rendering + Rapier3D for physics). The game frontend is the only service required to run/test the product; it is fully client-side and does not call any backend at runtime. See `CLAUDE.md` for the architecture overview and the full command list.

### Services

- Game (Vite dev server) — the product. `npm run dev` serves it at http://localhost:5173. This is the only service needed to play/test.
- Multiplayer relay (`server/relay.mjs`) — OPTIONAL, only for "Party Race" mode. `npm run relay` (port 8787) or `npm run dev:party` (relay + vite). The game works fine single-player without it.
- Python FastAPI service under `backend/storage/` — NOT part of the game runtime (belongs to an archived music tool). Ignore it for game work; it has no dependency manifest and needs GCP credentials.

### Running / testing (commands live in `package.json`)

- `npm run dev` — dev server. Requires the COOP/COEP headers already set in `vite.config.js` (SharedArrayBuffer/Filament); don't remove them.
- `npm run lint` and `npm run typecheck` — both pass clean.
- `npm run test:unit` — Node-based unit tests. Note: 2 pre-existing failures unrelated to environment setup — `test_volumetric_lights.js` (hardcoded `/root/marbles/...` import path) and a `.ts` file imported directly under Node (`ERR_UNKNOWN_FILE_EXTENSION`). The rest pass.
- `npm run test:e2e` — Playwright test against a running dev server. Requires `npx playwright install chromium` first (browsers are not part of `npm install`). The dev server on :5173 must already be running.

### Non-obvious gotchas

- The game instance is exposed as `window.game` in the browser (used by E2E tests and handy for debugging).
- Camera mode matters for input testing: the first/tutorial level defaults to `orbit` camera mode, where the arrow keys/WASD control the CAMERA, not the marble (the marble still rolls on its own via ramp gravity). Marble movement keys apply impulse to `window.game.playerMarble` only in `follow`/`action`/`fpv`/`topdown`/`cinematic`/`side-scroller`/`drone` modes (see `src/game-loop/frame-input.js`). To verify keyboard control programmatically, set `window.game.cameraMode='follow'`, then dispatch `KeyboardEvent('keydown'/'keyup', {code:'ArrowLeft'|'ArrowRight'|...})` on `window` and read `window.game.playerMarble.rigidBody.translation()`. No pointer lock is required for movement (pointer lock is only for mouse-look/aiming).
- `npm run build` runs `build:wasm` (Emscripten) first, which will fail without the Emscripten SDK. The optional C++ WASM physics module has a pure-JS fallback (`src/wasm-bridge.js`), so it is not needed for dev. To build without Emscripten, run `npx vite build` directly.
