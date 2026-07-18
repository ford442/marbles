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
| **orphan-json** | Map file on disk, not in manifest | no (often broken zone handlers) |

## Counts (current)

| Metric | Count |
|--------|------:|
| Manifest (production) | **14** |
| `DEV_LEVELS` entries | **58** |
| Map JSON files (excl. template) | **18** |
| Unique level ids | **72** |
| JSON-only | **10** |
| Code-only (dev) | **54** |
| Dual (JSON wins) | **4** |
| Orphan JSON | **4** |
| Playable in normal mode | **14** manifest ids |
| Playable with `?devLevels=1` | ~68 unique ids |

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

### Dual ids (JSON wins at runtime)

`staircase`, `full_course`, `sandbox`, `volcano_run` — legacy copies remain in `DEV_LEVELS` for dev comparison but are skipped when manifest JSON exists.

### Orphan JSON (blocked)

| id | blocker |
|----|---------|
| `tutorial_extreme` | Not in manifest; uses unregistered zone types |
| `slalom_extreme` | Same |
| `staircase_extreme` | Same |
| `volcano_run_extreme` | Same |

These maps use ~29 zone types with no `ZONE_HANDLERS` entry. Register handlers before adding to manifest.

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
