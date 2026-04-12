# Shader Endpoints
import uuid
import json
import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..config import STORAGE_MAP
from ..cache import cache
from ..io import run_io, _read_json_sync, INDEX_LOCK, save_metadata
from ..client import bucket

router = APIRouter()


@router.post("/api/shaders/import/shadertoy")
async def import_shadertoy(
    shader_id: str = Form(...),
    api_key: str = Form(...)
):
    """Import a shader from Shadertoy.com API."""
    import httpx
    
    url = f"https://www.shadertoy.com/api/shader/{shader_id}?key={api_key}"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url)
        if r.status_code != 200 or "Shader" not in r.json():
            raise HTTPException(400, "Invalid Shadertoy ID or API key")
        
        data = r.json()["Shader"]
        glsl = data["code"][0]
        info = data["info"]
        
        shader_id_new = f"st_{shader_id}"
        config = STORAGE_MAP["shader"]
        full_path = f"{config['folder']}{shader_id_new}.wgsl"
        
        meta = {
            "id": shader_id_new,
            "name": f"Shadertoy: {info['name']}",
            "author": info.get("username", "shadertoy"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "description": (info.get("description") or "")[:250],
            "tags": ["shadertoy", "imported"] + info.get("tags", []),
            "filename": f"{shader_id_new}.wgsl",
            "source": "shadertoy",
            "original_id": shader_id,
            "iChannels": [inp.get("src") for inp in info.get("renderpass", [{}])[0].get("inputs", [])],
            "stars": 0.0,
            "rating_count": 0
        }
        
        async with INDEX_LOCK:
            blob = bucket.blob(full_path)
            await run_io(blob.upload_from_string, glsl, content_type="text/plain")
            await save_metadata(shader_id_new, meta, "shader")
            await cache.delete("shaders:list")
        
        return {"success": True, "id": shader_id_new, "name": info["name"], "meta": meta}


@router.get("/api/shaders")
async def list_shaders():
    """List all shaders in the library."""
    cache_key = "library:shader"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    config = STORAGE_MAP["shader"]
    try:
        items = await run_io(_read_json_sync, config["index"])
        if not isinstance(items, list):
            items = []
        await cache.set(cache_key, items, ttl=60)
        return items
    except Exception as e:
        print(f"Error listing shaders: {e}")
        return []


@router.get("/api/shaders/{shader_id}")
async def get_shader(shader_id: str):
    """Get a shader by ID."""
    config = STORAGE_MAP["shader"]
    filepath = f"{config['folder']}{shader_id}.wgsl"
    
    blob = bucket.blob(filepath)
    exists = await run_io(blob.exists)
    
    if not exists:
        # Try .json extension
        filepath_json = f"{config['folder']}{shader_id}.json"
        blob_json = bucket.blob(filepath_json)
        if await run_io(blob_json.exists):
            data = await run_io(blob_json.download_as_text)
            return json.loads(data)
        raise HTTPException(404, "Shader not found")
    
    content = await run_io(blob.download_as_text)
    return {"id": shader_id, "content": content, "type": "wgsl"}


@router.post("/api/shaders")
async def upload_shader(
    file: UploadFile = File(...),
    author: str = Form(...),
    description: str = Form(""),
    name: str = Form(...),
    tags: str = Form("")
):
    """Upload a new shader (WGSL or GLSL)."""
    shader_id = str(uuid.uuid4())
    
    # Determine extension
    original_ext = os.path.splitext(file.filename)[1].lower()
    if original_ext in ['.glsl', '.frag', '.vert']:
        storage_ext = '.glsl'
    else:
        storage_ext = '.wgsl'
    
    filename = f"{shader_id}{storage_ext}"
    config = STORAGE_MAP["shader"]
    full_path = f"{config['folder']}{filename}"
    
    # Read content
    content = await file.read()
    content_str = content.decode('utf-8')
    
    meta = {
        "id": shader_id,
        "name": name or file.filename,
        "author": author,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "type": "shader",
        "description": description,
        "filename": filename,
        "original_filename": file.filename,
        "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
        "rating": None,
        "source": "upload",
        "format": "glsl" if storage_ext == ".glsl" else "wgsl",
        "converted": storage_ext == ".wgsl"
    }
    
    async with INDEX_LOCK:
        try:
            # Write file
            blob = bucket.blob(full_path)
            await run_io(blob.upload_from_string, content_str, content_type="text/plain")
            
            # Update index
            def _update_idx():
                idx = _read_json_sync(config["index"])
                if not isinstance(idx, list):
                    idx = []
                idx.insert(0, meta)
                _write_json_sync(config["index"], idx)
            
            await run_io(_update_idx)
            await cache.delete("library:shader")
            await cache.delete("library:all")
            
            return {"success": True, "id": shader_id, "meta": meta}
        except Exception as e:
            raise HTTPException(500, f"Upload failed: {str(e)}")


@router.put("/api/shaders/{shader_id}")
async def update_shader_metadata(
    shader_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    rating: Optional[int] = Form(None)
):
    """Update shader metadata."""
    config = STORAGE_MAP["shader"]
    index_path = config["index"]
    
    async with INDEX_LOCK:
        try:
            index_data = await run_io(_read_json_sync, index_path)
            if not isinstance(index_data, list):
                raise HTTPException(500, "Shader index is corrupted.")
            
            entry_index = next((i for i, item in enumerate(index_data) if item.get("id") == shader_id), -1)
            if entry_index == -1:
                raise HTTPException(404, "Shader not found.")
            
            entry = index_data[entry_index]
            
            if name is not None:
                entry["name"] = name
            if description is not None:
                entry["description"] = description
            if tags is not None:
                entry["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
            if rating is not None:
                entry["rating"] = rating
            
            await run_io(_write_json_sync, index_path, index_data)
            await cache.delete("library:shader")
            await cache.delete("library:all")
            
            return {"success": True, "id": shader_id, "action": "metadata_updated"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Update failed: {str(e)}")


@router.get("/api/renderer/status")
async def get_renderer_status():
    """Get current renderer status and available backends."""
    return {
        "backends": ["js-webgpu", "cpp-wasm"],
        "default": "js-webgpu",
        "wasm_available": False,  # Will be True when WASM module is built
        "wasm_module_url": "/wasm/renderer.js",
        "wasm_memory_required": 128  # MB
    }


@router.post("/api/shaders/{shader_id}/convert")
async def convert_shader(shader_id: str, target_format: str = Form("wgsl")):
    """
    Convert a shader to target format.
    For now, only supports GLSL -> WGSL conversion marker.
    Actual conversion happens on frontend using TintWASM.
    """
    config = STORAGE_MAP["shader"]
    index_path = config["index"]
    
    async with INDEX_LOCK:
        try:
            index_data = await run_io(_read_json_sync, index_path)
            entry = next((item for item in index_data if item.get("id") == shader_id), None)
            
            if not entry:
                raise HTTPException(404, "Shader not found")
            
            # Mark as needing conversion
            entry["convert_to"] = target_format
            entry["conversion_pending"] = True
            
            await run_io(_write_json_sync, index_path, index_data)
            await cache.delete("library:shader")
            
            return {
                "success": True,
                "id": shader_id,
                "conversion": "pending",
                "target_format": target_format,
                "message": "Conversion queued. Use TintWASM on frontend for actual conversion."
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Conversion failed: {str(e)}")
