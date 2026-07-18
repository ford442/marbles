# Marbles Storage API

> **Not required for local play.** The Marbles 3D browser game runs fully client-side. This service is optional cloud sync when `VITE_MARBLES_API_URL` is set in the game.

FastAPI service for **Marbles 3D** cloud campaign sync and global ghost leaderboards. Uses Google Cloud Storage (GCS) for persistence.

Legacy routes for the archived music/sequencer product (`/api/songs`, `/api/samples`, etc.) remain available when `ENABLE_LEGACY_MUSIC_API=1` (default). For marbles-only deploys, set `ENABLE_LEGACY_MUSIC_API=0`.

## Quick start

```bash
cd backend
pip install -r requirements.txt

export GCP_BUCKET_NAME=your-bucket
# Optional: export GCP_CREDENTIALS='{"type":"service_account",...}'
export ENABLE_LEGACY_MUSIC_API=0
export MARBLES_CORS_ORIGINS=http://localhost:5173

uvicorn storage.main:app --host 0.0.0.0 --port 7860 --reload
```

OpenAPI docs: http://localhost:7860/docs

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_BUCKET_NAME` | Yes | GCS bucket name |
| `GCP_CREDENTIALS` | No | Service account JSON string; omit for ADC / local gcloud auth |
| `MARBLES_CORS_ORIGINS` | No | Comma-separated extra CORS origins |
| `MARBLES_GHOST_MAX_BYTES` | No | Max replay blob size (default `163840`) |
| `ENABLE_LEGACY_MUSIC_API` | No | `1` = include archived music routes; `0` = marbles only |

## Marbles API (`/v1/marbles`)

All routes require `Authorization: Bearer <device-uuid>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/marbles/progress/{userId}` | Fetch campaign save blob |
| `PUT` | `/v1/marbles/progress/{userId}` | Merge and store campaign progress |
| `POST` | `/v1/marbles/ghosts` | Upload compressed position replay |
| `GET` | `/v1/marbles/ghosts/{ghostId}` | Download ghost replay |
| `GET` | `/v1/marbles/leaderboards/{levelId}` | Global top-3 times + ghost refs |

### GCS layout

```
marbles/progress/{userId}.json
marbles/ghosts/{ghostId}.txt
marbles/ghosts/{ghostId}.meta.json
marbles/leaderboards/{levelId}.json
```

## Client integration

Set in the game `.env`:

```
VITE_MARBLES_API_URL=http://localhost:7860
```

Cloud sync is **opt-in** in game Settings → Cloud. Offline play is unaffected.

## Legacy music API

When `ENABLE_LEGACY_MUSIC_API=1`, these archived surfaces are mounted:

- `/api/songs`, `/api/samples`, `/api/music`, `/api/shaders`
- `/api/admin/*`, `/api/storage/files`

They are not used by the Marbles 3D Filament game runtime.
