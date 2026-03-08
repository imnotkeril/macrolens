from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update

from app.database import get_db
from app.models.alert import Alert, AlertSeverity
from app.schemas.alert import AlertResponse, AlertCount

router = APIRouter()


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    unread_only: bool = False,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if unread_only:
        query = query.where(Alert.is_read == False)  # noqa: E712
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count", response_model=AlertCount)
async def get_alert_count(db: AsyncSession = Depends(get_db)):
    total_q = select(func.count(Alert.id))
    unread_q = select(func.count(Alert.id)).where(Alert.is_read == False)  # noqa: E712
    critical_q = select(func.count(Alert.id)).where(
        Alert.is_read == False,  # noqa: E712
        Alert.severity == AlertSeverity.CRITICAL,
    )
    total = (await db.execute(total_q)).scalar() or 0
    unread = (await db.execute(unread_q)).scalar() or 0
    critical = (await db.execute(critical_q)).scalar() or 0
    return AlertCount(total=total, unread=unread, critical=critical)


@router.post("/{alert_id}/read")
async def mark_alert_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(update(Alert).where(Alert.id == alert_id).values(is_read=True))
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    await db.execute(update(Alert).where(Alert.is_read == False).values(is_read=True))  # noqa: E712
    await db.commit()
    return {"ok": True}
