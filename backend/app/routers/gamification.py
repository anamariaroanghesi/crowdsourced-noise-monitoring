from datetime import datetime, timezone, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import get_db
from app.models.gamification import GamificationProfile, UserBadge, Badge
from app.models.measurement import Measurement
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.gamification import (
    GamificationProfile as GamificationProfileSchema,
    BadgePublic,
    LeaderboardEntry,
    LeaderboardResponse,
    BadgeCatalogItem,
    BadgeCatalogResponse,
)
from app.services.gamification import get_level_name

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/profile", response_model=GamificationProfileSchema)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's gamification profile including earned badges."""
    result = await db.execute(
        select(GamificationProfile).where(GamificationProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        # Auto-create if missing (e.g. legacy accounts)
        profile = GamificationProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    # Load user badges with badge details
    badges_result = await db.execute(
        select(UserBadge, Badge)
        .join(Badge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == current_user.id)
        .order_by(UserBadge.awarded_at.asc())
    )
    badge_rows = badges_result.all()

    badges = [
        BadgePublic(
            code=badge.code,
            name=badge.name,
            description=badge.description,
            awarded_at=user_badge.awarded_at,
        )
        for user_badge, badge in badge_rows
    ]

    return GamificationProfileSchema(
        user_id=profile.user_id,
        total_points=profile.total_points,
        level=profile.level,
        level_name=get_level_name(profile.level),
        current_streak=profile.current_streak,
        longest_streak=profile.longest_streak,
        badges=badges,
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    period: Literal["weekly", "monthly", "all_time"] = Query(default="all_time"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the top 20 users ranked by period.

    - weekly: rank by COUNT of valid measurements in last 7 days, tiebreak by total_points
    - monthly: rank by COUNT of valid measurements in last 30 days, tiebreak by total_points
    - all_time: rank by total_points
    Only display_name is exposed (no email).
    """
    if period == "all_time":
        result = await db.execute(
            select(GamificationProfile, User.display_name)
            .join(User, GamificationProfile.user_id == User.id)
            .order_by(GamificationProfile.total_points.desc())
            .limit(20)
        )
        rows = result.all()

        entries = []
        for idx, (profile, display_name) in enumerate(rows):
            # Count all valid measurements for all_time
            count_res = await db.execute(
                select(func.count(Measurement.id)).where(
                    Measurement.user_id == profile.user_id,
                    Measurement.quality_flag == "valid",
                )
            )
            mcount = count_res.scalar_one()
            entries.append(
                LeaderboardEntry(
                    rank=idx + 1,
                    display_name=display_name,
                    total_points=profile.total_points,
                    measurement_count=mcount,
                    level=profile.level,
                    level_name=get_level_name(profile.level),
                )
            )
    else:
        # Determine cutoff date
        if period == "weekly":
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        else:  # monthly
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        # Subquery: count valid measurements per user in the period
        period_count_subq = (
            select(
                Measurement.user_id.label("user_id"),
                func.count(Measurement.id).label("period_count"),
            )
            .where(
                Measurement.quality_flag == "valid",
                Measurement.timestamp >= cutoff,
            )
            .group_by(Measurement.user_id)
            .subquery()
        )

        result = await db.execute(
            select(
                GamificationProfile,
                User.display_name,
                func.coalesce(period_count_subq.c.period_count, 0).label("period_count"),
            )
            .join(User, GamificationProfile.user_id == User.id)
            .outerjoin(
                period_count_subq,
                GamificationProfile.user_id == period_count_subq.c.user_id,
            )
            .order_by(
                desc(func.coalesce(period_count_subq.c.period_count, 0)),
                GamificationProfile.total_points.desc(),
            )
            .limit(20)
        )
        rows = result.all()

        entries = [
            LeaderboardEntry(
                rank=idx + 1,
                display_name=display_name,
                total_points=profile.total_points,
                measurement_count=period_count,
                level=profile.level,
                level_name=get_level_name(profile.level),
            )
            for idx, (profile, display_name, period_count) in enumerate(rows)
        ]

    return LeaderboardResponse(period=period, entries=entries)


@router.get("/badges", response_model=BadgeCatalogResponse)
async def get_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all badges with earned status for the current user."""
    # Fetch all badges
    all_badges_result = await db.execute(select(Badge).order_by(Badge.name))
    all_badges = all_badges_result.scalars().all()

    # Fetch earned badges for this user
    earned_result = await db.execute(
        select(UserBadge).where(UserBadge.user_id == current_user.id)
    )
    earned_map: dict = {
        ub.badge_id: ub.awarded_at for ub in earned_result.scalars().all()
    }

    items = [
        BadgeCatalogItem(
            code=badge.code,
            name=badge.name,
            description=badge.description,
            points_reward=badge.points_reward,
            earned=badge.id in earned_map,
            awarded_at=earned_map.get(badge.id),
        )
        for badge in all_badges
    ]

    return BadgeCatalogResponse(badges=items)
