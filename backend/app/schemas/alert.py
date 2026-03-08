from datetime import datetime
from pydantic import BaseModel

from app.models.alert import AlertSeverity, AlertType


class AlertResponse(BaseModel):
    id: int
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertCount(BaseModel):
    total: int
    unread: int
    critical: int
