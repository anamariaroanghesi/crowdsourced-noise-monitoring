import uuid
from datetime import datetime

from pydantic import BaseModel


class BadgePublic(BaseModel):
    code: str
    name: str
    description: str
    awarded_at: datetime

    model_config = {"from_attributes": True}


class GamificationProfile(BaseModel):
    user_id: uuid.UUID
    total_points: int
    level: int
    level_name: str
    current_streak: int
    longest_streak: int
    badges: list[BadgePublic]

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    total_points: int
    level: int
    level_name: str


class LeaderboardResponse(BaseModel):
    period: str
    entries: list[LeaderboardEntry]
