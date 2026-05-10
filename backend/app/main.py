from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.database import engine, Base, AsyncSessionLocal
from app.models import User, Device, Measurement, GamificationProfile, Badge, UserBadge  # noqa: F401 — ensure all models are registered with Base
from app.models.gamification import BADGE_SEEDS
from app.routers import auth, measurements, map, gamification


async def _seed_badges() -> None:
    """Insert default badge definitions if they do not already exist."""
    async with AsyncSessionLocal() as session:
        for seed in BADGE_SEEDS:
            result = await session.execute(
                select(Badge).where(Badge.code == seed["code"])
            )
            if result.scalar_one_or_none() is None:
                badge = Badge(**seed)
                session.add(badge)
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed badge data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_badges()
    yield
    # Shutdown: dispose connection pool
    await engine.dispose()


app = FastAPI(
    title="Noise Monitoring API",
    description="Crowdsourced noise-pollution monitoring platform for Bucharest",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — each router already declares its own prefix inside the module
app.include_router(auth.router)
app.include_router(measurements.router)
app.include_router(map.router)
app.include_router(gamification.router)


@app.get("/health", tags=["health"])
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
