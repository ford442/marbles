# Sync Logic
import uuid
import json
import logging
from datetime import datetime
from fastapi import HTTPException
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync, _write_json_sync
from ..client import bucket


async def sync_music_folder():
    """Scans the music/ folder and rebuilds the music index."""
    config = STORAGE_MAP["music"]
    report = {"added": 0, "removed": 0}
    
    # 1. List all files in music/
    blobs = await run_io(lambda: list(bucket.list_blobs(prefix=config["folder"])))
    
    # Filter for audio files (FLAC, WAV, MP3)
    audio_files = []
    for b in blobs:
        fname = b.name.replace(config["folder"], "")
        if fname and not b.name.endswith(config["index"]):
            lower = fname.lower()
            if lower.endswith(('.flac', '.wav', '.mp3', '.ogg')):
                audio_files.append({
                    "filename": fname,
                    "name": fname,
                    "size": b.size,
                    "url": b.public_url
                })
    
    # 2. Get current index
    index_data = await run_io(_read_json_sync, config["index"])
    if not isinstance(index_data, list):
        index_data = []
    
    # 3. Compare and update
    index_map = {item["filename"]: item for item in index_data}
    disk_set = set(f["filename"] for f in audio_files)
    
    # Remove missing files
    new_index = [item for item in index_data if item["filename"] in disk_set]
    report["removed"] = len(index_data) - len(new_index)
    
    # Add new files
    for file_info in audio_files:
        if file_info["filename"] not in index_map:
            new_entry = {
                "id": str(uuid.uuid4()),
                "filename": file_info["filename"],
                "name": file_info["name"],
                "title": None,  # Display title separate from filename
                "type": "music",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "author": "Unknown",
                "description": "",
                "rating": None,
                "genre": None,
                "last_played": None,
                "url": file_info["url"],
                "size": file_info["size"]
            }
            new_index.insert(0, new_entry)
            report["added"] += 1
    
    if report["added"] > 0 or report["removed"] > 0:
        await run_io(_write_json_sync, config["index"], new_index)
    
    await cache.delete("library:music")
    await cache.delete("library:all")
    
    report["total"] = len(new_index)
    return report


async def seed_test_samples():
    """Creates test sample entries for development."""
    config = STORAGE_MAP["sample"]
    test_samples = [
        {
            "id": "test-flac-001",
            "name": "Test Ambient Track.flac",
            "filename": "test-flac-001.flac",
            "type": "sample",
            "author": "Test Artist",
            "date": "2024-02-09",
            "description": "Test ambient track",
            "rating": 8,
            "genre": "ambient"
        },
        {
            "id": "test-wav-002", 
            "name": "Test Bass Line.wav",
            "filename": "test-wav-002.wav",
            "type": "sample",
            "author": "Test Artist",
            "date": "2024-02-09",
            "description": "Test bass line",
            "rating": 7,
            "genre": "bass"
        },
        {
            "id": "test-flac-003",
            "name": "Unrated Demo.flac",
            "filename": "test-flac-003.flac",
            "type": "sample",
            "author": "Unknown",
            "date": "2024-02-09",
            "description": "Demo without rating",
            "rating": None,
            "genre": None
        }
    ]
    
    # Read existing
    index_data = await run_io(_read_json_sync, config["index"])
    if not isinstance(index_data, list):
        index_data = []
    
    # Add test samples (avoid duplicates)
    existing_ids = {item.get("id") for item in index_data}
    added = 0
    for sample in test_samples:
        if sample["id"] not in existing_ids:
            index_data.insert(0, sample)
            added += 1
    
    await run_io(_write_json_sync, config["index"], index_data)
    await cache.delete("library:sample")
    await cache.delete("library:all")
    
    return {"success": True, "added": added, "total": len(index_data)}


async def sync_gcs_storage():
    """
    Scans Google Cloud Storage to rebuild JSON indexes based on actual files.
    """
    from ..io import INDEX_LOCK
    report = {}

    async with INDEX_LOCK:
        for item_type, config in STORAGE_MAP.items():
            if item_type in ["default", "music", "shader"]:
                continue  # Skip music/shader in default sync, handle separately

            added = 0
            removed = 0

            try:
                # 1. List ALL objects in this folder prefix
                # prefix="songs/" returns "songs/123.json", "songs/456.json", etc.
                blobs = await run_io(lambda: list(bucket.list_blobs(prefix=config["folder"])))

                # Filter out the index file itself
                actual_files = []
                for b in blobs:
                    # Remove the folder prefix to get just filename (e.g., "123.json")
                    fname = b.name.replace(config["folder"], "")
                    # Ensure it's not the index file
                    if fname and not b.name.endswith(config["index"]):
                        actual_files.append(fname)

                # 2. Get Current Index
                index_data = await run_io(_read_json_sync, config["index"])

                # 3. Compare
                index_map = {item["filename"]: item for item in index_data}
                disk_set = set(actual_files)

                # Find Ghosts (In Index, Not on Disk)
                new_index = []
                for item in index_data:
                    if item["filename"] in disk_set:
                        new_index.append(item)
                    else:
                        removed += 1

                # Find Orphans (On Disk, Not in Index)
                for filename in actual_files:
                    if filename not in index_map:
                        # Create new entry
                        new_entry = {
                            # Generate new ID or parse from filename if possible
                            "id": str(uuid.uuid4()),
                            "filename": filename,
                            "type": item_type,
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "name": filename,
                            "author": "Unknown",
                            "description": "Auto-discovered via Sync",
                            "genre": None,
                            "last_played": None
                        }

                        # If JSON, peek inside for metadata
                        if filename.endswith(".json") and item_type in ["song", "pattern", "bank"]:
                            try:
                                b = bucket.blob(
                                    f"{config['folder']}{filename}")
                                content = json.loads(b.download_as_text())
                                if "name" in content:
                                    new_entry["name"] = content["name"]
                                if "author" in content:
                                    new_entry["author"] = content["author"]
                            except:
                                pass

                        new_index.insert(0, new_entry)
                        added += 1

                # 4. Save if changed
                if added > 0 or removed > 0:
                    await run_io(_write_json_sync, config["index"], new_index)

                report[item_type] = {"added": added,
                                     "removed": removed, "status": "synced"}

            except Exception as e:
                report[item_type] = {"error": str(e)}

        await cache.clear()
        return report
