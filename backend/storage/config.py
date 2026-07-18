# Configuration
import os

# --- CONFIGURATION ---
BUCKET_NAME = os.environ.get("GCP_BUCKET_NAME")
# Handle Credentials: If provided as a raw JSON string in env var
CREDENTIALS_JSON = os.environ.get("GCP_CREDENTIALS")

# --- STORAGE MAP ---
# Defines the folder structure inside the bucket
STORAGE_MAP = {
    "song":     {"folder": "songs/",    "index": "songs/_songs.json"},
    "pattern":  {"folder": "patterns/", "index": "patterns/_patterns.json"},
    "bank":     {"folder": "banks/",    "index": "banks/_banks.json"},
    "sample":   {"folder": "samples/",  "index": "samples/_samples.json"},
    "music":    {"folder": "music/",    "index": "music/_music.json"},
    "note":     {"folder": "notes/",    "index": "notes/_notes.json"},
    "shader":   {"folder": "shaders/",  "index": "shaders/_shaders.json"},
    "default":  {"folder": "misc/",     "index": "misc/_misc.json"},
    "marbles_progress": {"folder": "marbles/progress/", "index": None},
    "marbles_ghost":    {"folder": "marbles/ghosts/",   "index": None},
    "marbles_board":    {"folder": "marbles/leaderboards/", "index": None},
}

MARBLES_GHOST_MAX_BYTES = int(os.environ.get("MARBLES_GHOST_MAX_BYTES", "163840"))
ENABLE_LEGACY_MUSIC_API = os.environ.get("ENABLE_LEGACY_MUSIC_API", "1") == "1"

# CORS Origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://test.1ink.us",
    "https://go.1ink.us",
    "https://noahcohn.com",
]

_extra_cors = os.environ.get("MARBLES_CORS_ORIGINS", "")
if _extra_cors:
    ALLOWED_ORIGINS.extend(o.strip() for o in _extra_cors.split(",") if o.strip())
