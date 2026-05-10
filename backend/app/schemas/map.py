import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class MapPoint(BaseModel):
    id: uuid.UUID
    latitude: float
    longitude: float
    measured_db: float
    quality_flag: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class MapPointsResponse(BaseModel):
    points: list[MapPoint]
    total: int
    data_density: Literal["low", "sufficient"]


class MapStatisticsResponse(BaseModel):
    count: int
    avg_db: float | None
    time_window: str
