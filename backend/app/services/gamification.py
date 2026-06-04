import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, literal, distinct

from app.models.gamification import GamificationProfile, Badge, UserBadge, BUCHAREST_SECTOR_WKTS
from app.models.measurement import Measurement

# Level thresholds: level -> minimum points required
LEVEL_THRESHOLDS = {
    1: 0,
    2: 100,
    3: 300,
    4: 600,
    5: 1000,
}

LEVEL_NAMES = {
    1: "New Observer",
    2: "City Listener",
    3: "Noise Mapper",
    4: "Urban Guardian",
    5: "Expert Contributor",
}

BUCHAREST_TZ = ZoneInfo("Europe/Bucharest")


def compute_level(total_points: int) -> int:
    """Return the level corresponding to a given total_points value."""
    level = 1
    for lvl, threshold in sorted(LEVEL_THRESHOLDS.items(), reverse=True):
        if total_points >= threshold:
            level = lvl
            break
    return level


def get_level_name(level: int) -> str:
    return LEVEL_NAMES.get(level, "Expert Contributor")


async def _already_awarded(db: AsyncSession, user_id: uuid.UUID, badge_id: uuid.UUID) -> bool:
    """Return True if the user already has this badge."""
    result = await db.execute(
        select(UserBadge).where(
            UserBadge.user_id == user_id,
            UserBadge.badge_id == badge_id,
        )
    )
    return result.scalar_one_or_none() is not None


