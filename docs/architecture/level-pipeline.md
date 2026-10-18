# Level Pipeline

Production play uses **JSON maps + `assets/manifest.json`**. The only code-level escape hatch is **`DEV_LEVELS`** (`src/levels.ts`). It loads lazily and only when `?devLevels=1` / `?dev=1` is set. Every entry must say why it isn't a JSON map.

**Rule: no new JS zone without a JSON map.** New content ships as a v2 JSON map built from primitives. A new `src/zones/*.js` factory is acceptable only when primitives genuinely can't express the geometry, and even then it ships through a JSON map that references it, with a recorded `solution`. `tests/levels/test_dev_levels_policy.js` fails CI when `DEV_LEVELS` gains an entry that has no `devOnly` reason or that shadows a JSON map.

## Production path

```
assets/manifest.json
  → AssetRegistry.loadAll()            (src/assets/AssetRegistry.js — structuralErrors() cheap check)
  → mapToRuntimeLevel(map, 'json')     (src/levels/map-normalize.js — v1 + v2 → one runtime shape)
  → initLevelCatalog(registry)         (src/levels/catalog.js)
  → CampaignMenu / level select        (chapters + gating: src/levels/campaign.js)
  → loadLevel(id)                      (src/init/level-loader.js)
      → preloadZoneModules(zones)      (lazy factory chunks, src/zone-setup/registry.js)
      → dispatchZone() per zone        (builtin stamp | factory stamp | v2 primitive)
  → clearLevel()                       (src/init/cleanup.js — zoneScope.dispose())
```

