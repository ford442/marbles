# Contributing to Marbles 3D

Thank you for your interest in contributing! This guide will help you create new assets for the game.

## Table of Contents

- [Getting Started](#getting-started)
- [Adding a Zone (Level Geometry)](#adding-a-zone-level-geometry)
- [Creating Maps](#creating-maps)
- [Art-Directed Tracks (GLB)](#art-directed-tracks-glb)
- [Creating Marbles](#creating-marbles)
- [Creating Sounds](#creating-sounds)
- [Asset Validation](#asset-validation)
- [Submission Guidelines](#submission-guidelines)

> **Archived code — do not restore**
>
> React sequencer, shader gallery, and AI/RBS importers live under [`docs/backups/orphan-react-stack/`](backups/orphan-react-stack/). They are **not** part of the Marbles 3D game runtime.
>
> Do **not** re-add `react`, `@testing-library/react`, or move archived TSX back into `src/` without a separate product decision. See [language-strategy.md](architecture/language-strategy.md) and [backups/README.md](backups/README.md).

## Getting Started

See [CURRENT_STATE.md](CURRENT_STATE.md) for project health and migration status.

1. Fork the repository
2. Create your assets in the appropriate `/assets/` subdirectory
3. Test your assets locally
4. Submit a pull request

## Adding a Zone (Level Geometry)

Playable levels are loaded from **`assets/maps/*.json`** via **`assets/manifest.json`** at boot (`src/assets/AssetRegistry.js`). Zone geometry builders live in **`src/zones/<kebab-name>.js`**, registered in **`src/zone-setup/registry.js`**.

Code-only levels remain in **`src/levels.js`** as `DEV_LEVELS` and appear in the level menu only when **`?devLevels=1`** or **`?dev=1`** is set (for experimental maps not yet migrated to JSON).

### Policy: new campaign levels

**All new campaign levels must ship as JSON + manifest.** Do not add permanent content to `DEV_LEVELS`.

| Requirement | Detail |
|-------------|--------|
| Map file | `assets/maps/<id>.json` validated against `assets/schemas/map-schema.json` |
| Manifest | Entry under `maps` in `assets/manifest.json` |
| Zone geometry | Reference registered `zones[].type` stamps (builtin or factory in `src/zones/`) |
| Chapter | Set `"chapter"` in map JSON (`tutorial`, `classic`, `neon`, `extreme`, `expert`) |
| Custom logic | Optional `"behaviors": ["behavior-id"]` — see [level pipeline](../architecture/level-pipeline.md) |
| Dev path | `DEV_LEVELS` is **WIP/sandbox only**; PRs adding campaign content via `levels.js` should be rejected |

Full inventory: [`docs/architecture/level-pipeline.md`](../architecture/level-pipeline.md).

### Checklist (JSON map — required for campaign)

1. **Create or extend a zone builder** if needed — `src/zones/my-cool-zone.js` (see factory checklist below).

2. **Add a map JSON file** — copy `assets/maps/TEMPLATE.json` → `assets/maps/my_cool_run.json`, set `zones[].type` to a registered handler id (e.g. `my_cool_zone`, `floor`, `goal`).

3. **Register in manifest** — add an entry under `maps` in `assets/manifest.json`:
   ```json
   "my_cool_run": {
     "file": "maps/my_cool_run.json",
     "name": "My Cool Run",
     "difficulty": "medium"
   }
   ```

4. **Validate** — `npm run validate:assets` (also runs in CI).

5. **Play** — `npm run dev`; the map appears in the level select without editing `levels.js`.

### Checklist (code-only dev level)

Use only for work-in-progress zones. Add to `DEV_LEVELS` in `src/levels.js` and test with **`?devLevels=1`**.

1. **Create the builder** — `src/zones/my-cool-zone.js`:
   ```javascript
   export function createMyCoolZone(game, offset) {
       // Use game.createStaticBox, game.createFloorZone, zones/methods helpers, etc.
   }
   ```

2. **Export from the barrel** — add to `src/zones/index.js`:
   ```javascript
   export { createMyCoolZone } from './my-cool-zone.js';
   ```

3. **Register the zone type** — add one entry to `FACTORY_ZONE_HANDLERS` in `src/zone-setup/registry.js`:
   ```javascript
   my_cool_zone: (game, _zone, offset) => zones.createMyCoolZone(game, offset),
   ```
   Use the same snake_case string you will put in `levels.js` `zone.type`.

4. **Add a level** (or extend an existing one) in `src/levels.js`:
   ```javascript
   my_cool_run: {
       name: 'My Cool Run',
       description: '…',
       zones: [
           { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
           { type: 'my_cool_zone', pos: { x: 0, y: 0, z: 25 } },
           { type: 'goal', pos: { x: 0, y: 0.25, z: 70 } },
       ],
       spawn: { x: 0, y: 8, z: -12 },
       goals: [{ id: 1, range: { x: [-5, 5], z: [65, 75], y: [-1, 3] } }],
       camera: { mode: 'follow', height: 15, offset: -25 },
   },
   ```

5. **Verify** — `npm run build` and play with `?devLevels=1`.

### Migrating hard-coded levels to JSON

Many legacy levels still live in `DEV_LEVELS` (`src/levels.js`). To migrate one:

1. Copy its object fields into `assets/maps/<id>.json` (match an existing map like `tutorial.json` or a hybrid factory map below).
2. Add `"version"`, `"id"`, `"difficulty"`, and `"chapter"` per `assets/schemas/map-schema.json`.
3. Register the file in `assets/manifest.json`.
4. Remove the entry from `DEV_LEVELS` once verified in normal play (no dev flag).
5. Run `npm run validate:assets`.

**Hybrid factory-stamp example** (migrated from `storm_peak_run`):

```json
{
  "id": "storm_peak",
  "name": "Storm Peak",
  "version": "1.0.0",
  "difficulty": "hard",
  "chapter": "extreme",
  "environment": "space_nebula",
  "nightMode": true,
  "backgroundColor": [0.1, 0.1, 0.15, 1.0],
  "zones": [
    { "type": "storm_peak", "pos": { "x": 0, "y": 0, "z": 0 } },
    { "type": "goal", "pos": { "x": 0, "y": 15, "z": 105 } }
  ],
  "spawn": { "x": 0, "y": 5, "z": -40 },
  "goals": [{ "id": 1, "range": { "x": [-10, 10], "z": [100, 110], "y": [10, 20] } }],
  "camera": { "mode": "follow", "height": 15, "offset": -25 }
}
```

The factory builder (`src/zones/storm-peak.js`) stays; JSON only references it by `type`.

**Already on JSON (manifest-driven):** `tutorial`, `landing`, `jump`, `slalom`, `staircase`, `full_course`, `sandbox`, `volcano_run`, `neon_showcase`, `prismatic_speedway`, `storm_peak`, `stellar_forge`, `space_station`, `neon_grid`.

**Still code-only (dev flag):** remaining entries in `DEV_LEVELS` — see [`level-inventory.json`](../architecture/level-inventory.json).

Zone `type` strings in JSON must match keys in `src/zone-setup/registry.js` (`ZONE_HANDLERS`).

### Built-in zone types (no new file)

Primitive zones (`floor`, `track`, `goal`, `slalom`, etc.) are handled by methods in `src/zones/methods/creation.js` and registered under `BUILTIN_ZONE_HANDLERS` in `registry.js`. Only add a new `src/zones/*.js` file when the geometry is non-trivial.

### Do not

- Add zone modules at `src/*_zone.js` (legacy layout removed)
- Duplicate `switch` cases in multiple files — **`registry.js` is the only map**
- Import zone factories from `zone-setup-methods.js` — use `zones/index.js` or `registry.js`


## Asset Structure

```
assets/
├── maps/           # Level definitions (.json)
├── tracks/         # GLB/GLTF course meshes (collision + render)
├── marbles/        # Marble definitions (.json)
├── sounds/         # Sound definitions (.json)
├── materials/      # Material definitions (.json)
└── schemas/        # JSON schemas for validation
```

## Creating Maps

Maps define the 3D environment where marbles roll.

### Quick Start

1. Copy `assets/maps/TEMPLATE.json` to a new file
2. Modify the values to create your map
3. Save as `assets/maps/your_map_id.json`

### Map Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (lowercase, underscores only) |
| `name` | string | Yes | Display name |
| `description` | string | Yes | Brief description |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `author` | string | No | Your name |
| `difficulty` | string | No | easy/medium/hard/expert |
| `zones` | array | Yes | List of map zones |
| `spawn` | object | Yes | Spawn point {x, y, z} |
| `goals` | array | Yes | Goal detection zones |
| `camera` | object | No | Camera settings |

### Zone Types

- `floor` - Flat ground plane
- `track` - Sloped ramp for rolling
- `landing` - Flat platform for landing
- `jump` - Jump/ramp section
- `slalom` - Obstacle course section
- `staircase` - Step climbing section
- `goal` - Victory zone
- `model` - Imported GLB/GLTF track mesh (see [Art-Directed Tracks](#art-directed-tracks-glb))
- `custom` - Custom zone (advanced)

### Example Map

```json
{
  "id": "my_custom_map",
  "name": "My Custom Map",
  "description": "A fun custom map",
  "version": "1.0.0",
  "author": "Your Name",
  "difficulty": "medium",
  "zones": [
    {
      "type": "floor",
      "pos": { "x": 0, "y": -2, "z": 0 },
      "size": { "x": 50, "y": 0.5, "z": 50 },
      "color": [0.3, 0.3, 0.3]
    },
    {
      "type": "track",
      "pos": { "x": 0, "y": 3, "z": 0 }
    },
    {
      "type": "goal",
      "pos": { "x": 0, "y": 0.25, "z": 32.5 },
      "color": [1.0, 0.84, 0.0]
    }
  ],
  "spawn": { "x": 0, "y": 8, "z": -12 },
  "goals": [
    {
      "id": 1,
      "range": {
        "x": [-2, 2],
        "y": [0, 2],
        "z": [30.5, 34.5]
      }
    }
  ],
  "camera": {
    "mode": "orbit",
    "angle": 0,
    "height": 10,
    "radius": 25
  }
}
```

## Art-Directed Tracks (GLB)

Import Blender or Godot meshes as both **Filament renderables** and **Rapier colliders** instead of stacking boxes.

### Map JSON

Add a zone with `type: "model"`:

```json
{
  "type": "model",
  "model": "tracks/neon_showcase.glb",
  "collider": "trimesh",
  "pos": { "x": 0, "y": 3, "z": 15 },
  "rotY": 0,
  "scale": 1,
  "materialPreset": "neon",
  "lod": [
    { "model": "tracks/neon_showcase_lod1.glb", "distance": 45 }
  ]
}
```

| Field | Description |
|-------|-------------|
| `model` | Path relative to `assets/` (e.g. `tracks/my_track.glb`) |
| `collider` | `trimesh` (static courses), `convexHull` (dynamic props), or `none` (render only) |
| `materialPreset` | Optional — remap to game PBR presets; omit to keep embedded glTF textures |
| `lod` | Optional distance-switched lower-poly models for large courses |

If the file fails to load or parse, the game **falls back to the built-in box track** (`createTrackZone`) so the level stays playable.

**Showcase level:** `neon_showcase` in `assets/maps/neon_showcase.json`.

Regenerate placeholder meshes: `node scripts/generate-showcase-track.cjs`.

### Blender export settings

Use **glTF 2.0 (.glb)** — single binary preferred for tracks.

1. **Scale** — Apply transforms (`Ctrl+A` → All Transforms) so 1 Blender unit = 1 game unit (meters).
2. **Origin** — Set origin to geometry center or track start; align with the zone `pos` in JSON.
3. **Collision mesh** — Use a single watertight mesh or merged collision shell; avoid paper-thin planes (minimum ~0.2 units thick for stable marble contact).
4. **Normals** — Recalculate outside (`Shift+N`); trimesh colliders assume outward-facing normals.
5. **Format** — Export: **glTF Binary (.glb)**.
   - Include: **Mesh** (required)
   - Optional: **Materials** (embedded), **UVs**, **Vertex Colors**
   - Disable: **Cameras**, **Lights**, **Animations** (not used for static tracks)
6. **Compression** — Optional **Draco** or **meshopt** for download size; test in-game after enabling (Filament gltfio decodes in WASM).
7. **LOD** — Export separate `.glb` files per LOD level; list them in the zone `lod` array with camera distance thresholds.

### Godot export

Export as **glTF 2.0 (.glb)** with **+Y Up** (matches game coordinates). Merge collision meshes before export; same thickness and normal rules as Blender.

### File layout

```
assets/tracks/
├── neon_showcase.glb
├── neon_showcase_lod1.glb
└── your_track.glb
```

Paths in JSON omit the `assets/` prefix: `"model": "tracks/your_track.glb"`.

## Creating Marbles

Marbles are the playable spheres with unique physics and appearance.

### Quick Start

1. Copy `assets/marbles/TEMPLATE.json` to a new file
2. Modify the values to create your marble
3. Save as `assets/marbles/your_marble_id.json`

### Marble Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `description` | string | Yes | Brief description |
| `version` | string | Yes | Semantic version |
| `author` | string | No | Your name |
| `rarity` | string | No | common/uncommon/rare/epic/legendary |
| `appearance` | object | Yes | Visual properties |
| `physics` | object | Yes | Physical properties |

### Physics Properties

- `radius` (0.1-2.0) - Size of the marble
- `density` - Affects mass (higher = heavier)
- `friction` (0-1) - Surface grip (lower = more slippery)
- `restitution` (0-2) - Bounciness (>1 = super bouncy)
- `linearDamping` - Slows down linear movement
- `angularDamping` - Slows down spinning

### Example Marble

```json
{
  "id": "crystal_blue",
  "name": "Crystal Blue",
  "description": "A beautiful blue crystal marble",
  "version": "1.0.0",
  "author": "Your Name",
  "rarity": "rare",
  "appearance": {
    "color": { "r": 0.2, "g": 0.5, "b": 1.0 },
    "roughness": 0.1,
    "metallic": 0.0
  },
  "physics": {
    "radius": 0.5,
    "density": 1.0,
    "friction": 0.3,
    "restitution": 0.6
  }
}
```

## Creating Sounds

Sounds enhance the game experience.

### Quick Start

1. Copy `assets/sounds/TEMPLATE.json` to a new file
2. Add your audio files to the sounds directory
3. Update the sound definition
4. Save as `assets/sounds/your_sound_id.json`

### Sound Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `category` | string | Yes | sfx/music/ambient/ui |
| `files` | array | Yes | Audio file variants |
| `properties` | object | No | Playback settings |
| `trigger` | object | No | When to play (for SFX) |

### Supported Audio Formats

- MP3 (recommended for compatibility)
- OGG
- WAV

### Example Sound

```json
{
  "id": "bounce_rubber",
  "name": "Rubber Bounce",
  "description": "Bouncy rubber sound effect",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "sfx",
  "files": [
    { "path": "sounds/bounce_01.mp3", "weight": 1 },
    { "path": "sounds/bounce_02.mp3", "weight": 1 }
  ],
  "properties": {
    "volume": 0.8,
    "pitchMin": 0.9,
    "pitchMax": 1.1,
    "spatial": true
  },
  "trigger": {
    "event": "collision",
    "threshold": 1.0,
    "cooldown": 0.1
  }
}
```

## Asset Validation

### JSON Schema Validation

All assets are validated against JSON schemas in `assets/schemas/`:

- `map-schema.json` - Map validation
- `marble-schema.json` - Marble validation
- `sound-schema.json` - Sound validation

Run locally:

```bash
npm run validate:assets
```

This runs automatically in CI on every pull request.

### Optional local pre-commit hook

CI is the source of truth for asset validation. To run `validate:assets` before each commit (opt-in):

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

The hook script lives at [`.githooks/pre-commit`](../.githooks/pre-commit) and runs `npm run validate:assets`.

## Development checks

| Script | Purpose |
|--------|---------|
| `npm test` | Node unit tests under `tests/` (same as `test:unit`) |
| `npm run lint` | ESLint on `src/`, `tests/`, `scripts/` (errors fail the run) |
| `npm run typecheck` | `tsc --noEmit` (TypeScript project sanity; JS is not type-checked) |
| `npm run validate:assets` | JSON asset + manifest validation |
| `npm run build` | WASM physics module + Vite production bundle |

Playwright browser tests live in `tests/e2e/` and are **manual** — start `npm run dev`, then `npm run test:e2e`.

### CI (GitHub Actions)

Workflow: [`.github/workflows/debug_build.yml`](../.github/workflows/debug_build.yml) (`Marbles CI`)

Steps on each push/PR to `main`:

1. `npm ci`
2. `npm run validate:assets`
3. `npm run test:unit`
4. `npm run lint`
5. `npm run typecheck`
6. Emscripten setup → `npm run build`
7. Upload `dist/` and `public/wasm/marble_physics.*` artifacts

### Online Validators

You can validate your JSON files using:
- [JSON Schema Validator](https://www.jsonschemavalidator.net/)
- VS Code with JSON Schema extension

### Testing Locally

1. Place your assets in the correct directories
2. Update `assets/manifest.json` with your new assets
3. Run `npm run validate:assets`
4. Run the game (`npm run dev`) and check the console for `[AssetRegistry]` loading messages
5. Test in-game to ensure everything works

## Submission Guidelines

### Before Submitting

- [ ] Asset JSON is valid (use a JSON validator)
- [ ] Asset follows the appropriate schema
- [ ] Unique ID (not conflicting with existing assets)
- [ ] All required fields are filled
- [ ] Asset is tested in-game
- [ ] `manifest.json` is updated
- [ ] No copyrighted material without permission

### Pull Request Format

```
Title: Add [Asset Type]: [Asset Name]

Description:
- What: Brief description of the asset
- Why: Why you're adding it
- Testing: How you tested it

Files Added:
- assets/[type]/[id].json
- (any audio/texture files)
- assets/manifest.json (updated)
```

### Asset IDs

- Use lowercase letters, numbers, and underscores only
- Be descriptive but concise
- Examples: `crystal_cave`, `speed_demon`, `metal_clang`

### Naming Conventions

- **Maps**: Descriptive of theme/location (e.g., `crystal_cave`, `space_station`)
- **Marbles**: Descriptive of appearance/ability (e.g., `golden_snitch`, `ghost_phase`)
- **Sounds**: Descriptive of sound + material (e.g., `wood_thud`, `glass_shatter`)

## Questions?

- Open an issue for questions
- Join our community Discord (if available)
- Check existing assets for examples

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Happy creating! 🎮🎨
