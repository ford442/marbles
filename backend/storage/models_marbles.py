# Pydantic models for Marbles 3D cloud API
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class LevelProgress(BaseModel):
    completed: bool = False
    bestTime: Optional[float] = None
    medal: Optional[str] = None
    collectibles: Optional[int] = None
    collectiblesTotal: Optional[int] = None
    collectiblesPercent: Optional[int] = None


class CampaignSavePayload(BaseModel):
    version: int = 1
    freePlay: bool = False
    unlockedChapters: List[str] = Field(default_factory=lambda: ["tutorial"])
    levels: Dict[str, LevelProgress] = Field(default_factory=dict)
    unlockedMarbles: List[str] = Field(default_factory=list)
    revision: int = 0
    updatedAt: Optional[str] = None


class GhostUploadPayload(BaseModel):
    levelId: str
    bestTime: float = Field(gt=0)
    blob: str
    displayName: Optional[str] = None


class GhostResponse(BaseModel):
    ghostId: str
    levelId: str
    bestTime: float
    blob: str
    displayName: Optional[str] = None


class LeaderboardEntry(BaseModel):
    rank: int
    ghostId: str
    displayName: str
    bestTime: float
    userId: str
    submittedAt: str


class LeaderboardResponse(BaseModel):
    levelId: str
    entries: List[LeaderboardEntry] = Field(default_factory=list)
