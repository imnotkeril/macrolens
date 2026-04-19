"""Fetch recent messages from whitelisted Telegram channels into memory_news (memory_core source=news)."""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.memory_service import MemoryService

logger = logging.getLogger(__name__)


def _whitelist_channels(raw: str) -> list[str]:
    return [x.strip() for x in (raw or "").split(",") if x.strip()]


async def ingest_telegram_whitelist(
    db: AsyncSession,
    *,
    as_of: date,
    max_messages_per_channel: int = 80,
    source_version: str = "telegram-v1",
) -> int:
    settings = get_settings()
    if not settings.telegram_ingestion_enabled:
        return 0
    if not settings.telegram_api_id or not settings.telegram_api_hash:
        logger.warning("Telegram ingestion enabled but API_ID/API_HASH missing")
        return 0
    channels = _whitelist_channels(settings.telegram_channel_whitelist)
    if not channels:
        logger.warning("Telegram ingestion enabled but TELEGRAM_CHANNEL_WHITELIST empty")
        return 0

    try:
        from telethon import TelegramClient
    except ImportError:
        logger.warning("telethon not installed")
        return 0

    session = (settings.telegram_session_path or "data/telegram_news_session").strip()
    memory = MemoryService()
    written = 0
    client = TelegramClient(session, int(settings.telegram_api_id), settings.telegram_api_hash)

    await client.connect()
    if not await client.is_user_authorized():
        if settings.telegram_bot_token:
            await client.start(bot_token=settings.telegram_bot_token)
        else:
            logger.warning("Telegram client not authorized; provide session file or TELEGRAM_BOT_TOKEN")
            await client.disconnect()
            return 0

    try:
        lim = min(max(1, int(settings.telegram_ingest_max_messages)), max_messages_per_channel)
        for ch in channels:
            try:
                entity = await client.get_entity(ch)
            except Exception as e:
                logger.warning("Telegram get_entity %s: %s", ch, e)
                continue
            async for message in client.iter_messages(entity, limit=lim):
                if not message or not message.id:
                    continue
                text = (message.message or "").strip()
                if len(text) < 12:
                    continue
                if message.date:
                    msg_dt = message.date
                    if msg_dt.tzinfo is None:
                        msg_dt = msg_dt.replace(tzinfo=timezone.utc)
                    if msg_dt.date() > as_of:
                        continue
                cid = getattr(entity, "id", None) or hash(ch) % 10_000_000
                doc_key = f"telegram:{cid}:{message.id}"
                title = (text[:120].replace("\n", " ") + "…") if len(text) > 120 else text.replace("\n", " ")
                safe = re.sub(r"\s+", " ", text)[:8000]
                h = hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]
                await memory.upsert_document(
                    db,
                    source="news",
                    doc_key=doc_key,
                    title=title,
                    content=safe,
                    metadata={
                        "quality_score": 0.75,
                        "source_version": source_version,
                        "channel": ch,
                        "message_id": message.id,
                        "text_hash": h,
                        "message_date": message.date.isoformat() if message.date else None,
                        "as_of_date": as_of.isoformat(),
                    },
                    tags=["news", "telegram"],
                )
                written += 1
    finally:
        await client.disconnect()

    if written:
        logger.info("Telegram ingestion wrote %s memory documents (as_of=%s)", written, as_of)
    return written
