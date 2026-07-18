# Archived Source Backups

Files here are **not imported** by the Marbles 3D game runtime (`index.html` → `src/main.js`). They were moved out of `src/` in July 2026 to reduce noise for contributors and AI agents.

## Layout

| Directory | Why kept |
|-----------|----------|
| `game-runtime-drafts/` | Editor backups (`*.orig`, `*.broken`, `*.restored`, `*.backup`) and zone/marble draft modules. Premium marble data from `marble_draft.js` was inlined into `src/marbles_data.js`. |
| `orphan-react-stack/` | React/TSX sequencer, shader gallery, AI/RBS importers, and their tests. Requires `react` / `@testing-library/react`, which are not game dependencies. Not wired to any HTML entry point. Restore only if building a separate music/sequencer product surface. See `orphan-react-stack/README.md`. |
| `experimental-wasm-renderer/` | C++ WebGPU + Dawn stub (formerly `wasm_renderer/`). Not integrated with Filament. See `experimental-wasm-renderer/ARCHIVED.md`. |
| `unused-game-modules/duplicate-zones/` | Zone factories duplicated under `src/zones/` but never imported (levels use legacy `*_zone.js` files or other `zones/*.js` paths). |
| `unused-game-modules/unwired-game-loop/` | Split `game-loop/` modules (`abilities`, `camera`, `hud`, `input`) that were never connected to `game-loop/index.js`. |
| `unused-game-modules/misc/` | `AssetRegistry`, `gpu-particles`, `particle-materials`, `material-variants`, and notes not on the runtime graph. |
| `root-leftovers/` | Superseded `deploy_old.py` and a partial mirror of `backend/storage/` that lived at repo root. |
| `GAME_ANALYSIS-2025.md` | Historical game analysis from the 7-level era (early 2025). Stub at [../GAME_ANALYSIS.md](../GAME_ANALYSIS.md) redirects here. |

## Runtime entry graph

The shipped game loads only:

```
index.html
  └── src/main.js
        └── (static ES module imports — see docs/PROJECT_STRUCTURE.md)
```

To audit reachability after changes:

```bash
node -e "
import fs from 'fs'; import path from 'path';
const visited = new Set(); const queue = [path.resolve('src/main.js')];
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of ['', '.js', '.ts', '.tsx', '/index.js']) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}
while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:import|export)\\s+(?:[^'\";]+\\s+from\\s+)?['\"]([^'\"]+)['\"]/g)) {
    const r = resolve(file, m[1]); if (r) queue.push(r);
  }
}
console.log('Reachable modules:', visited.size);
"
```

## Do not edit here for gameplay changes

Implement features under `src/` on the runtime path. Copy material back from these archives only when deliberately reviving a retired surface.
