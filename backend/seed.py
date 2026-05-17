#!/usr/bin/env python3
"""
Seed the database with realistic test users and noise measurements for Bucharest.

Usage (inside Docker container):
    docker exec disertatie-backend-1 python seed.py

Usage (locally, from project root):
    cd backend && python seed.py
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone, date

# Allow running from repo root or from backend/
sys.path.insert(0, os.path.dirname(__file__))

from geoalchemy2 import WKTElement
from sqlalchemy import select, func

from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.models.device import Device
from app.models.measurement import Measurement
from app.models.gamification import GamificationProfile, Badge, UserBadge, BADGE_SEEDS
from app.utils.security import hash_password
from app.services.gamification import compute_level

# ── Bucharest locations (name, lat, lon, typical_db_range) ──────────────────

LOCATIONS = [
    ("Piața Unirii",        44.4268, 26.1025, 65, 80),
    ("Centrul Vechi",       44.4316, 26.1001, 58, 85),
    ("Calea Victoriei",     44.4428, 26.0959, 60, 75),
    ("Gara de Nord",        44.4452, 26.0822, 65, 85),
    ("Obor",                44.4508, 26.1073, 62, 80),
    ("Băneasa – Aeroport",  44.5017, 26.1024, 70, 90),
    ("Floreasca",           44.4656, 26.0956, 48, 65),
    ("Herăstrău Park",      44.4694, 26.0823, 35, 52),
    ("Pipera – Business",   44.5038, 26.1171, 55, 70),
    ("Militari",            44.4432, 26.0479, 50, 65),
    ("Drumul Taberei",      44.4210, 26.0436, 48, 63),
    ("Titan / IOR Park",    44.4253, 26.1656, 50, 70),
    ("Pantelimon",          44.4493, 26.1787, 60, 75),
    ("Berceni",             44.3882, 26.1113, 44, 60),
    ("Tineretului Park",    44.4118, 26.0988, 38, 54),
    ("Rahova",              44.4021, 26.0618, 55, 70),
    ("Colentina",           44.4601, 26.1401, 55, 72),
    ("Dristor",             44.4189, 26.1256, 58, 73),
]

# ── Test users ───────────────────────────────────────────────────────────────

TEST_USERS = [
    {
        "email": "alice@test.com",
        "password": "testpass123",
        "display_name": "Alice M.",
        "role": "user",
        "measurement_count": 52,   # power user → crosses 10 and 100 would need 100, stops at 52
        "platform": "android",
        "model": "Samsung Galaxy S23",
    },
    {
        "email": "bob@test.com",
        "password": "testpass123",
        "display_name": "Bob T.",
        "role": "user",
        "measurement_count": 21,
        "platform": "ios",
        "model": "iPhone 14",
    },
    {
        "email": "carol@test.com",
        "password": "testpass123",
        "display_name": "Carol D.",
        "role": "user",
        "measurement_count": 5,
        "platform": "android",
        "model": "Pixel 7",
    },
    {
        "email": "demo@test.com",
        "password": "testpass123",
        "display_name": "Demo User",
        "role": "user",
        "measurement_count": 14,
        "platform": "ios",
        "model": "iPhone 13 Mini",
    },
    {
        "email": "admin@test.com",
        "password": "adminpass123",
        "display_name": "Admin",
        "role": "admin",
        "measurement_count": 8,
        "platform": "android",
        "model": "Pixel 6a",
    },
]

BADGE_THRESHOLDS = {
    "first_measurement": 1,
    "measurements_10": 10,
    "measurements_100": 100,
}


def jitter(lat: float, lon: float, radius_deg: float = 0.005) -> tuple[float, float]:
    """Add small random offset to avoid all points stacking on one spot."""
    return (
        lat + random.uniform(-radius_deg, radius_deg),
        lon + random.uniform(-radius_deg, radius_deg),
    )


def random_timestamp(days_back: int, days_range: int = 1) -> datetime:
    """Return a random UTC datetime within a day window, days_back days ago."""
    base = datetime.now(timezone.utc) - timedelta(days=days_back)
    offset_hours = random.uniform(7, 22)  # only daytime measurements
    return base.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=offset_hours)


def make_measurement(user_id, device_id, ts: datetime, quality_flag: str = "valid") -> Measurement:
    loc = random.choice(LOCATIONS)
    _name, base_lat, base_lon, db_min, db_max = loc
    lat, lon = jitter(base_lat, base_lon)

    if quality_flag == "valid":
        db_val = round(random.uniform(db_min, db_max), 1)
        accuracy = round(random.uniform(3.0, 45.0), 1)
    elif quality_flag == "low_accuracy":
        db_val = round(random.uniform(db_min, db_max), 1)
        accuracy = round(random.uniform(101.0, 200.0), 1)  # fails GPS accuracy check
    else:  # out_of_range
        db_val = round(random.uniform(1.0, 19.0), 1)  # too quiet → invalid
        accuracy = round(random.uniform(3.0, 20.0), 1)

    calibrated = round(db_val + random.uniform(-1.5, 1.5), 1)

    return Measurement(
        user_id=user_id,
        device_id=device_id,
        measured_db=db_val,
        calibrated_db=calibrated,
        latitude=lat,
        longitude=lon,
        gps_accuracy=accuracy,
        timestamp=ts,
        duration_seconds=round(random.uniform(10.0, 60.0), 1),
        quality_flag=quality_flag,
        geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
    )


def compute_profile(measurements: list[Measurement]) -> dict:
    """Derive gamification profile values from a list of measurements."""
    valid = [m for m in measurements if m.quality_flag == "valid"]
    total_points = 0

    # +10 per valid, +5 if gps_accuracy < 20
    for m in valid:
        total_points += 10
        if m.gps_accuracy < 20:
            total_points += 5

    # +20 for first measurement each calendar day
    days_seen: set[date] = set()
    for m in sorted(valid, key=lambda m: m.timestamp):
        d = m.timestamp.date()
        if d not in days_seen:
            total_points += 20
            days_seen.add(d)

    # Streak calculation
    sorted_dates = sorted(days_seen)
    if not sorted_dates:
        streak = 0
        longest = 0
        last_date = None
    else:
        streak = 1
        longest = 1
        current = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                current += 1
                longest = max(longest, current)
            else:
                current = 1
        streak = current
        longest = longest
        last_date = sorted_dates[-1]

    return {
        "total_points": total_points,
        "level": compute_level(total_points),
        "current_streak": streak,
        "longest_streak": longest,
        "last_contribution_date": last_date,
    }


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Seed badges (same as lifespan)
        for seed_data in BADGE_SEEDS:
            result = await session.execute(select(Badge).where(Badge.code == seed_data["code"]))
            if result.scalar_one_or_none() is None:
                session.add(Badge(**seed_data))
        await session.commit()

        # Load badge records
        badge_rows = (await session.execute(select(Badge))).scalars().all()
        badge_map = {b.code: b for b in badge_rows}

        created_users = 0
        created_measurements = 0

        for u_spec in TEST_USERS:
            # Skip if user already exists
            result = await session.execute(select(User).where(User.email == u_spec["email"]))
            user = result.scalar_one_or_none()

            if user is None:
                user = User(
                    email=u_spec["email"],
                    password_hash=hash_password(u_spec["password"]),
                    display_name=u_spec["display_name"],
                    role=u_spec["role"],
                )
                session.add(user)
                await session.flush()
                created_users += 1
                print(f"  + Created user: {u_spec['email']}")
            else:
                print(f"  ~ Skipped existing user: {u_spec['email']}")

            # Device
            device_result = await session.execute(
                select(Device).where(Device.user_id == user.id)
            )
            device = device_result.scalars().first()
            if device is None:
                device = Device(
                    user_id=user.id,
                    platform=u_spec["platform"],
                    model=u_spec["model"],
                    os_version="14.0",
                    app_version="1.0.0",
                    calibration_offset=0.0,
                )
                session.add(device)
                await session.flush()

            # Measurements — check how many already exist
            count_result = await session.execute(
                select(func.count(Measurement.id)).where(Measurement.user_id == user.id)
            )
            existing_count = count_result.scalar_one()
            to_create = u_spec["measurement_count"] - existing_count

            if to_create <= 0:
                print(f"    ~ Already has {existing_count} measurements, skipping")
            else:
                measurements: list[Measurement] = []
                total = u_spec["measurement_count"]

                # Spread measurements over the past 7 days
                for i in range(to_create):
                    days_ago = random.randint(0, 6)
                    ts = random_timestamp(days_ago)

                    # ~10% of measurements are invalid (quality filters)
                    roll = random.random()
                    if roll < 0.06:
                        flag = "low_accuracy"
                    elif roll < 0.10:
                        flag = "out_of_range"
                    else:
                        flag = "valid"

                    m = make_measurement(user.id, device.id, ts, flag)
                    session.add(m)
                    measurements.append(m)

                await session.flush()

                # Also pull existing measurements to compute correct profile
                all_m_result = await session.execute(
                    select(Measurement).where(Measurement.user_id == user.id)
                )
                all_measurements = all_m_result.scalars().all()

                profile_vals = compute_profile(list(all_measurements))
                created_measurements += to_create
                print(f"    + {to_create} measurements → {profile_vals['total_points']} pts, level {profile_vals['level']}")

                # Upsert gamification profile
                gp_result = await session.execute(
                    select(GamificationProfile).where(GamificationProfile.user_id == user.id)
                )
                gp = gp_result.scalar_one_or_none()
                if gp is None:
                    gp = GamificationProfile(user_id=user.id, **profile_vals)
                    session.add(gp)
                else:
                    for k, v in profile_vals.items():
                        setattr(gp, k, v)

                await session.flush()

                # Award badges
                total_valid = sum(1 for m in all_measurements if m.quality_flag == "valid")
                for code, threshold in BADGE_THRESHOLDS.items():
                    if total_valid < threshold:
                        continue
                    badge = badge_map.get(code)
                    if badge is None:
                        continue
                    existing_badge = await session.execute(
                        select(UserBadge).where(
                            UserBadge.user_id == user.id,
                            UserBadge.badge_id == badge.id,
                        )
                    )
                    if existing_badge.scalar_one_or_none() is None:
                        session.add(UserBadge(user_id=user.id, badge_id=badge.id))
                        gp.total_points += badge.points_reward
                        gp.level = compute_level(gp.total_points)
                        print(f"    🏅 Awarded badge: {code}")

        await session.commit()
        print(f"\nDone. Created {created_users} users, {created_measurements} measurements.")
        print("\nTest credentials:")
        for u in TEST_USERS:
            print(f"  {u['email']}  /  {u['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
