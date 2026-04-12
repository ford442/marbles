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
    "default":  {"folder": "misc/",     "index": "misc/_misc.json"}
}

# CORS Origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",       # For your local testing
    "https://test.1ink.us",  # <--- REPLACE THIS with your actual site
    "https://go.1ink.us",  # <--- REPLACE THIS with your actual site
    "https://noahcohn.com",  # <--- REPLACE THIS with your actual site
]
