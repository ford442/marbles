# Music Endpoints
import logging
from typing import Optional
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync, _write_json_sync, INDEX_LOCK
from ..client import bucket
from ..models import SampleMetaUpdatePayload

router = APIRouter()


@router.get("/api/music/{music_id}")
async def get_music_file(music_id: str):
    """Streams a music file from the music folder."""
    config = STORAGE_MAP["music"]
    
    # 1. Lookup in Index
    idx = await run_io(_read_json_sync, config["index"])
    entry = next((i for i in idx if i["id"] == music_id), None)
    
    if not entry:
        raise HTTPException(404, "Music track not found in index")
    
    blob_path = f"{config['folder']}{entry['filename']}"
    blob = bucket.blob(blob_path)
    
    if not await run_io(blob.exists):
        raise HTTPException(404, "File missing from storage")
    
    # 2. Stream Download
    def iterfile():
        with blob.open("rb") as f:
            while chunk := f.read(1024 * 1024):  # 1MB chunks
                yield chunk
    
    # Determine content type
    lower_name = entry['filename'].lower()
    if lower_name.endswith('.flac'):
        media_type = 'audio/flac'
    elif lower_name.endswith('.wav'):
        media_type = 'audio/wav'
    elif lower_name.endswith('.mp3'):
        media_type = 'audio/mpeg'
    else:
        media_type = 'audio/mpeg'
    
    return StreamingResponse(
        iterfile(),
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{entry["name"]}"'}
    )


@router.put("/api/music/{music_id}")
async def update_music_metadata(music_id: str, payload: SampleMetaUpdatePayload):
    """Updates metadata for a music track."""
    config = STORAGE_MAP["music"]
    index_path = config["index"]
    
    async with INDEX_LOCK:
        try:
            index_data = await run_io(_read_json_sync, index_path)
            if not isinstance(index_data, list):
                raise HTTPException(status_code=500, detail="Music index is corrupted.")
            
            entry_index = next((i for i, item in enumerate(index_data) if item.get("id") == music_id), -1)
            if entry_index == -1:
                raise HTTPException(status_code=404, detail="Music track not found.")
            
            entry = index_data[entry_index]
            update_happened = False
            
            if payload.name is not None and payload.name != entry.get("name"):
                entry["name"] = payload.name
                update_happened = True
            if payload.title is not None and payload.title != entry.get("title"):
                entry["title"] = payload.title
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
            if payload.description is not None and payload.description != entry.get("description"):
                entry["description"] = payload.description
                update_happened = True
            
            if update_happened:
                logging.info(f"Writing updated music index with {len(index_data)} entries")
                await run_io(_write_json_sync, index_path, index_data)
                await cache.delete("library:music")
                await cache.delete("library:all")
                logging.info(f"Cache cleared for music update")
            
            return {"success": True, "id": music_id, "action": "metadata_updated" if update_happened else "no_change"}
            
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Failed to update music metadata: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update: {str(e)}")
