import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from geoalchemy2.elements import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.device import Device
from app.models.measurement import Measurement
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.measurement import (
    MeasurementCreate,
    MeasurementMe,
    MeasurementPublic,
    MeasurementSubmitResponse,
    StatisticsResponse,
)
from app.services.quality import quality_service
from app.services.gamification import gamification_service

router = APIRouter(prefix="/measurements", tags=["measurements"])


async def _get_or_create_device(
    db: AsyncSession,
    user_id: uuid.UUID,
    platform: Optional[str],
    model: Optional[str],
    os_version: Optional[str],
    app_version: Optional[str],
) -> Optional[Device]:
    """
    Look up a device by user_id + platform + model.
    Create a new device record if one doesn't exist.
    Returns None when neither platform nor model is provided.
    """
    if not platform and not model:
        return None

    platform = platform or "unknown"
    model = model or "unknown"

    result = await db.execute(
        select(Device).where(
            Device.user_id == user_id,
            Device.platform == platform,
            Device.model == model,
        )
    )
    device = result.scalar_one_or_none()

    if device is None:
        device = Device(
            user_id=user_id,
            platform=platform,
            model=model,
            os_version=os_version or "",
            app_version=app_version or "",
            calibration_offset=0.0,
        )
        db.add(device)
        await db.flush()

    return device


@router.post("", response_model=MeasurementSubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_measurement(
    body: MeasurementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new noise measurement.

    Performs quality validation, stores the point geometry,
    awards gamification points, and returns the stored record.
    """
    # Quality validation
    measurement_data = {
        "measured_db": body.measured_db,
        "gps_accuracy": body.gps_accuracy,
        "latitude": body.latitude,
        "longitude": body.longitude,
    }
    is_valid, reason = quality_service.validate(measurement_data)
    quality_flag = "valid" if is_valid else "invalid"

    # Resolve or create device
    device = await _get_or_create_device(
        db,
        current_user.id,
        platform=body.operating_system,
        model=body.device_model,
        os_version=body.operating_system,
        app_version=body.app_version,
    )

    calibration_offset = device.calibration_offset if device else 0.0
    calibrated_db = body.measured_db + calibration_offset

    # Build geometry
    geom = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)

    measurement = Measurement(
        user_id=current_user.id,
        device_id=device.id if device else None,
        measured_db=body.measured_db,
        calibrated_db=calibrated_db,
        latitude=body.latitude,
        longitude=body.longitude,
        gps_accuracy=body.gps_accuracy,
        timestamp=body.timestamp,
        duration_seconds=body.duration_seconds,
        quality_flag=quality_flag,
        geom=geom,
    )
    db.add(measurement)
    await db.flush()

    # Award points only for valid measurements
    points_earned = 0
    if quality_flag == "valid":
        points_earned = await gamification_service.award_points(db, current_user.id, measurement)

    await db.flush()
    return MeasurementSubmitResponse(
        **MeasurementMe.model_validate(measurement).model_dump(),
        points_earned=points_earned,
    )


@router.get("/me", response_model=list[MeasurementMe])
async def my_measurements(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's measurements, newest first, paginated."""
    result = await db.execute(
        select(Measurement)
        .where(Measurement.user_id == current_user.id)
        .order_by(Measurement.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    measurements = result.scalars().all()
    return [MeasurementMe.model_validate(m) for m in measurements]


@router.get("/public", response_model=list[MeasurementPublic])
async def public_measurements(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return recent valid measurements (no user identity exposed), newest first."""
    result = await db.execute(
        select(Measurement)
        .where(Measurement.quality_flag == "valid")
        .order_by(Measurement.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    measurements = result.scalars().all()
    return [MeasurementPublic.model_validate(m) for m in measurements]


@router.get("/statistics", response_model=StatisticsResponse)
async def my_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregate statistics for the current user's measurements."""
    # Total count
    total_result = await db.execute(
        select(func.count(Measurement.id)).where(Measurement.user_id == current_user.id)
    )
    total_count = total_result.scalar_one()

    # Valid count
    valid_result = await db.execute(
        select(func.count(Measurement.id)).where(
            Measurement.user_id == current_user.id,
            Measurement.quality_flag == "valid",
        )
    )
    valid_count = valid_result.scalar_one()

    if valid_count == 0:
        return StatisticsResponse(
            total_count=total_count,
            valid_count=0,
        )

    # Aggregate stats on valid measurements
    agg_result = await db.execute(
        select(
            func.avg(Measurement.calibrated_db),
            func.min(Measurement.calibrated_db),
            func.max(Measurement.calibrated_db),
        ).where(
            Measurement.user_id == current_user.id,
            Measurement.quality_flag == "valid",
        )
    )
    avg_db, min_db, max_db = agg_result.one()

    # Fetch all valid calibrated_db values for percentile calculation
    values_result = await db.execute(
        select(Measurement.calibrated_db).where(
            Measurement.user_id == current_user.id,
            Measurement.quality_flag == "valid",
        ).order_by(Measurement.calibrated_db)
    )
    values = [row[0] for row in values_result.all()]

    def percentile(sorted_vals: list[float], p: float) -> float:
        if not sorted_vals:
            return 0.0
        idx = (len(sorted_vals) - 1) * p / 100
        lower = int(idx)
        upper = lower + 1
        if upper >= len(sorted_vals):
            return sorted_vals[lower]
        frac = idx - lower
        return sorted_vals[lower] + frac * (sorted_vals[upper] - sorted_vals[lower])

    return StatisticsResponse(
        total_count=total_count,
        valid_count=valid_count,
        avg_db=round(avg_db, 2) if avg_db is not None else None,
        min_db=round(min_db, 2) if min_db is not None else None,
        max_db=round(max_db, 2) if max_db is not None else None,
        percentile_50=round(percentile(values, 50), 2),
        percentile_95=round(percentile(values, 95), 2),
    )
