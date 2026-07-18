# Campaign Progression

Structured chapter-based level selection with localStorage persistence for times, medals, and unlocks.

## Chapters

| Chapter | Theme | Unlock rule |
|---------|-------|-------------|
| Tutorial | Basics | Always open |
| Classic | Core runs | Complete any Tutorial level |
| Neon | Cyber / synth zones | 2 gold medals in Classic |
| Extreme | Hard hazards | 3 gold medals in Neon |
| Expert | Master routes | 3 gold medals in Extreme |

Levels are auto-assigned to chapters via `src/levels/campaign.js` heuristics, with explicit overrides for manifest JSON maps.

## Save model (`localStorage` key: `marbles3d_campaign`)

```json
{
  "version": 1,
  "freePlay": false,
  "unlockedChapters": ["tutorial", "classic"],
  "levels": {
    "tutorial": {
      "completed": true,
      "bestTime": 32.5,
      "medal": "gold",
      "collectibles": 0,
      "collectiblesTotal": 0,
      "collectiblesPercent": 100
    }
  },
  "unlockedMarbles": ["classic_red", "classic_blue", "classic_green"]
}
```

## Map JSON medal fields

Add to `assets/maps/*.json`:

```json
"medals": {
  "goldTime": 25,
  "silverTime": 45,
  "bronzeTime": 90,
  "parTime": 35
},
"collectiblesTotal": 5
```

| Field | Description |
|-------|-------------|
| `goldTime` | Finish ≤ this (seconds) for gold |
| `silverTime` | Finish ≤ this for silver |
| `bronzeTime` | Finish ≤ this for bronze |
| `parTime` | Designer par (reference / future HUD) |
| `collectiblesTotal` | Pickups in level for % tracking |

If omitted, defaults are chosen by `difficulty` in `DEFAULT_MEDALS_BY_DIFFICULTY`.

Optional `chapter` string overrides auto-assignment.

## Free Play

After completing any Tutorial chapter level, a **Free Play** toggle appears — unlocks all chapters for sandbox replay without affecting saved medals.

## Cloud sync (opt-in)

When `VITE_MARBLES_API_URL` is set and the player enables **Settings → Cloud**, campaign progress syncs via `PUT/GET /v1/marbles/progress/{deviceId}`. Local `localStorage` remains authoritative for offline play; cloud merges best times, medals, and unlocks on pull.

Ghost personal bests can upload to global leaderboards (`POST /v1/marbles/ghosts`). See `backend/README.md` and `src/game/network/cloud-client.js`.

## Modules

| Path | Role |
|------|------|
| `src/levels/campaign.js` | Chapters, unlock rules, medal math |
| `src/levels/campaign-menu.js` | Chapter UI rendering |
| `src/game/systems/campaign-progress.js` | Save/load, unlock evaluation |
| `src/init/level-menu.js` | Campaign menu integration |

## Tests

```bash
node tests/test_campaign_progress.js
```
