# Song CRUD Routes
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync, _write_json_sync, INDEX_LOCK
from ..client import bucket
from ..models import ItemPayload, MetaData, SortBy
from ..services.index import list_library

router = APIRouter()


@router.get("/api/songs", response_model=list[MetaData])
async def list_songs(
    type: Optional[str] = Query(None),
    sort_by: SortBy = Query(SortBy.date),
    sort_desc: bool = Query(True),
    genre: Optional[str] = Query(None),
    min_rating: Optional[int] = Query(None, ge=1, le=10)
):
    """List songs with filtering and sorting."""
    return await list_library(type, sort_by, sort_desc, genre, min_rating)


@router.post("/api/songs")
async def upload_item(payload: ItemPayload):
    """Upload a new JSON item (song, pattern, bank)."""
    item_id = str(uuid.uuid4())
    date_str = datetime.now().strftime("%Y-%m-%d")
    item_type = payload.type if payload.type in STORAGE_MAP else "song"
    config = STORAGE_MAP[item_type]

    filename = f"{item_id}.json"
    full_path = f"{config['folder']}{filename}"  # e.g., songs/uuid.json

    meta = {
        "id": item_id,
        "name": payload.name,
        "author": payload.author,
        "date": date_str,
        "type": item_type,
        "description": payload.description,
        "filename": filename,
        "rating": payload.rating
    }

    # Add meta to the actual data file too
    payload.data["_cloud_meta"] = meta

    async with INDEX_LOCK:
        try:
            # 1. Write the Data File
            await run_io(_write_json_sync, full_path, payload.data)

            # 2. Update the Index
            def _update_index():
                current = _read_json_sync(config["index"])
                current.insert(0, meta)
                _write_json_sync(config["index"], current)

            await run_io(_update_index)

            # Clear cache
            await cache.clear()
            return {"success": True, "id": item_id}
        except Exception as e:
            raise HTTPException(500, f"Upload failed: {str(e)}")


@router.put("/api/songs/{item_id}")
async def update_item(item_id: str, payload: ItemPayload):
    """Update an existing JSON item."""
    # Verify type configuration
    item_type = payload.type if payload.type in STORAGE_MAP else "song"
    config = STORAGE_MAP[item_type]

    # Assume filename is {id}.json (standard convention for this app)
    filename = f"{item_id}.json"
    full_path = f"{config['folder']}{filename}"

    date_str = datetime.now().strftime("%Y-%m-%d")

    new_meta = {
        "id": item_id,
        "name": payload.name,
        "author": payload.author,
        "date": date_str,
        "type": item_type,
        "description": payload.description,
        "filename": filename,
        "rating": payload.rating
    }

    # Add meta to data
    payload.data["_cloud_meta"] = new_meta

    async with INDEX_LOCK:
        try:
            # 1. Write the Data File (Overwrite)
            await run_io(_write_json_sync, full_path, payload.data)

            # 2. Update the Index
            def _update_index_logic():
                current = _read_json_sync(config["index"])
                if not isinstance(current, list):
                    current = []

                # Find and remove existing entry for this ID
                existing_index = next((i for i, item in enumerate(
                    current) if item.get("id") == item_id), -1)

                if existing_index != -1:
                    current.pop(existing_index)

                current.insert(0, new_meta)
                _write_json_sync(config["index"], current)

            await run_io(_update_index_logic)

            # Clear cache
            await cache.clear()
            return {"success": True, "id": item_id, "action": "updated"}

        except Exception as e:
            raise HTTPException(500, f"Update failed: {str(e)}")


@router.get("/api/songs/{item_id}/meta")
async def get_item_metadata(item_id: str, type: Optional[str] = Query(None)):
    """
    Returns only the metadata for an item without the full data payload.
    Much faster for listing/details views.
    """
    from ..services.index import get_item_metadata as _get_meta
    result = await _get_meta(item_id, type)
    
    if result:
        return result
    
    raise HTTPException(404, "Item not found")


@router.get("/api/songs/{item_id}")
async def get_item(item_id: str, type: Optional[str] = Query(None)):
    """Fetch full JSON item data."""
    # Try to find the file
    search_types = [type] if type else ["song", "pattern", "bank"]

    for t in search_types:
        config = STORAGE_MAP.get(t)
        filepath = f"{config['folder']}{item_id}.json"

        # Check existence efficiently
        blob = bucket.blob(filepath)
        exists = await run_io(blob.exists)

        if exists:
            import json
            data = await run_io(blob.download_as_text)
            return json.loads(data)

    raise HTTPException(404, "Item not found")
