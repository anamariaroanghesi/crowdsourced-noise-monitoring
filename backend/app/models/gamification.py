import uuid
from datetime import datetime, date

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GamificationProfile(Base):
    __tablename__ = "gamification_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_contribution_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="gamification_profile")


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    points_reward: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    user_badges: Mapped[list["UserBadge"]] = relationship("UserBadge", back_populates="badge")


class UserBadge(Base):
    __tablename__ = "user_badges"

    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False
    )
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="user_badges")
    badge: Mapped["Badge"] = relationship("Badge", back_populates="user_badges")


# Badge seed data — used during startup
BADGE_SEEDS = [
    {"code": "first_measurement", "name": "First Steps", "description": "Submitted your very first noise measurement.", "points_reward": 20},
    {"code": "measurements_10", "name": "Noise Spotter", "description": "Submitted 10 valid noise measurements.", "points_reward": 50},
    {"code": "measurements_100", "name": "City Ear", "description": "Submitted 100 valid noise measurements.", "points_reward": 200},
    {"code": "streak_7", "name": "Week Warrior", "description": "Contributed for 7 consecutive days.", "points_reward": 50},
    {"code": "streak_30", "name": "Iron Listener", "description": "Contributed for 30 consecutive days.", "points_reward": 150},
    {"code": "high_accuracy", "name": "Precision Mapper", "description": "Made 20 measurements with GPS accuracy under 20 m.", "points_reward": 75},
    {"code": "district_mapper", "name": "District Explorer", "description": "Measured noise in all 6 Bucharest sectors.", "points_reward": 100},
    {"code": "weekend_contributor", "name": "Weekend Warrior", "description": "Submitted 5 measurements on weekends.", "points_reward": 50},
    {"code": "night_contributor", "name": "Night Owl", "description": "Submitted 5 measurements between 22:00 and 06:00.", "points_reward": 50},
    {"code": "community_champion", "name": "Community Champion", "description": "Submitted 50+ measurements and maintained a 7-day streak.", "points_reward": 200},
]

# Approximate Bucharest sector polygons (WGS84).
# These are simplified boundaries used for the District Mapper badge.
BUCHAREST_SECTOR_WKTS: dict[int, str] = {
    1: "POLYGON((25.9610 44.4440, 26.1100 44.4440, 26.1100 44.5600, 25.9610 44.5600, 25.9610 44.4440))",
    2: "POLYGON((26.1100 44.4340, 26.2500 44.4340, 26.2500 44.5600, 26.1100 44.5600, 26.1100 44.4340))",
    3: "POLYGON((26.0700 44.3850, 26.2500 44.3850, 26.2500 44.4340, 26.0700 44.4340, 26.0700 44.3850))",
    4: "POLYGON((25.9700 44.3700, 26.0700 44.3700, 26.0700 44.4100, 25.9700 44.4100, 25.9700 44.3700))",
    5: "POLYGON((25.8800 44.3700, 25.9700 44.3700, 25.9700 44.4600, 25.8800 44.4600, 25.8800 44.3700))",
    6: "POLYGON((25.9610 44.3950, 26.0700 44.3950, 26.0700 44.4440, 25.9610 44.4440, 25.9610 44.3950))",
}
