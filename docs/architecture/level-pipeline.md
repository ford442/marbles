# Level Pipeline

Marbles 3D has two parallel level pipelines. Production play uses **JSON maps + manifest**; experimental content lives in **`DEV_LEVELS`** (`src/levels.js`) and only appears when `?devLevels=1` or `?dev=1`.

## Production path

```
assets/manifest.json
  → AssetRegistry.loadAll()     (src/assets/AssetRegistry.js)
  → initLevelCatalog(registry)  (src/levels/catalog.js)
  → LEVELS runtime catalog
  → CampaignMenu / level select (src/init/level-menu.js)
  → loadLevel(id)               (src/init/level-loader.js)
  → dispatchZone() per zone     (src/zone-setup/registry.js)
```

## Dev path (gated)

When `isDevLevelsEnabled()` is true, `DEV_LEVELS` entries merge into `LEVELS` **only if the id is not already in the JSON catalog**. JSON always wins on id collision.

## Hybrid maps (target pattern)

Factory zones remain **stamps** referenced by `zones[].type` in JSON. The zone builder lives in `src/zones/<name>.js` and is registered in `FACTORY_ZONE_HANDLERS`. Example: a level JSON references `{ "type": "storm_peak", "pos": { ... } }` plus spawn/goals/camera metadata—no full level logic in `levels.js`.

See [`neon_showcase.json`](../../assets/maps/neon_showcase.json) for GLB + builtin zones, and migrated maps like `storm_peak.json` for factory-stamp levels.

## Categorization

| Source | Meaning | Playable without dev flag? |
|--------|---------|:----------------------------:|
| **json** | In manifest, JSON-only | yes |
| **dual** | Same id in manifest and `DEV_LEVELS`; JSON wins | yes (JSON version) |
| **code** | `DEV_LEVELS` only | no |
| **archived-json** | Preserved prototype named in `archived-levels.json` | no |
| **orphan-json** | Unclassified map file on disk, not in manifest | no |

## Counts (current)

| Metric | Count |
|--------|------:|
| Manifest (production) | **24** |
| `DEV_LEVELS` entries | **52** |
| Map JSON files (excl. template) | **28** |
| Unique level ids | **76** |
| JSON-only | **20** |
| Code-only (dev) | **48** |
| Dual (JSON wins) | **4** |
| Archived JSON prototypes | **4** |
| Orphan JSON | **0** |
| Playable in normal mode | **24** manifest ids |
| Playable with `?devLevels=1` | **72** unique ids |

Regenerate the machine-readable inventory:

```bash
node scripts/generate-level-inventory.cjs
node scripts/generate-level-inventory.cjs --markdown   # table to stdout
```

Output: [`level-inventory.json`](level-inventory.json) (committed; CI test keeps it in sync).

## Master inventory

See [`level-inventory.json`](level-inventory.json) for the full table (`id`, `source`, `in_manifest`, `chapter`, `zone_types`, `migration_status`).

### Shipped JSON levels (manifest)

| id | chapter | notes |
|----|---------|-------|
| `tutorial` | tutorial | builtin zones |
| `landing` | tutorial | |
| `jump` | classic | |
| `slalom` | classic | |
| `staircase` | classic | |
| `sandbox` | classic | |
| `volcano_run` | extreme | |
| `full_course` | expert | |
| `neon_showcase` | neon | GLB `model` zone |
| `prismatic_speedway` | neon | factory stamp |
| `storm_peak` | extreme | factory stamp + `storm-peak-ambient` behavior |
| `stellar_forge` | extreme | factory stamp |
| `space_station` | expert | factory stamp |
| `neon_grid` | neon | floor + track + factory stamp |
| `mushroom_hop` | classic | wave 1 factory stamp |
| `wind_tunnel` | classic | wave 1 factory stamp |
| `pinwheel_alley` | classic | wave 1 factory stamp |
| `helix_havoc` | extreme | wave 1 factory stamp |
| `clockwork_chaos` | extreme | wave 1 factory stamp |
| `cyber_run` | neon | wave 1 factory stamp |
| `ice_cave_run` | extreme | wave 1 factory stamp |
| `jungle_run` | classic | wave 1 factory stamp |
| `zen_garden_run` | classic | wave 1 factory stamp |
| `galaxy_spiral_run` | expert | wave 1 factory stamp |

### Dual ids (JSON wins at runtime)

`staircase`, `full_course`, `sandbox`, `volcano_run` — legacy copies remain in `DEV_LEVELS` for dev comparison but are skipped when manifest JSON exists.

### Archived extreme prototypes

| id | archive reason |
|----|----------------|
| `tutorial_extreme` | Depends on unimplemented hazard, trap, ramp, stomp, and route stamps |
| `slalom_extreme` | Depends on unimplemented branching, trap, boost-chain, and plunge mechanics |
| `staircase_extreme` | Depends on unimplemented fork, freefall, trap-stair, and spiral-staircase mechanics |
| `volcano_run_extreme` | Depends on unimplemented heat, eruption, tsunami, collapsing-platform, and boss systems |

These source maps remain on disk as design references but are explicitly excluded from the product catalog. Their machine-readable reasons and 26 missing handlers live in [`archived-levels.json`](archived-levels.json). Reviving one requires real gameplay implementations, asset validation, and a playable smoke—not placeholder handlers.

## Inventory regression gate

`tests/test_level_inventory.js` rebuilds the inventory in memory and rejects duplicate `DEV_LEVELS` ids, manifest maps with unknown zone handlers, unclassified orphan JSON, and stale committed inventory data.

All wave 1 maps set an explicit chapter, difficulty, follow camera, goal volume, and medal thresholds. Falling below the global `y < -20` boundary respawns at the latest checkpoint or initial spawn.

## Campaign chapter assignment

Order of precedence in `getChapterForLevel()` (`src/levels/campaign.js`):

1. `LEVEL_CHAPTER_OVERRIDES`
2. JSON `chapter` field on the level object
3. Keyword / difficulty heuristics

## Contribution policy

**New campaign levels must be JSON + manifest.** Do not add permanent content to `DEV_LEVELS`. See [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md).

## Related docs

- [Campaign progression](campaign.md)
- [Map editor](map-editor.md)
- [Project structure](../PROJECT_STRUCTURE.md)
