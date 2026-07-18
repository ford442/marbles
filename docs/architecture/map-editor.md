# Map Editor

Browser-based level designer for creating `assets/maps/*.json` without writing JavaScript.

## Launch

- **Direct:** [http://localhost:5173/?editor=1](http://localhost:5173/?editor=1)
- **From menu:** “Open Map Editor” link on the level selection screen

Normal play (`/`) is unchanged when the `editor` query param is absent.

## Features

| Feature | Controls |
|---------|----------|
| Top-down / orbit camera | **Camera** button or **C** · Shift+drag pan · scroll zoom |
| Place zone stamps | Select stamp → **Place** tool → click canvas |
| Move selection | **Select** tool → pick zone(s) → arrow keys (Shift = faster) |
| Multi-select | Shift+click zone list or canvas · Ctrl+click add |
| Rotate | **R** or **Rotate** button · rotation snap 15° / 45° |
| Undo / redo | **Undo** / **Redo** · Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z |
| Snap grid | **Grid snap** toggle · grid size 0.5 / 1 / 2 |
| Property inspector | Map medals/difficulty when nothing selected · zone props when one selected |
| Set spawn | **Spawn** tool → click canvas |
| Place goal + volume | **Goal** tool → click canvas (syncs `goals[]`) |
| Export JSON | **Export JSON** — downloads schema-valid file |
| Workshop ZIP | **Workshop ZIP** — JSON + referenced GLB assets (client download) |
| Save / load draft | localStorage via **Save Draft** / **Load Draft** |
| Playtest | **Playtest** — hot-loads into game loop; **M** returns to editor (restores camera + selection) |

## Stamps

**Built-in:** `floor`, `track`, `landing`, `jump`, `slalom`, `staircase`, `goal`

**Gameplay:** `checkpoint`, `collectible`, `grapple_anchor`

**GLB tracks:** `model` zones from `assets/tracks/*` (catalog starts with `neon_showcase`)

**Factory zones** (procedural stamps — geometry built at runtime from `src/zones/*.js`):

`storm_peak`, `stellar_forge`, `prismatic_speedway`, `space_station`, `neon_grid`

Factory stamps export as `{ type, pos }` only. Full procedural detail stays in the zone factory module.

## Architecture

| Module | Role |
|--------|------|
| `src/editor/map-document.js` | Map state, `MapDocument` undo stack, serialize, drafts |
| `src/editor/map-commands.js` | Command pattern mutations (place/move/delete/rotate) |
| `src/editor/snap.js` | Grid and rotation snap helpers |
| `src/editor/map-validator.js` | Schema validation (same rules as `validate-assets.cjs`) |
| `src/editor/stamps.js` | Editor palette definitions |
| `src/editor/track-catalog.js` | GLB track picker entries |
| `src/editor/editor-session.js` | Playtest snapshot save/restore |
| `src/editor/workshop-export.js` | Client-side workshop ZIP |
| `src/editor/camera.js` | Top-down + orbit camera |
| `src/editor/map-editor.js` | UI, input, preview rebuild, playtest |
| `src/levels/catalog.js` | `registerCustomLevel()` for playtest |

## Workflow

1. Place a floor + track + goal in the editor
2. Add checkpoints / collectibles / grapple anchors as needed
3. Set spawn point
4. **Export JSON** → drop into `assets/maps/` and register in `assets/manifest.json`
5. Or **Workshop ZIP** for JSON + bundled track assets
6. Run `node scripts/validate-assets.cjs` before committing

## Tests

```bash
node tests/test_map_editor.js
```

Covers undo/redo, snap helpers, checkpoint sync, schema round-trip for v2 stamps, playtest session serialization, and workshop asset path collection.

## Later (out of scope)

Upload/share to server, procedural brushes, workshop browser UI.
