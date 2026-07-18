# Marbles cloud save / ghost / leaderboard GCS operations
import base64
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from ..config import MARBLES_GHOST_MAX_BYTES, STORAGE_MAP
from ..io import run_io, _read_json_sync, _write_json_sync, INDEX_LOCK
from ..models_marbles import CampaignSavePayload, GhostUploadPayload, LeaderboardEntry

REPLAY_PREFIX = "m3g1:"
REPLAY_MAGIC = b"M3G1"
REPLAY_VERSION = 1
MEDAL_RANK = {"bronze": 1, "silver": 2, "gold": 3, None: 0}


def _progress_path(user_id: str) -> str:
    folder = STORAGE_MAP["marbles_progress"]["folder"]
    return f"{folder}{user_id}.json"


def _ghost_path(ghost_id: str) -> str:
    folder = STORAGE_MAP["marbles_ghost"]["folder"]
    return f"{folder}{ghost_id}.txt"


def _ghost_meta_path(ghost_id: str) -> str:
    folder = STORAGE_MAP["marbles_ghost"]["folder"]
    return f"{folder}{ghost_id}.meta.json"


def _leaderboard_path(level_id: str) -> str:
    folder = STORAGE_MAP["marbles_board"]["folder"]
    return f"{folder}{level_id}.json"


def _medal_rank(medal: str | None) -> int:
    return MEDAL_RANK.get(medal, 0)


def merge_level_progress(local: dict | None, remote: dict | None) -> dict:
    if not local and not remote:
        return {"completed": False}
    if not local:
        return dict(remote)
    if not remote:
        return dict(local)

    merged = dict(local)
    merged["completed"] = bool(local.get("completed") or remote.get("completed"))

    lt = local.get("bestTime")
    rt = remote.get("bestTime")
    if lt is not None and rt is not None:
        merged["bestTime"] = min(lt, rt)
    elif rt is not None:
        merged["bestTime"] = rt

    if _medal_rank(remote.get("medal")) > _medal_rank(local.get("medal")):
        merged["medal"] = remote.get("medal")
    elif local.get("medal") is not None:
        merged["medal"] = local.get("medal")

    for key in ("collectibles", "collectiblesPercent"):
        lv = local.get(key)
        rv = remote.get(key)
        if lv is not None and rv is not None:
            merged[key] = max(lv, rv)
        elif rv is not None:
            merged[key] = rv

    ct = local.get("collectiblesTotal") or remote.get("collectiblesTotal")
    if ct is not None:
        merged["collectiblesTotal"] = ct

    return merged


def merge_campaign_save(
    incoming: CampaignSavePayload,
    existing: dict | None,
) -> dict:
    base = incoming.model_dump(exclude={"revision", "updatedAt"})
    if not existing:
        base["revision"] = 1
        base["updatedAt"] = datetime.now(timezone.utc).isoformat()
        return base

    merged = {
        "version": max(incoming.version, existing.get("version", 1)),
        "freePlay": bool(incoming.freePlay or existing.get("freePlay")),
        "unlockedChapters": sorted(
            set(incoming.unlockedChapters) | set(existing.get("unlockedChapters", []))
        ),
        "unlockedMarbles": sorted(
            set(incoming.unlockedMarbles) | set(existing.get("unlockedMarbles", []))
        ),
        "levels": {},
    }

    all_level_ids = set(incoming.levels.keys()) | set(existing.get("levels", {}).keys())
    for level_id in all_level_ids:
        inc = incoming.levels.get(level_id)
        ex = existing.get("levels", {}).get(level_id)
        inc_dict = inc.model_dump() if inc else None
        merged["levels"][level_id] = merge_level_progress(inc_dict, ex)

    merged["revision"] = max(
        incoming.revision,
        existing.get("revision", 0),
    ) + 1
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return merged


