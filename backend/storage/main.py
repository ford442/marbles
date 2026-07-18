# Main FastAPI Application
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS, ENABLE_LEGACY_MUSIC_API
from .client import get_gcs_client, gcs_client, bucket
from .io import shutdown_executor
from .routes import (
    admin_router,
    songs_router,
    samples_router,
    music_router,
    shaders_router,
    storage_router,
    health_router,
    marbles_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - initialize GCS on startup."""
    from .config import BUCKET_NAME
    global gcs_client, bucket
    try:
        gcs_client = get_gcs_client()
        bucket = gcs_client.bucket(BUCKET_NAME)
        print(f"--- GCS CONNECTED: {BUCKET_NAME} ---")
    except Exception as e:
        print(f"!!! GCS CONNECTION FAILED: {e}")
    yield
    shutdown_executor()


# Create FastAPI app
app = FastAPI(
    lifespan=lifespan,
    title="Marbles Storage API",
    description="Marbles 3D cloud progress and ghost leaderboards. "
    "Legacy music/sequencer routes are optional (ENABLE_LEGACY_MUSIC_API).",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Uses the list from config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGISTER ROUTERS ---
# Health & Home
app.include_router(health_router)

# Marbles game cloud API (primary product surface)
app.include_router(marbles_router)

if ENABLE_LEGACY_MUSIC_API:
    # Archived sequencer / music tool routes
    app.include_router(admin_router)
    app.include_router(songs_router)
    app.include_router(samples_router)
    app.include_router(music_router)
    app.include_router(shaders_router)
    app.include_router(storage_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
