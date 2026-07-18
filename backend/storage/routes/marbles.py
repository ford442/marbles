# Marbles 3D cloud API routes
from fastapi import APIRouter, Depends

from ..auth import require_device_token, verify_user_id
from ..models_marbles import (
    CampaignSavePayload,
    GhostResponse,
    GhostUploadPayload,
    LeaderboardResponse,
)
from ..services import marbles as marbles_service

router = APIRouter(prefix="/v1/marbles", tags=["marbles"])


@router.get("/progress/{user_id}")
async def get_progress(
    user_id: str,
    token: str = Depends(require_device_token),
):
    verify_user_id(user_id, token)
    data = await marbles_service.get_progress(user_id)
    if not data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Progress not found")
    return data


@router.put("/progress/{user_id}")
async def put_progress(
    user_id: str,
    payload: CampaignSavePayload,
    token: str = Depends(require_device_token),
):
    verify_user_id(user_id, token)
    return await marbles_service.put_progress(user_id, payload)


@router.post("/ghosts")
async def post_ghost(
    payload: GhostUploadPayload,
    token: str = Depends(require_device_token),
):
    return await marbles_service.upload_ghost(token, payload)


@router.get("/ghosts/{ghost_id}", response_model=GhostResponse)
async def get_ghost(
    ghost_id: str,
    token: str = Depends(require_device_token),
):
    meta = await marbles_service.get_ghost(ghost_id)
    return GhostResponse(
        ghostId=meta["ghostId"],
        levelId=meta["levelId"],
        bestTime=meta["bestTime"],
        blob=meta["blob"],
        displayName=meta.get("displayName"),
    )


@router.get("/leaderboards/{level_id}", response_model=LeaderboardResponse)
async def get_leaderboard(
    level_id: str,
    token: str = Depends(require_device_token),
):
    entries = await marbles_service.get_leaderboard(level_id)
    return LeaderboardResponse(levelId=level_id, entries=entries)
