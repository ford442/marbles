# Index Management
from typing import List, Optional
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync
from ..models import SortBy


async def list_library(
    type: Optional[str] = None,
    sort_by: SortBy = SortBy.date,
    sort_desc: bool = True,
    genre: Optional[str] = None,
    min_rating: Optional[int] = None
) -> List[dict]:
    """List library items with filtering and sorting."""
    cache_key = f"library:{type or 'all'}:{sort_by}:{sort_desc}:{genre}:{min_rating}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    search_types = [type] if type else ["song", "pattern", "bank", "sample", "music", "shader"]
    results = []

    for t in search_types:
        config = STORAGE_MAP.get(t, STORAGE_MAP["default"])
        try:
            # Fetch index file from GCS
            items = await run_io(_read_json_sync, config["index"])
            if isinstance(items, list):
                results.extend(items)
        except Exception as e:
            print(f"Error listing {t}: {e}")

    # Filter by genre
    if genre:
        results = [r for r in results if r.get("genre") == genre]

    # Filter by min rating
    if min_rating is not None:
        results = [r for r in results if (r.get("rating") or 0) >= min_rating]

    # Sort results
    def sort_key(item):
        val = item.get(sort_by.value)
        if val is None:
            # None values go to the end
            return (1, "")
        return (0, val)

    results.sort(key=sort_key, reverse=sort_desc)

    await cache.set(cache_key, results, ttl=30)
    return results


async def get_item_metadata(item_id: str, type: Optional[str] = None) -> dict:
    """Returns only the metadata for an item without the full data payload."""
    search_types = [type] if type else ["song", "pattern", "bank"]
    
    for t in search_types:
        config = STORAGE_MAP.get(t)
        if not config:
            continue
            
        # Read from index (much faster than fetching full file)
        index_data = await run_io(_read_json_sync, config["index"])
        
        if isinstance(index_data, list):
            entry = next((item for item in index_data if item.get("id") == item_id), None)
            if entry:
                return entry
    
    return None


async def health_check():
    """Returns storage manager status and index counts."""
    from ..client import bucket
    status = {}
    for item_type, config in STORAGE_MAP.items():
        if item_type == "default":
            continue
        try:
            items = await run_io(_read_json_sync, config["index"])
            count = len(items) if isinstance(items, list) else 0
            status[item_type] = {"count": count, "status": "ok"}
        except Exception as e:
            status[item_type] = {"count": 0, "status": "error", "error": str(e)}
    return status