`DEV_LEVELS` sits behind `await loadDevLevels()` (a dynamic `import('../levels.ts')`), and every factory zone sits behind `ZONE_LOADERS` (`import(\`../zones/${file}.js\`)`). Neither is in the main chunk. `scripts/check-bundle-budget.mjs` enforces that in CI (see [Bundle budget](#bundle-budget)).

## Level Format v2

A v2 map sets `"schemaVersion": 2`. It can use everything v1 has, plus:

| Field | Meaning |
|---|---|
| `zones[]` primitives | `box`, `ramp`, `mover`, `spinner`, `trigger` (below). They mix freely with v1 stamps (`goal`, `checkpoint`, factory types). |
| `goal` | A single goal volume `{ pos, size }` (centre + full extents). Use it instead of `goals[]`, never both. |
| `rivals` | Up to 6 marble ids raced against. The level spawns 1 + `rivals.length` marbles. |
| `bounds` | `{ min, max }`. Every collider must sit inside it (static check). |
| `solution` | A recorded input track that proves the map can be finished (see [Harness](#completability-harness)). |
| `goalless` | `true` for free-roam maps (sandbox), which exempts them from the goal checks. |

Vectors are `[x, y, z]` arrays or `{x, y, z}` objects. Sizes are **full extents** (the JS helpers take half-extents; the JSON never does).

### Primitives

All five are built by one typed builder, `src/zone-setup/primitives.ts`:

- `compilePrimitive()` is the pure step.
- `buildPrimitive()` creates the bodies and renderables.
- Everything is registered with the level's `ZoneScope`, which `clearLevel()` disposes. That frees bodies, entities and material instances; the old per-zone code leaked `matInstance`.

| type | Required | Notes |
|---|---|---|
| `box` | `pos`, `size` | Static. Optional `rot`. |
| `ramp` | `from`, `to`, `width` | The **top surface centre line** runs from `from` to `to`, and orientation is derived from that. Optional `thickness` (default 0.5). |
| `mover` | `size`, `path`, `period` | Kinematic. Ping-pongs along the polyline `path` (or `loop: true` to cycle). `ease: sine` (default) or `linear`. `phase` is 0–1. |
| `spinner` | `pos`, `size`, `axis`, `rpm` | Kinematic rotation about its own `x`/`y`/`z` axis. Optional `phaseDeg`. |
| `trigger` | `pos`, `size`, `do` | No collider. `do: { boost: [dx,dy,dz] }` (a velocity change, mass-independent), `{ setVelocity: [...] }` or `{ respawn: true }`. `on`: `enter` (default) or `stay`. An optional `color` renders a thin pad. |

Surfaces take `material` (a preset such as `ice`, `neon_ice`, `rubber`, `metal`, `glass`), `friction` (0–2), `restitution` (0–1) and `color`. An explicit `friction`/`restitution` beats the preset.

**Rotation is named-axis only:** `rot: { yawDeg, pitchDeg, rollDeg }`, applied as yaw (about +Y), then pitch (about local +X), then roll (about local +Z). Positive pitch lowers the +Z end (right-hand rule). `quatFromYawPitchRoll()` in `src/math.ts` implements it.

The old `quatFromEuler(a, b, c)` rotated about **Z** first, despite its argument order reading like yaw/pitch/roll. Lint now bans it in `src/zones/**`. All 45 zone call sites were migrated to an exactly equivalent named-axis form (`tests/test_math_rotation.js` proves the identity). Three of them preserve behaviour that looks unintended: `pinball-zone.js`, `plinko-zone.js` and `helix-zone.js` pass `rotY` as a **roll**. They were left as-is to keep those shipped levels unchanged, and should be revisited when they're ported to v2.

Movers and spinners are posed from **simulated time** (`ZoneScope.time`, advanced by the fixed physics step and frozen during time-stop), not the wall clock. Replays and the headless harness therefore see the same motion as the game.

### One rule set

`assets/schemas/map-schema.json` is the single source of truth:

| Where | How |
|---|---|
| CI | `scripts/validate-assets.cjs` compiles it with ajv through `src/levels/map-rules.js` (`compileMapSchema` + `semanticChecks`). |
| Editor | `src/editor/map-validator.js` uses the same `map-rules.js` (ajv ships only in the lazy editor chunk). |
| Workshop publish | `backend/storage/services/map_validation.py` validates the same file with `jsonschema` and mirrors `semanticChecks`. Unknown zone types are **errors** there, but only warnings in the editor while drafting. |
| Game loader | `structuralErrors()` (no ajv): only the fields the loader dereferences. |

`npm run validate:assets` first runs `node scripts/sync-zone-handlers.cjs --check`. That fails if `assets/schemas/zone-handlers.json` (generated from the registry's `ZONE_TYPES`) is stale.

## Completability harness

`tests/levels/` runs in `npm test`. It builds each level's **real zone code** into a real Rapier world with Filament stubbed out (`src/game/headless/headless-level.js`) and steps it at the fixed 60 Hz step.

| Test | What must hold |
|---|---|
| `test_manifest_levels.js` | Every manifest map passes everything below. |
| — static | Bodies are finite; there's ground within 30 m below spawn; each goal sits within 6 m of geometry, doesn't overlap spawn, and stays inside `bounds`. |
| — smoke (600 steps, no input) | The reference marble touches ground for ≥ 60 steps before any fall below the kill plane (y < -20). |
| — solution | When the map has a `solution`, replaying it reaches a goal within ±`tolerance` (default 0.5) of `medals.parTime`. |
| `test_dev_levels.js` | Every `DEV_LEVELS` entry builds and passes static + smoke. |
| `test_dev_levels_policy.js` | Every `DEV_LEVELS` entry has a `devOnly` reason and shadows no JSON map. |
| `test_primitives.js` | The primitive type list matches across builder, loader, schema and Python. Also checks ramp/mover/spinner/trigger geometry, and that `ZoneScope` tick/pause/dispose work. |

The headless build seeds `Math.random`, so zones that randomise their layout build identically every time and solutions replay exactly. In game those layouts still vary, so a solution there proves the seeded layout is finishable. Prefer deterministic geometry in v2 maps.

**Solutions are tied to the reference marble.** Held-key movement is a raw impulse of 0.5 per 60 Hz frame (`frame-input.js`), and it is not scaled by mass. That includes full air control, as in game. A light marble therefore accelerates much harder than a heavy one, so solutions are recorded against `REFERENCE_MARBLE` (the default-unlocked `classic_red`: radius 0.5, density 1.5, friction 0.015, restitution 0.8). Mass-scaling movement would invalidate every recorded solution; re-record them if that changes.

### Authoring a solution — `npm run level:lab`

```bash
npm run level:lab -- assets/maps/my_map.json                 # static + smoke + solution replay
npm run level:lab -- assets/maps/my_map.json --trace         # per-segment positions of the replay
npm run level:lab -- assets/maps/my_map.json --greedy        # try straight-at-the-goal autopilot
npm run level:lab -- assets/maps/my_map.json \
    --waypoints '[[0,40],[9,46],{"at":[9,62],"speed":6},[0,70]]' --speed 9 --yaw-step 10
npm run level:lab -- --dev some_dev_level                    # a DEV_LEVELS entry
```

`--waypoints` drives a velocity-controlled autopilot. It uses only player inputs: aim yaw, forward, and ground jumps (with `jumpCharge`). It goes through the waypoints (`[x, z]` or `[x, y, z]`; optional `speed`, `jump`, `radius`), then to the goal centre. On success it prints a ready-to-paste `"solution"` block. Set `medals.parTime` near the solution time and `"tolerance": 0.35`.

## Campaign

`CAMPAIGN_CHAPTERS` (`src/levels/campaign.js`) lists every shipped map, in play order, in exactly one chapter:

| Chapter | Levels | Unlock rule |
|---|---|---|
| tutorial | 8 | always open |
| classic | 10 (incl. goalless sandbox) | complete 1 tutorial level |
| neon | 9 | 2 classic golds |
| extreme | 9 | 3 neon golds |
| expert | 8 | 3 extreme golds |

Within an unlocked chapter, the listed level at index *i* opens after *i* − `LEVEL_UNLOCK_SLACK` (2) completions in that chapter. The first three levels are open, and a player stuck on one can still play two levels past it. Free play bypasses all gating. `tests/test_campaign_chapters.js` checks that every manifest map is listed exactly once and that a map's own `chapter` field agrees with its list.

## Triage (#451 Part D)

Every level id appears in [`level-inventory.json`](level-inventory.json) with a `triage` of `ship`, `dev-only`, `archive` or `delete`, plus a reason. Regenerate it with `node scripts/generate-level-inventory.cjs`; `tests/test_level_inventory.js` keeps it current. Deletions and renamed ports are recorded in [`archived-levels.json`](archived-levels.json).

| Outcome | Levels |
|---|---|
| Ported to v2, same id | `storm_peak`, `stellar_forge` (shipped, but previously broken: NaN floors, unreachable goal) |
| Ported to v2, new id (`*_run` → id) | `quantum_core`, `cyber_matrix`, `neon_drift`, `neon_vortex`, `neon_pulse_matrix`, `aether_core`, `inferno_chamber`, `crystal_cavern`, `astral_cascade` |
| Deleted | `cyber_reactor_run`, `neon_city_heights_run` (copies of the broken aether_core template), `abyssal_trench_run` (crashed on load) |
| Promoted (factory stamp + greedy solution) | `block_challenge`, `bowling_alley`, `domino_effect`, `trampoline_park`, `pinball_wizard`, `canyon_run`, `castle_siege`, `bumper_arena`, `neon_pipeline_run`, `toxic_swamp_run`, `meteorite_hollow_run` |
| Removed as duplicates of JSON maps | `staircase`, `full_course`, `sandbox`, `volcano_run`, `space_station` |
| Dev-only (38) | Build and pass static + smoke, but no autopilot route yet, so completability is unproven. Each carries a `devOnly` reason. Next candidates for a v2 port. |
| Archived JSON | The four `*_extreme` prototypes (unimplemented mechanics) |

When a JS zone is ported, delete its `src/zones/*.js` file, its `FACTORY_ZONES` entry and its `DEV_LEVELS` entry. Then run `node scripts/sync-zone-handlers.cjs` and the inventory generator.

## Bundle budget

`BUNDLE_STATS=1 npx vite build && npm run check:bundle` checks the entry chunk against `scripts/bundle-budget.json`. That file sets `mainChunkMaxKB` and lists module patterns forbidden in the main chunk: zone files, `levels.ts`, editor modules other than `mode.js`, and ajv. The baseline was 2806.8 KB before the lazy split and 2660.2 KB after. `BUNDLE_STATS=html` writes a treemap to `dist/bundle-stats.html`.

## Related docs

- [Campaign progression](campaign.md)
- [Map editor](map-editor.md) — the palette has a "Primitives (v2)" group; placing one upgrades the map to v2
- [Contributing: maps](../CONTRIBUTING.md#adding-a-zone-level-geometry)
