# GCS I/O Helpers
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from .client import bucket

# GCS handles high concurrency well
io_executor = ThreadPoolExecutor(max_workers=20)
INDEX_LOCK = asyncio.Lock()  # Prevents race conditions during index writes


async def run_io(func, *args, **kwargs):
    """Runs blocking GCS I/O in a thread pool"""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(io_executor, lambda: func(*args, **kwargs))


def _read_json_sync(blob_path):
    """Read JSON from GCS blob synchronously"""
    blob = bucket.blob(blob_path)
    if blob.exists():
        return json.loads(blob.download_as_text())
    return []


def _write_json_sync(blob_path, data):
    """Write JSON to GCS blob synchronously"""
    blob = bucket.blob(blob_path)
    # Upload as JSON string with correct content type
    blob.upload_from_string(
        json.dumps(data),
        content_type='application/json'
    )


async def save_metadata(item_id: str, meta: dict, item_type: str = "shader"):
    """Save metadata to the appropriate index file."""
    from .config import STORAGE_MAP
    config = STORAGE_MAP.get(item_type, STORAGE_MAP["default"])
    index_path = config["index"]
    
    def _update():
        idx = _read_json_sync(index_path)
        if not isinstance(idx, list):
            idx = []
        
        # Remove existing entry with same ID
        idx = [item for item in idx if item.get("id") != item_id]
        
        # Add new entry at beginning
        idx.insert(0, meta)
        _write_json_sync(index_path, idx)
        return idx
    
    return await run_io(_update)


def shutdown_executor():
    """Shutdown the thread pool executor"""
    io_executor.shutdown()