def validate_replay_blob(blob: str, expected_level_id: str) -> None:
    if not blob.startswith(REPLAY_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid replay prefix")
    if len(blob.encode("utf-8")) > MARBLES_GHOST_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Replay exceeds size cap")

    b64 = blob[len(REPLAY_PREFIX):]
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid replay encoding") from exc

    if len(raw) < 8 or raw[:4] != REPLAY_MAGIC:
        raise HTTPException(status_code=400, detail="Invalid replay magic")
    if raw[4] != REPLAY_VERSION:
        raise HTTPException(status_code=400, detail="Unsupported replay version")

    level_id_len = raw[5]
    if len(raw) < 6 + level_id_len:
        raise HTTPException(status_code=400, detail="Truncated replay header")
    level_id = raw[6:6 + level_id_len].decode("utf-8")
    if level_id != expected_level_id:
        raise HTTPException(status_code=400, detail="Replay level mismatch")


async def get_progress(user_id: str) -> dict | None:
    path = _progress_path(user_id)

    def _read():
        data = _read_json_sync(path)
        return data if isinstance(data, dict) else None

    return await run_io(_read)


async def put_progress(user_id: str, payload: CampaignSavePayload) -> dict:
    path = _progress_path(user_id)

    async with INDEX_LOCK:
        def _write():
            existing = _read_json_sync(path)
            if not isinstance(existing, dict):
                existing = None
            merged = merge_campaign_save(payload, existing)
            _write_json_sync(path, merged)
            return merged

        return await run_io(_write)


async def upload_ghost(user_id: str, payload: GhostUploadPayload) -> dict:
    validate_replay_blob(payload.blob, payload.levelId)
    ghost_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    display = (payload.displayName or f"Player-{user_id[-4:].upper()}")[:32]

    meta = {
        "ghostId": ghost_id,
        "userId": user_id,
        "levelId": payload.levelId,
        "bestTime": payload.bestTime,
        "displayName": display,
        "submittedAt": now,
    }

    async with INDEX_LOCK:
        def _store():
            _write_json_sync(_ghost_meta_path(ghost_id), meta)
            from ..client import bucket
            blob = bucket.blob(_ghost_path(ghost_id))
            blob.upload_from_string(payload.blob.strip(), content_type="text/plain")
            return meta

        stored = await run_io(_store)
        await _maybe_update_leaderboard(payload.levelId, stored)
        return {"ghostId": ghost_id, "bestTime": payload.bestTime, "levelId": payload.levelId}


async def _maybe_update_leaderboard(level_id: str, entry: dict) -> None:
    board_path = _leaderboard_path(level_id)

    def _update():
        board = _read_json_sync(board_path)
        if not isinstance(board, list):
            board = []
        board.append(entry)
        board.sort(key=lambda e: e.get("bestTime", float("inf")))
        board = board[:3]
        _write_json_sync(board_path, board)
        return board

    await run_io(_update)


async def get_ghost(ghost_id: str) -> dict:
    def _read():
        meta = _read_json_sync(_ghost_meta_path(ghost_id))
        if not isinstance(meta, dict):
            return None
        from ..client import bucket
        blob = bucket.blob(_ghost_path(ghost_id))
        if not blob.exists():
            return None
        meta["blob"] = blob.download_as_text()
        return meta

    result = await run_io(_read)
    if not result:
        raise HTTPException(status_code=404, detail="Ghost not found")
    return result


async def get_leaderboard(level_id: str) -> list[LeaderboardEntry]:
    board_path = _leaderboard_path(level_id)

    def _read():
        board = _read_json_sync(board_path)
        return board if isinstance(board, list) else []

    raw = await run_io(_read)
    entries: list[LeaderboardEntry] = []
    for idx, item in enumerate(raw[:3]):
        entries.append(
            LeaderboardEntry(
                rank=idx + 1,
                ghostId=item.get("ghostId", ""),
                displayName=item.get("displayName", "Player"),
                bestTime=item.get("bestTime", 0),
                userId=item.get("userId", ""),
                submittedAt=item.get("submittedAt", ""),
            )
        )
    return entries
