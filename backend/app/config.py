from pydantic_settings import BaseSettings
from typing import Tuple


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/noise_monitoring"
    SECRET_KEY: str = "dev-secret-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"
    BUCHAREST_BBOX: Tuple[float, float, float, float] = (25.9, 44.3, 26.3, 44.6)  # (min_lon, min_lat, max_lon, max_lat)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
