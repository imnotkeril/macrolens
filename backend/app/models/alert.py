import enum
from datetime import datetime

from sqlalchemy import Integer, String, DateTime, Enum, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, enum.Enum):
    QUADRANT_TRANSITION = "quadrant_transition"
    INDICATOR_SURPRISE = "indicator_surprise"
    YIELD_CURVE_INVERSION = "yield_curve_inversion"
    RECESSION_THRESHOLD = "recession_threshold"
    VIX_SPIKE = "vix_spike"
    FED_RATE_CHANGE = "fed_rate_change"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
