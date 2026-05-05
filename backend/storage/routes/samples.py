# Sample Upload/Stream/Play Routes
import uuid
import os
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync, _write_json_sync, INDEX_LOCK
from ..client import bucket
from ..models import SampleMetaUpdatePayload

router = APIRouter()


@router.post("/api/samples")
async def upload_sample(
    file: UploadFile = File(...), 
    author: str = Form(...), 
    description: str = Form(""),
    rating: Optional[int] = Form(None)
):
    """Upload a new audio sample."""
    sample_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    storage_filename = f"{sample_id}{ext}"
    config = STORAGE_MAP["sample"]
    full_path = f"{config['folder']}{storage_filename}"

    meta = {
        "id": sample_id,
        "name": file.filename,
        "author": author,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "type": "sample",
        "description": description,
        "filename": storage_filename,
        "rating": rating
    }

    async with INDEX_LOCK:
        try:
            # 1. Stream Upload to GCS
            blob = bucket.blob(full_path)
            await run_io(blob.upload_from_file, file.file, content_type=file.content_type)

            # 2. Update Index
            def _update_idx():
                idx = _read_json_sync(config["index"])
                idx.insert(0, meta)
                _write_json_sync(config["index"], idx)

            await run_io(_update_idx)
            await cache.delete("library:sample")

            return {"success": True, "id": sample_id}
        except Exception as e:
            raise HTTPException(500, str(e))


@router.get("/api/samples/{sample_id}")
async def get_sample(sample_id: str):
    """Stream download a sample file."""
    config = STORAGE_MAP["sample"]

    # 1. Lookup in Index (to get original filename/extension)
    idx = await run_io(_read_json_sync, config["index"])
    entry = next((i for i in idx if i["id"] == sample_id), None)

    if not entry:
        raise HTTPException(404, "Sample not found in index")

    blob_path = f"{config['folder']}{entry['filename']}"
    blob = bucket.blob(blob_path)

    if not await run_io(blob.exists):
        raise HTTPException(404, "File missing from storage")

    # 2. Stream Download
    def iterfile():
        with blob.open("rb") as f:
            while chunk := f.read(1024 * 1024):  # 1MB chunks
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={entry['name']}"}
    )


@router.post("/api/samples/{sample_id}/play")
async def record_play(sample_id: str):
    """Records that a sample was played by updating last_played timestamp."""
    config = STORAGE_MAP["sample"]
    index_path = config["index"]
    now = datetime.now().isoformat()

    async with INDEX_LOCK:
        try:
            index_data = await run_io(_read_json_sync, index_path)
            if not isinstance(index_data, list):
                raise HTTPException(status_code=500, detail="Sample index is corrupted.")

            entry = next((item for item in index_data if item.get("id") == sample_id), None)
            if not entry:
                raise HTTPException(status_code=404, detail="Sample not found.")

            entry["last_played"] = now
            await run_io(_write_json_sync, index_path, index_data)
            
            await cache.delete("library:sample")
            await cache.delete("library:all")

            return {"success": True, "id": sample_id, "last_played": now}

        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Failed to record play for {sample_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to record play: {str(e)}")


@router.put("/api/samples/{sample_id}")
async def update_sample_metadata(sample_id: str, payload: SampleMetaUpdatePayload):
    """
    Updates the metadata (name, description, rating) for a sample (e.g., a FLAC file).
    This only modifies the JSON index, not the audio file itself.
    """
    config = STORAGE_MAP["sample"]
    index_path = config["index"]

    async with INDEX_LOCK:
        try:
            # 1. Read the index
            index_data = await run_io(_read_json_sync, index_path)
            if not isinstance(index_data, list):
                raise HTTPException(
                    status_code=500, detail="Sample index is corrupted.")

            # 2. Find the item and its index
            entry_index = next((i for i, item in enumerate(
                index_data) if item.get("id") == sample_id), -1)

            if entry_index == -1:
                raise HTTPException(
                    status_code=404, detail="Sample not found in index.")

            entry = index_data[entry_index]
            update_happened = False

            # 3. Update metadata fields if provided in the payload
            if payload.name is not None and payload.name != entry.get("name"):
                entry["name"] = payload.name
                update_happened = True

            if payload.description is not None and payload.description != entry.get("description"):
                entry["description"] = payload.description
                update_happened = True

            if payload.rating is not None and payload.rating != entry.get("rating"):
                entry["rating"] = payload.rating
                update_happened = True

            if payload.genre is not None and payload.genre != entry.get("genre"):
                entry["genre"] = payload.genre
                update_happened = True

            if payload.last_played is not None and payload.last_played != entry.get("last_played"):
                entry["last_played"] = payload.last_played
                update_happened = True

            if not update_happened:
                return {"success": True, "id": sample_id, "action": "no_change", "message": "No new data provided to update."}

            # 4. Write the updated index back to GCS
            await run_io(_write_json_sync, index_path, index_data)

            # 5. Clear relevant cache
            await cache.delete("library:sample")
            await cache.delete("library:all")

            return {"success": True, "id": sample_id, "action": "metadata_updated"}

        except HTTPException:
            raise  # Re-raise FastAPI exceptions
        except Exception as e:
            logging.error(
                f"Failed to update sample metadata for {sample_id}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to update sample metadata: {str(e)}")
