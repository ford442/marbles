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

Playable levels are **`assets/maps/*.json`** files registered in **`assets/manifest.json`**. New levels use **Level Format v2** (`"schemaVersion": 2`): geometry is built from five JSON primitives, so most levels need no JavaScript at all. The full pipeline is in [`docs/architecture/level-pipeline.md`](architecture/level-pipeline.md).

### Policy: no new JS zone without a JSON map

| Requirement | Detail |
|-------------|--------|
| Map file | `assets/maps/<id>.json`, valid against `assets/schemas/map-schema.json` |
| Manifest | Entry under `maps` in `assets/manifest.json` |
| Campaign | Listed in one chapter's `levels` in `src/levels/campaign.js` (and `"chapter"` in the map, if set, must match) |
| Completable | Passes `tests/levels/` (static + smoke) and records a `solution` that replays within `medals.parTime` ± tolerance |
| Geometry | Primitives first. A new `src/zones/*.js` factory only when primitives can't express it, and still shipped via a JSON map |
| `DEV_LEVELS` | Sandbox only. Every entry needs a `devOnly: '<why>'` reason; CI fails otherwise |

### Primitives

```json
{ "type": "box",     "pos": [0, 0, 0], "size": [16, 1, 16], "material": "metal", "rot": { "yawDeg": 15 } }
{ "type": "ramp",    "from": [0, 0.5, 8], "to": [0, -7.5, 38], "width": 8, "material": "glass" }
{ "type": "mover",   "size": [6, 1.6, 1.6], "path": [[-12, -6.7, 41], [12, -6.7, 41]], "period": 3.0, "phase": 0.25 }
{ "type": "spinner", "pos": [0, 1, 20], "size": [10, 0.8, 0.8], "axis": "y", "rpm": 12 }
{ "type": "trigger", "pos": [0, -8, 78], "size": [6, 2, 6], "do": { "setVelocity": [0, 25, 9] }, "color": [1, 0.9, 0.1] }
```

- **Sizes are full extents**, and vectors are `[x, y, z]` or `{ "x", "y", "z" }`.
- **`ramp`**: you give the top surface's centre line (`from` → `to`); its orientation is derived from that.
- **`mover`**: ping-pongs along `path` once per `period` seconds (`"loop": true` cycles instead). It's eased with `sine` unless `"ease": "linear"`. `phase` (0–1) offsets it.
- **`spinner`**: rotates about its own `axis` at `rpm`.
- **`trigger`**: has no collider. `do` is `boost` (a velocity change), `setVelocity`, or `respawn`. It fires on `enter` (default) or every step on `stay`.
- **Rotation**: named axes only, `rot: { yawDeg, pitchDeg, rollDeg }`. Positive pitch lowers the +Z end.
- **Surface**: `material` presets (`ice`, `neon_ice`, `glass`, `metal`, `rubber`, `sand`, …), or explicit `friction` (0–2) and `restitution` (0–1). The explicit value wins.
- **Mixing**: primitives combine with v1 stamps such as `goal` (the visual pad) and `checkpoint`.
- **Map-level v2 fields**: `goal: { pos, size }` (one goal volume, instead of `goals[]`), `bounds: { min, max }`, `rivals: [marble ids]` (≤ 6) and `solution`.

[`assets/maps/quantum_core.json`](../assets/maps/quantum_core.json) is a complete example. In the map editor, the **Primitives (v2)** palette group places each type.

### Checklist (new map)

1. **Write the map**: copy `assets/maps/quantum_core.json` (v2) or `TEMPLATE.json`, and set `id`, `name`, `difficulty`, `chapter`, `spawn`, `goal`, `bounds` and `camera`.
2. **Register it**: add an entry under `maps` in `assets/manifest.json`, and add the id to a chapter's `levels` in `src/levels/campaign.js`.
3. **Check it headlessly**:
   ```bash
   npm run level:lab -- assets/maps/my_map.json            # static + smoke
   npm run level:lab -- assets/maps/my_map.json --greedy   # straight run at the goal?
   npm run level:lab -- assets/maps/my_map.json --waypoints '[[0,40],[9,46],[0,70]]' --speed 9 --yaw-step 10
   ```
   Paste the printed `"solution"` into the map. Set `medals.parTime` near its time and `"tolerance": 0.35`. Solutions are recorded on the reference marble (`classic_red`); see the level pipeline doc for why.
4. **Validate**: run `npm run validate:assets`, then `npm test` (which includes `tests/levels/`).
5. **Play it**: `npm run dev`.

### Factory zones (when primitives aren't enough)

1. Write `src/zones/my-cool-zone.js` exporting `createMyCoolZone(game, offset)`. Use `quatFromYawPitchRoll` from `src/math.ts`; lint bans `quatFromEuler` in `src/zones/**`.
2. Register it in `FACTORY_ZONES` in `src/zone-setup/registry.js`: `my_cool_zone: ['my-cool-zone', 'createMyCoolZone']`. It's loaded lazily as its own chunk.
3. Run `node scripts/sync-zone-handlers.cjs` (CI's `--check` fails if you forget).
4. Ship it through a JSON map (`{ "type": "my_cool_zone", "pos": [0, 0, 0] }`) that passes the checklist above, solution included. Avoid `Math.random` in layout code: the harness seeds it, but players would get layouts the solution never saw.

### Built-in stamps

`floor`, `track`, `goal`, `checkpoint`, `collectible`, `slalom`, etc. are `BUILTIN_ZONE_HANDLERS` in `registry.js`, backed by `src/zones/methods/`. **`registry.js` is the only map** of zone types.

### Do not

- Add campaign content to `DEV_LEVELS`.
- Add zone modules at `src/*_zone.js` (legacy layout), or import factories eagerly (it breaks the bundle budget).
- Register placeholder handlers to make an archived map validate (see [`archived-levels.json`](architecture/archived-levels.json)).

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

- `box`, `ramp`, `mover`, `spinner`, `trigger` - v2 primitives (`"schemaVersion": 2`; see [Primitives](#primitives))
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
3. Save as `assets/marbles/your_marble_id.json` and add it under `marbles` in `assets/manifest.json`
4. Run `npm run gen:marbles` — `src/marbles_data.js` is **generated** from the JSON files (never edit it by hand); `npm run validate:assets` fails when it is stale or when two marbles share an id or name

`assets/marbles/*.json` is the single source of truth for the marble catalog. Set `"premium": true` or an `unlock` rule to gate a marble; locked marbles are visible but can't be selected in the level-menu picker.

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
- `restitution` (0-1) - Bounciness. Above 1 adds energy on every bounce, so it is only allowed (≤ 1.5) for marbles listed with a reason in `assets/marbles/_bouncy-cap.json`
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
