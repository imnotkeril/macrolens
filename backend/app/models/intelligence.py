from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    Text,
    Boolean,
    JSON,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base

SCHEMA_CORE = "memory_core"
SCHEMA_MACRO = "memory_macro"
SCHEMA_REGIMES = "memory_market_regimes"
SCHEMA_FED = "memory_fed_cb"
SCHEMA_YIELD = "memory_yield_curve"
SCHEMA_NAV = "memory_trading_navigator"
SCHEMA_DECISIONS = "memory_decisions"
SCHEMA_ML = "memory_ml_snapshots"
SCHEMA_NEWS = "memory_news_events"
SCHEMA_OBS = "memory_observability"


class ML2FactorScore(Base):
    __tablename__ = "ml2_factor_scores"
    __table_args__ = (
        UniqueConstraint("date", "factor_name", "horizon_months", name="uq_ml2_factor_score"),
        {"schema": SCHEMA_ML},
    )

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    factor_name = Column(String(64), nullable=False, index=True)
    horizon_months = Column(Integer, nullable=False, default=1)
    score = Column(Float, nullable=False)
    expected_relative_return = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    model_version = Column(String(64), nullable=False, default="ml2-v1")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ML2AnomalySignal(Base):
    __tablename__ = "ml2_anomaly_signals"
    __table_args__ = ({"schema": SCHEMA_ML},)

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True, unique=True)
    anomaly_score = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False, default=0.0)
    is_anomaly = Column(Boolean, nullable=False, default=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentRun(Base):
    __tablename__ = "agent_runs"
    __table_args__ = ({"schema": SCHEMA_OBS},)

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String(64), nullable=False, index=True)
    run_key = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="completed")
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    signals = relationship("AgentSignal", back_populates="run", cascade="all, delete-orphan")


class AgentSignal(Base):
    __tablename__ = "agent_signals"
    __table_args__ = (
        UniqueConstraint("agent_name", "signal_date", "signal_type", name="uq_agent_signal"),
        {"schema": SCHEMA_OBS},
    )

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey(f"{SCHEMA_OBS}.agent_runs.id"), nullable=True)
    agent_name = Column(String(64), nullable=False, index=True)
    signal_date = Column(Date, nullable=False, index=True)
    signal_type = Column(String(64), nullable=False, index=True)
    score = Column(Float, nullable=True)
    summary = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run = relationship("AgentRun", back_populates="signals")


class DailyBrief(Base):
    __tablename__ = "daily_briefs"
    __table_args__ = (
        UniqueConstraint("brief_date", "source", name="uq_daily_brief"),
        {"schema": SCHEMA_NEWS},
    )

    id = Column(Integer, primary_key=True, index=True)
    brief_date = Column(Date, nullable=False, index=True)
    source = Column(String(64), nullable=False, default="news_agent")
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, nullable=True)
    importance = Column(String(16), nullable=False, default="medium")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = ({"schema": SCHEMA_DECISIONS},)

    id = Column(Integer, primary_key=True, index=True)
    rec_date = Column(Date, nullable=False, index=True)
    regime = Column(String(64), nullable=False)
    macro_thesis = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    uncertainty = Column(Float, nullable=False, default=1.0)
    no_trade = Column(Boolean, nullable=False, default=False)
    reason_codes = Column(JSON, nullable=True)
    risk_constraints = Column(JSON, nullable=True)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MemoryDocument(Base):
    __tablename__ = "documents"
    __table_args__ = ({"schema": SCHEMA_CORE},)

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(64), nullable=False, index=True)
    doc_key = Column(String(128), nullable=False, index=True, unique=True)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chunks = relationship("MemoryChunk", back_populates="document", cascade="all, delete-orphan")


class MemoryChunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_memory_chunk"),
        {"schema": SCHEMA_CORE},
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey(f"{SCHEMA_CORE}.documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("MemoryDocument", back_populates="chunks")
    embedding = relationship("MemoryEmbedding", back_populates="chunk", uselist=False, cascade="all, delete-orphan")


class MemoryEmbedding(Base):
    __tablename__ = "embeddings"
    __table_args__ = ({"schema": SCHEMA_CORE},)

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey(f"{SCHEMA_CORE}.chunks.id"), nullable=False, unique=True)
    model = Column(String(64), nullable=False, default="hash-embedding-v1")
    vector = Column(JSON, nullable=False)
    norm = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chunk = relationship("MemoryChunk", back_populates="embedding")


class MemoryLink(Base):
    __tablename__ = "links"
    __table_args__ = (
        UniqueConstraint("src_doc_id", "dst_doc_id", "relation", name="uq_memory_link"),
        {"schema": SCHEMA_CORE},
    )

    id = Column(Integer, primary_key=True, index=True)
    src_doc_id = Column(Integer, ForeignKey(f"{SCHEMA_CORE}.documents.id"), nullable=False, index=True)
    dst_doc_id = Column(Integer, ForeignKey(f"{SCHEMA_CORE}.documents.id"), nullable=False, index=True)
    relation = Column(String(64), nullable=False)
    weight = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MemoryTag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("doc_id", "tag", name="uq_memory_tag"),
        {"schema": SCHEMA_CORE},
    )

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(Integer, ForeignKey(f"{SCHEMA_CORE}.documents.id"), nullable=False, index=True)
    tag = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MemorySourceRegistry(Base):
    __tablename__ = "source_registry"
    __table_args__ = (
        UniqueConstraint("source_name", "source_key", name="uq_memory_source_registry"),
        {"schema": SCHEMA_CORE},
    )

    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(64), nullable=False, index=True)
    source_key = Column(String(128), nullable=False, index=True)
    source_version = Column(String(64), nullable=True)
    quality_score = Column(Float, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DashboardRadarSnapshot(Base):
    __tablename__ = "dashboard_radar_snapshots"
    __table_args__ = (
        UniqueConstraint("snapshot_key", name="uq_dashboard_radar_snapshot"),
        {"schema": SCHEMA_NAV},
    )

    id = Column(Integer, primary_key=True, index=True)
    snapshot_key = Column(String(128), nullable=False, index=True)
    event_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    as_of_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source = Column(String(64), nullable=False, default="dashboard_pipeline")
    source_id = Column(String(128), nullable=True)
    source_version = Column(String(64), nullable=True)
    model_version = Column(String(64), nullable=True)
    payload_json = Column(JSON, nullable=False)
    quality_score = Column(Float, nullable=True, default=1.0)
    provenance_links = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AnalysisIndicatorsSnapshot(Base):
    __tablename__ = "analysis_indicators_snapshots"
    __table_args__ = (
        UniqueConstraint("snapshot_key", name="uq_analysis_indicators_snapshot"),
        {"schema": SCHEMA_MACRO},
    )

    id = Column(Integer, primary_key=True, index=True)
    snapshot_key = Column(String(128), nullable=False, index=True)
    event_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    as_of_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source = Column(String(64), nullable=False, default="analysis_pipeline")
    source_id = Column(String(128), nullable=True)
    source_version = Column(String(64), nullable=True)
    model_version = Column(String(64), nullable=True)
    payload_json = Column(JSON, nullable=False)
    quality_score = Column(Float, nullable=True, default=1.0)
    provenance_links = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MemoryPipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = ({"schema": SCHEMA_OBS},)

    id = Column(Integer, primary_key=True, index=True)
    pipeline_name = Column(String(64), nullable=False, index=True)
    run_key = Column(String(128), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="running")
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    rows_written = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)


class RetrievalTrace(Base):
    __tablename__ = "retrieval_traces"
    __table_args__ = ({"schema": SCHEMA_OBS},)

    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    domain_filter = Column(String(64), nullable=True)
    top_k = Column(Integer, nullable=False, default=5)
    latency_ms = Column(Integer, nullable=True)
    hit_count = Column(Integer, nullable=False, default=0)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

