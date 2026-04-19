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

    # Forecast Lab (isolated from legacy /api/ml and /api/ml2)
    forecast_lab_artifacts_dir: str = "data/forecast_lab_artifacts"
    forecast_lab_train_progress_file: str = "data/forecast_lab_train_progress.json"
    forecast_lab_enable_train_endpoint: bool = True
    forecast_lab_hmm_states: int = 4
    forecast_lab_random_seed: int = 42
    forecast_lab_date_from: str = "2008-01-01"
    forecast_lab_train_end: str = "2018-12"
    forecast_lab_val_end: str = "2021-12"
    # summary: use last completed month-end on or before requested as_of (aligns with monthly train grid)
    forecast_lab_summary_align_month_end: bool = False
    # rule_v1 | asset_implied_v1 — GBDT/HMM target; asset uses YAML pairs + MarketData
    forecast_lab_label_mode: str = "asset_implied_v1"
    # after POST /log-snapshot, also upsert MemoryDocument (forecast_lab source)
    forecast_lab_memory_ingest_enabled: bool = False
    # include CycleEngine + NavigatorEngine read-only context in GET /summary
    forecast_lab_include_dashboard_context: bool = True
    # GBDT sample_weight: 1 + auxiliary * pair-hit score (asset_implied_v1 only); 0 disables
    forecast_lab_auxiliary_asset_weight: float = 0.35
    # Fourth ensemble expert: Cycle Radar bucket → soft quadrant probs
    forecast_lab_ensemble_include_cycle: bool = True
    # Train binary XGB on forward 12m recession labels (recession_labels table)
    forecast_lab_train_recession_model: bool = True

    # Memory system
    memory_embedding_dim: int = 128
    memory_default_top_k: int = 5
    memory_min_quality_threshold: float = 0.0
    # auto: use OpenAI embeddings when OPENAI_API_KEY set, else hash fallback
    memory_embedding_backend: str = "auto"

    # LLM — Anthropic Claude (generation)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    llm_timeout_seconds: float = 120.0
    llm_max_retries: int = 2

    # OpenAI — embeddings only (memory retrieval)
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    embedding_timeout_seconds: float = 60.0

    # Telegram (Telethon) — optional news ingestion
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_bot_token: str = ""
    telegram_session_path: str = ""  # path to .session file inside container
    telegram_channel_whitelist: str = ""  # comma-separated @channel or numeric ids
    telegram_ingestion_enabled: bool = False
    telegram_ingest_max_messages: int = 80

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
