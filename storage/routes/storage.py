# Storage Listing Routes
from fastapi import APIRouter, Query, HTTPException
from ..config import STORAGE_MAP
from ..client import bucket
from ..io import run_io

router = APIRouter()


@router.get("/api/storage/files")
async def list_gcs_folder(folder: str = Query(..., description="Folder name, e.g., 'songs' or 'samples'")):
    """
    Directly lists files in a GCS folder (ignoring the JSON index).
    Useful for seeing what is actually on the disk.
    """
    # 1. Get the correct prefix from your STORAGE_MAP, or use the folder name directly
    #    This handles cases where user types "song" but folder is "songs/"
    config = STORAGE_MAP.get(folder)
    prefix = config["folder"] if config else f"{folder}/"

    try:
        # 2. Run GCS List Blobs in a thread (to keep server fast)
        def _fetch_blobs():
            # 'delimiter' makes it behave like a folder (doesn't show sub-sub-files)
            blobs = bucket.list_blobs(prefix=prefix, delimiter="/")

            file_list = []
            for blob in blobs:
                # Remove the folder prefix (e.g. "songs/beat1.json" -> "beat1.json")
                name = blob.name.replace(prefix, "")
                if name and name != "":
                    file_list.append({
                        "filename": name,
                        "size": blob.size,
                        "updated": blob.updated.isoformat() if blob.updated else None,
                        "url": blob.public_url if blob.public_url else None
                    })
            return file_list

        files = await run_io(_fetch_blobs)
        return {"folder": prefix, "count": len(files), "files": files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
