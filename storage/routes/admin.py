# Admin Routes
from fastapi import APIRouter, HTTPException
from ..services.sync import sync_music_folder, seed_test_samples, sync_gcs_storage
from ..io import INDEX_LOCK

router = APIRouter()


@router.post("/api/admin/sync-music")
async def admin_sync_music():
    """Scans the music/ folder and rebuilds the music index."""
    async with INDEX_LOCK:
        try:
            return await sync_music_folder()
        except Exception as e:
            raise HTTPException(500, f"Failed to sync music: {str(e)}")


@router.post("/api/admin/seed-test-samples")
async def admin_seed_test_samples():
    """Creates test sample entries for development."""
    async with INDEX_LOCK:
        try:
            return await seed_test_samples()
        except Exception as e:
            raise HTTPException(500, f"Failed to seed: {str(e)}")


@router.post("/api/admin/sync")
async def admin_sync_gcs():
    """
    Scans Google Cloud Storage to rebuild JSON indexes based on actual files.
    """
    try:
        return await sync_gcs_storage()
    except Exception as e:
        raise HTTPException(500, f"Sync failed: {str(e)}")
