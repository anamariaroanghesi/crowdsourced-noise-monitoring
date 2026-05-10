import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MeasurementCreate(BaseModel):
    user_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    measured_db: float
    latitude: float
    longitude: float
    gps_accuracy: float
    timestamp: datetime
    duration_seconds: float
    device_model: Optional[str] = None
    operating_system: Optional[str] = None
    app_version: Optional[str] = None


class MeasurementPublic(BaseModel):
    id: uuid.UUID
    measured_db: float
    latitude: float
    longitude: float
    timestamp: datetime
    quality_flag: str
    duration_seconds: float

    model_config = {"from_attributes": True}


class MeasurementMe(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    measured_db: float
    calibrated_db: float
    latitude: float
    longitude: float
    timestamp: datetime
    quality_flag: str
    duration_seconds: float
    created_at: datetime

    model_config = {"from_attributes": True}


class StatisticsResponse(BaseModel):
    total_count: int
    valid_count: int
    avg_db: Optional[float] = None
    min_db: Optional[float] = None
    max_db: Optional[float] = None
    percentile_50: Optional[float] = None
    percentile_95: Optional[float] = None
