import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.gamification import GamificationProfile, Badge, UserBadge
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
            if measurement.gps_accuracy < 20:
                points_earned += 5

        # Count total measurements before this one
        count_result = await db.execute(
            select(func.count(Measurement.id)).where(
                Measurement.user_id == user_id
            )
        )
        total_measurements = count_result.scalar_one()

        # Check if this is first measurement of the day
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
        badges_to_check = []

        # first_measurement: awarded on the very first measurement (count was 0 before this one)
        if measurement_count_before == 0:
            badges_to_check.append("first_measurement")

        # measurements_10: crossing 10 total
        if measurement_count_before < 10:
            badges_to_check.append("measurements_10")

        # measurements_100: crossing 100 total
        if measurement_count_before < 100:
            badges_to_check.append("measurements_100")

        for badge_code in badges_to_check:
            # Determine whether the threshold has actually been crossed now
            count_result = await db.execute(
                select(func.count(Measurement.id)).where(
                    Measurement.user_id == user_id
                )
            )
            current_count = count_result.scalar_one()

            threshold_map = {
                "first_measurement": 1,
                "measurements_10": 10,
                "measurements_100": 100,
            }
            threshold = threshold_map.get(badge_code, 0)
            if current_count < threshold:
                continue

            # Fetch the badge record
            badge_result = await db.execute(
                select(Badge).where(Badge.code == badge_code)
            )
            badge = badge_result.scalar_one_or_none()
            if badge is None:
                continue

            # Check if already awarded
            existing_result = await db.execute(
                select(UserBadge).where(
                    UserBadge.user_id == user_id,
                    UserBadge.badge_id == badge.id,
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing is not None:
                continue

            # Award the badge
            user_badge = UserBadge(
                user_id=user_id,
                badge_id=badge.id,
                awarded_at=datetime.now(timezone.utc),
            )
            db.add(user_badge)

            # Add badge points to profile
            profile.total_points += badge.points_reward
            profile.level = compute_level(profile.total_points)

        await db.flush()


gamification_service = GamificationService()
