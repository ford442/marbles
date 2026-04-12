# Pydantic Models
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ItemPayload(BaseModel):
    name: str
    author: str
    description: Optional[str] = ""
    type: str = "song"
    data: dict
    rating: Optional[int] = None


class MetaData(BaseModel):
    id: str
    name: str
    title: Optional[str] = None  # Display title separate from filename
    author: str
    date: str
    type: str
    description: Optional[str] = ""
    filename: str
    rating: Optional[int] = None
    genre: Optional[str] = None
    last_played: Optional[str] = None  # ISO timestamp


class SortBy(str, Enum):
    date = "date"
    rating = "rating"
    name = "name"
    last_played = "last_played"
    genre = "genre"


class SampleMetaUpdatePayload(BaseModel):
    """Payload for updating a sample's metadata."""
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[int] = Field(
        None, ge=1, le=10, description="A rating from 1 to 10.")
    genre: Optional[str] = None
    last_played: Optional[str] = None  # ISO timestamp
