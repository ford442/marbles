# Map Editor

Browser-based level designer for creating `assets/maps/*.json` without writing JavaScript.

## Launch

- **Direct:** [http://localhost:5173/?editor=1](http://localhost:5173/?editor=1)
- **From menu:** “Open Map Editor” link on the level selection screen

Normal play (`/`) is unchanged when the `editor` query param is absent.

## MVP features

| Feature | Controls |
|---------|----------|
| Top-down / orbit camera | **Camera** button or **C** · Shift+drag pan · scroll zoom |
| Place zone stamps | Select stamp → **Place** tool → click canvas |
| Move selection | **Select** tool → pick zone → arrow keys (Shift = faster) |
| Rotate floor blocks | **R** or **Rotate** button |
| Set spawn | **Spawn** tool → click canvas |
| Place goal + volume | **Goal** tool → click canvas (syncs `goals[]`) |
| Export JSON | **Export JSON** — downloads schema-valid file |
| Save / load draft | localStorage via **Save Draft** / **Load Draft** |
| Playtest | **Playtest** — hot-loads into game loop; **M** returns to editor |

## Stamps (schema-valid zone types)

`floor`, `track`, `landing`, `jump`, `slalom`, `staircase`, `goal`

Floor blocks support optional `rotY` (radians) in exported JSON.

## Architecture

| Module | Role |
|--------|------|
| `src/editor/map-document.js` | Map state, serialize, drafts, playtest id |
| `src/editor/map-validator.js` | Schema validation (same rules as `validate-assets.cjs`) |
| `src/editor/stamps.js` | Editor palette definitions |
| `src/editor/camera.js` | Top-down + orbit camera |
| `src/editor/map-editor.js` | UI, input, preview rebuild, playtest |
| `src/levels/catalog.js` | `registerCustomLevel()` for playtest |

## Workflow

1. Place a floor + track + goal in the editor
2. Set spawn point
3. **Export JSON** → drop into `assets/maps/` and register in `assets/manifest.json`
4. Run `node scripts/validate-assets.cjs` before committing

## Tests

```bash
node tests/test_map_editor.js
```

## Later (out of MVP scope)

Snap grid, undo/redo, upload/share, procedural brushes, workshop browser.
