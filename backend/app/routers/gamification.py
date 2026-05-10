from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.gamification import GamificationProfile, UserBadge, Badge
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.gamification import (
    GamificationProfile as GamificationProfileSchema,
    BadgePublic,
    LeaderboardEntry,
    LeaderboardResponse,
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
    Return the top 20 users by total_points.

    Note: 'weekly' and 'monthly' currently return the same all-time leaderboard
    because per-period point accumulation is a Phase 2 feature.
    Only display_name is exposed (no email).
    """
    result = await db.execute(
        select(GamificationProfile, User.display_name)
        .join(User, GamificationProfile.user_id == User.id)
        .order_by(GamificationProfile.total_points.desc())
        .limit(20)
    )
    rows = result.all()

    entries = [
        LeaderboardEntry(
            rank=idx + 1,
            display_name=display_name,
            total_points=profile.total_points,
            level=profile.level,
            level_name=get_level_name(profile.level),
        )
        for idx, (profile, display_name) in enumerate(rows)
    ]

    return LeaderboardResponse(period=period, entries=entries)
