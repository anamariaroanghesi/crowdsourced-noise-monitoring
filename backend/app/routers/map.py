from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.measurement import Measurement
from app.schemas.map import MapPoint, MapPointsResponse, MapStatisticsResponse

router = APIRouter(prefix="/map", tags=["map"])

TIME_WINDOW_DELTAS = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


def _cutoff(time_window: str) -> datetime:
    delta = TIME_WINDOW_DELTAS.get(time_window, timedelta(hours=24))
    return datetime.now(timezone.utc) - delta


@router.get("/points", response_model=MapPointsResponse)
async def map_points(
    time_window: Literal["1h", "6h", "24h", "7d"] = Query(default="24h"),
    min_db: Optional[float] = Query(default=None),
    max_db: Optional[float] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Return valid measurement points for map rendering.

    Filters by time window and optional dB range.
    Sets data_density to 'low' when fewer than 20 points are returned.
    """
    cutoff = _cutoff(time_window)

    query = (
        select(Measurement)
        .where(
            Measurement.quality_flag == "valid",
            Measurement.timestamp >= cutoff,
        )
    )

    if min_db is not None:
        query = query.where(Measurement.measured_db >= min_db)
    if max_db is not None:
        query = query.where(Measurement.measured_db <= max_db)

    query = query.order_by(Measurement.timestamp.desc())

    result = await db.execute(query)
    measurements = result.scalars().all()

    points = [
        MapPoint(
            id=m.id,
            latitude=m.latitude,
            longitude=m.longitude,
            measured_db=m.measured_db,
            quality_flag=m.quality_flag,
            timestamp=m.timestamp,
        )
        for m in measurements
    ]

    total = len(points)
    data_density = "sufficient" if total >= 20 else "low"

    return MapPointsResponse(points=points, total=total, data_density=data_density)


@router.get("/statistics", response_model=MapStatisticsResponse)
async def map_statistics(
    time_window: Literal["1h", "6h", "24h", "7d"] = Query(default="24h"),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregate statistics for visible map points in the given time window."""
    cutoff = _cutoff(time_window)

    # Total count (all quality flags)
    total_result = await db.execute(
        select(func.count(Measurement.id)).where(
            Measurement.timestamp >= cutoff,
        )
    )
    total_count = total_result.scalar_one() or 0

    # Valid-only aggregates
    agg_result = await db.execute(
        select(
            func.count(Measurement.id),
            func.avg(Measurement.measured_db),
            func.min(Measurement.measured_db),
            func.max(Measurement.measured_db),
            func.percentile_cont(0.50).within_group(Measurement.measured_db.asc()),
            func.percentile_cont(0.95).within_group(Measurement.measured_db.asc()),
        ).where(
            Measurement.quality_flag == "valid",
            Measurement.timestamp >= cutoff,
        )
    )
    valid_count, avg_db, min_db, max_db, p50, p95 = agg_result.one()

    def _round(v: float | None) -> float | None:
        return round(v, 1) if v is not None else None

    return MapStatisticsResponse(
        valid_count=valid_count or 0,
        total_count=total_count,
        avg_db=_round(avg_db),
        min_db=_round(min_db),
        max_db=_round(max_db),
        percentile_50=_round(p50),
        percentile_95=_round(p95),
        time_window=time_window,
    )
