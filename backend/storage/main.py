# Main FastAPI Application
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .client import get_gcs_client, gcs_client, bucket
from .cache import cache
from .io import shutdown_executor
from .routes import (
    admin_router,
    songs_router,
    samples_router,
    music_router,
    shaders_router,
    storage_router,
    health_router,
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
app = FastAPI(lifespan=lifespan)

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

# Admin routes
app.include_router(admin_router)

# Song routes
app.include_router(songs_router)

# Sample routes
app.include_router(samples_router)

# Music routes
app.include_router(music_router)

# Shader routes
app.include_router(shaders_router)

# Storage listing routes
app.include_router(storage_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