class GamificationService:

    async def award_points(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        measurement: Measurement,
    ) -> int:
        """
        Calculate and award points for a submitted measurement.

        Point rules:
        - +10 for a valid measurement
        - +5 bonus if gps_accuracy < 20
        - +20 bonus if this is the user's first measurement today
        - +15 bonus if the area is under-sampled (< 5 valid measurements within ~500m in last 7 days)
        - +50 bonus when streak first reaches a multiple of 7

        Also updates streak, level, and checks for badge awards.

        Returns the number of points awarded in this call.
        """
        # Load or create gamification profile
        result = await db.execute(
            select(GamificationProfile).where(GamificationProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()

        if profile is None:
            profile = GamificationProfile(user_id=user_id)
            db.add(profile)
            await db.flush()

        points_earned = 0

        # Base points for valid measurement
        if measurement.quality_flag == "valid":
            points_earned += 10

            # Bonus for high GPS accuracy
            if measurement.gps_accuracy is not None and measurement.gps_accuracy < 20:
                points_earned += 5

            # Bonus for under-sampled area: < 5 valid measurements within ~500m in last 7 days
            if measurement.geom is not None:
                lat = measurement.latitude
                lon = measurement.longitude
                seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
                area_count_result = await db.execute(
                    select(func.count(Measurement.id)).where(
                        Measurement.quality_flag == "valid",
                        Measurement.timestamp >= seven_days_ago,
                        func.ST_DWithin(
                            Measurement.geom,
                            func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                            0.005,
                        ),
                    )
                )
                area_count = area_count_result.scalar_one()
                # area_count includes the current measurement if already flushed
                if area_count < 5:
                    points_earned += 15

        # Count total measurements before this one (include current to detect first)
        count_result = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id
            )
        )
        total_measurements = count_result.scalar_one()

        # Check if this is first measurement of the day (in UTC)
        today = datetime.now(timezone.utc).date()
        daily_result = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id,
                func.date(Measurement.timestamp) == today,
            )
        )
        measurements_today = daily_result.scalar_one()

        # measurements_today includes the current one (already flushed), so == 1 means first today
        if measurements_today <= 1:
            points_earned += 20

        # Update streak
        last_date = profile.last_contribution_date
        streak_before = profile.current_streak
        if last_date is None:
            profile.current_streak = 1
        elif last_date == today:
            # Already contributed today, no streak change
            pass
        elif (today - last_date).days == 1:
            # Consecutive day
            profile.current_streak += 1
        else:
            # Streak broken
            profile.current_streak = 1

        profile.last_contribution_date = today
        if profile.current_streak > profile.longest_streak:
            profile.longest_streak = profile.current_streak

        # Streak milestone bonus: +50 when streak first reaches a multiple of 7
        new_streak = profile.current_streak
        if new_streak > 0 and new_streak % 7 == 0 and new_streak != streak_before:
            points_earned += 50

        # Apply points
        profile.total_points += points_earned
        profile.level = compute_level(profile.total_points)

        # Check and award badges
        await self._check_badges(db, user_id, profile, total_measurements)

        await db.flush()
        return points_earned

    async def _check_badges(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        profile: GamificationProfile,
        measurement_count_before: int,
    ) -> None:
        """Award any badges the user has newly earned."""

        # Helper to fetch badge by code
        async def get_badge(code: str) -> Badge | None:
            res = await db.execute(select(Badge).where(Badge.code == code))
            return res.scalar_one_or_none()

        async def award_badge(badge: Badge) -> None:
            if await _already_awarded(db, user_id, badge.id):
                return
            user_badge = UserBadge(
                user_id=user_id,
                badge_id=badge.id,
                awarded_at=datetime.now(timezone.utc),
            )
            db.add(user_badge)
            profile.total_points += badge.points_reward
            profile.level = compute_level(profile.total_points)
            await db.flush()

        # ── first_measurement ────────────────────────────────────────────────
        if measurement_count_before == 0:
            badge = await get_badge("first_measurement")
            if badge:
                await award_badge(badge)

        # ── measurements_10 ──────────────────────────────────────────────────
        if measurement_count_before < 10:
            count_res = await db.execute(
                select(func.count(Measurement.id)).where(
                    Measurement.user_id == user_id,
                    Measurement.quality_flag == "valid",
                )
            )
            if count_res.scalar_one() >= 10:
                badge = await get_badge("measurements_10")
                if badge:
                    await award_badge(badge)

        # ── measurements_100 ─────────────────────────────────────────────────
        if measurement_count_before < 100:
            count_res = await db.execute(
                select(func.count(Measurement.id)).where(
                    Measurement.user_id == user_id,
                    Measurement.quality_flag == "valid",
                )
            )
            if count_res.scalar_one() >= 100:
                badge = await get_badge("measurements_100")
                if badge:
                    await award_badge(badge)

        # ── streak_7 ─────────────────────────────────────────────────────────
        if profile.longest_streak >= 7:
            badge = await get_badge("streak_7")
            if badge:
                await award_badge(badge)

        # ── streak_30 ────────────────────────────────────────────────────────
        if profile.longest_streak >= 30:
            badge = await get_badge("streak_30")
            if badge:
                await award_badge(badge)

        # ── high_accuracy ────────────────────────────────────────────────────
        acc_res = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id,
                Measurement.quality_flag == "valid",
                Measurement.gps_accuracy < 20,
            )
        )
        if acc_res.scalar_one() >= 20:
            badge = await get_badge("high_accuracy")
            if badge:
                await award_badge(badge)

        # ── district_mapper ──────────────────────────────────────────────────
        # Build a CASE expression that maps each measurement's geom to a sector id (1-6)
        sector_case = case(
            *[
                (
                    func.ST_Within(
                        Measurement.geom,
                        func.ST_GeomFromText(wkt, 4326),
                    ),
                    literal(sector_id),
                )
                for sector_id, wkt in BUCHAREST_SECTOR_WKTS.items()
            ],
            else_=None,
        )
        district_res = await db.execute(
            select(func.count(distinct(sector_case))).where(
                Measurement.user_id == user_id,
                Measurement.quality_flag == "valid",
                Measurement.geom.isnot(None),
            )
        )
        distinct_sectors = district_res.scalar_one() or 0
        if distinct_sectors >= 6:
            badge = await get_badge("district_mapper")
            if badge:
                await award_badge(badge)

        # ── weekend_contributor ──────────────────────────────────────────────
        # DOW: 0 = Sunday, 6 = Saturday in PostgreSQL EXTRACT(DOW ...)
        weekend_res = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id,
                Measurement.quality_flag == "valid",
                func.extract(
                    "dow",
                    func.timezone("Europe/Bucharest", Measurement.timestamp),
                ).in_([0, 6]),
            )
        )
        if weekend_res.scalar_one() >= 5:
            badge = await get_badge("weekend_contributor")
            if badge:
                await award_badge(badge)

        # ── night_contributor ────────────────────────────────────────────────
        # Night: 22:00–23:59 or 00:00–05:59 Bucharest time
        night_res = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id,
                Measurement.quality_flag == "valid",
                (
                    func.extract(
                        "hour",
                        func.timezone("Europe/Bucharest", Measurement.timestamp),
                    ) >= 22
                )
                | (
                    func.extract(
                        "hour",
                        func.timezone("Europe/Bucharest", Measurement.timestamp),
                    ) < 6
                ),
            )
        )
        if night_res.scalar_one() >= 5:
            badge = await get_badge("night_contributor")
            if badge:
                await award_badge(badge)

        # ── community_champion ───────────────────────────────────────────────
        champ_count_res = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id,
                Measurement.quality_flag == "valid",
            )
        )
        if champ_count_res.scalar_one() >= 50 and profile.longest_streak >= 7:
            badge = await get_badge("community_champion")
            if badge:
                await award_badge(badge)

        await db.flush()


gamification_service = GamificationService()
