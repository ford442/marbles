# Routes Package
from fastapi import APIRouter

# Import all routers
from .admin import router as admin_router
from .songs import router as songs_router
from .samples import router as samples_router
from .music import router as music_router
from .shaders import router as shaders_router
from .storage import router as storage_router
from .health import router as health_router

__all__ = [
    "admin_router",
    "songs_router",
    "samples_router",
    "music_router",
    "shaders_router",
    "storage_router",
    "health_router",
]
