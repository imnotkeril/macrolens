from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://macrolens:macrolens_secret@localhost:5432/macrolens"
    redis_url: str = "redis://localhost:6379/0"
    fred_api_key: str = ""

    # FRED API limits: 120 requests/min
    fred_rate_limit: int = 120
    historical_years: int = 10

    # ML regime prediction: dataset and artifacts paths (relative to backend root or absolute)
    ml_dataset_path: str = "data/ml_navigator_dataset.parquet"
    ml_artifacts_dir: str = "data/ml_artifacts"
    ml_train_progress_file: str = "data/ml_train_progress.json"
    # Max years of history to build (fewer = faster first run; 5 ≈ 1–2 min)
    ml_dataset_max_years: int = 5
    # Temporal split boundaries (YYYY-MM); test is from val_end+1 to latest
    ml_train_end: str = "2018-12"
    ml_val_end: str = "2021-12"
    ml_random_seed: int = 42

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
