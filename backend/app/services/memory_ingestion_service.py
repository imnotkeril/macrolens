from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import (
    DashboardRadarSnapshot,
    AnalysisIndicatorsSnapshot,
    MemoryPipelineRun,
)
from app.services.memory_service import MemoryService
from app.services.cycle_engine import CycleEngine
from app.services.navigator_engine import NavigatorEngine
from app.services.market_service import MarketService
from app.services.fed_tracker import FedTracker
from app.services.inflation_service import InflationService
from app.models.indicator import Indicator, IndicatorValue
from sqlalchemy import select, desc
from app.models.fed_policy import FedRate
from app.models.market_data import YieldData
from app.models.intelligence import AgentSignal, Recommendation, ML2FactorScore, ML2AnomalySignal


class MemoryIngestionService:
    def __init__(self):
        self.memory = MemoryService()

    @staticmethod
    def _json_safe(value):
        return json.loads(json.dumps(value, ensure_ascii=False, default=str))

    async def _start_run(self, db: AsyncSession, pipeline_name: str, run_key: str) -> MemoryPipelineRun:
        run = MemoryPipelineRun(pipeline_name=pipeline_name, run_key=run_key, status="running")
        db.add(run)
        await db.flush()
        return run

    async def _finish_run(self, run: MemoryPipelineRun, rows_written: int, error: str | None = None) -> None:
        run.status = "failed" if error else "completed"
        run.rows_written = rows_written
        run.error = error
        run.finished_at = datetime.now(timezone.utc)

    async def snapshot_dashboard_radar(self, db: AsyncSession, source_version: str = "v1") -> dict:
        run_key = f"dashboard_radar:{datetime.now(timezone.utc).isoformat()}"
        run = await self._start_run(db, "dashboard_radar_snapshot", run_key)
        try:
            cycle = CycleEngine(db)
            nav = NavigatorEngine(db)
            market = MarketService(db)
            fed = FedTracker(db)
            infl = InflationService(db)

            regime = await cycle.get_current_snapshot()
            regime_history = await cycle.get_history(60)
            nav_rec = await nav.get_recommendation()
            nav_hist = await nav.get_historical_positions()
            nav_fwd = await nav.get_forward_positions()
            signals = await nav.get_cross_asset_signals()
            recession = await nav.get_recession_check()
            recession_bands = await market.get_recession_bands()
            radar = await market.get_cross_asset_radar()
            fed_status = await fed.get_current_status()
            yield_curve = await market.get_rates_dashboard(365 * 5)
            inflation_latest = await infl.get_all_inflation_latest()

            payload = {
                "regime_current": regime.model_dump() if hasattr(regime, "model_dump") else regime,
                "regime_history": [x.model_dump() if hasattr(x, "model_dump") else x for x in regime_history],
                "navigator_recommendation": nav_rec.model_dump() if hasattr(nav_rec, "model_dump") else nav_rec,
                "navigator_history": nav_hist,
                "navigator_forward": nav_fwd,
                "cross_asset_signals": [x.model_dump() if hasattr(x, "model_dump") else x for x in signals],
                "cross_asset_radar": radar,
                "recession_check": recession.model_dump() if hasattr(recession, "model_dump") else recession,
                "recession_bands": recession_bands,
                "fed_status": fed_status.model_dump() if hasattr(fed_status, "model_dump") else fed_status,
                "rates_dashboard": yield_curve,
                "inflation_latest": inflation_latest,
            }
            snapshot_key = f"dashboard-radar:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
            safe_payload = self._json_safe(payload)
            rec = DashboardRadarSnapshot(
                snapshot_key=snapshot_key,
                source="dashboard_pipeline",
                source_id=snapshot_key,
                source_version=source_version,
                model_version="memory-v1",
                payload_json=safe_payload,
                quality_score=1.0,
                provenance_links=[
                    "/api/regime/current",
                    "/api/regime/history",
                    "/api/navigator/current",
                    "/api/navigator/history",
                    "/api/navigator/forward",
                    "/api/navigator/signals",
                    "/api/navigator/recession-check",
                    "/api/market/cross-asset-radar",
                    "/api/fed/current",
                ],
            )
            db.add(rec)

            await self.memory.upsert_document(
                db,
                source="dashboard_radar",
                doc_key=snapshot_key,
                title="Dashboard+Radar Snapshot",
                content=json.dumps(safe_payload, ensure_ascii=False, default=str)[:8000],
                metadata={"quality_score": 1.0, "source_version": source_version, "as_of_date": datetime.now(timezone.utc).date().isoformat()},
                tags=["dashboard", "radar", "snapshot"],
            )
            await self._finish_run(run, rows_written=1)
            return {"snapshot_key": snapshot_key, "rows_written": 1}
        except Exception as e:
            await self._finish_run(run, rows_written=0, error=str(e))
            raise

    async def ingest_forecast_lab_summary(self, db: AsyncSession, payload: object) -> None:
        """Upsert a MemoryDocument for a Forecast Lab summary (same session as caller; commit separately)."""
        dump = payload.model_dump(mode="json")  # type: ignore[union-attr]
        as_of = getattr(payload, "as_of_date", None)
        bundle_id = getattr(payload, "bundle_id", "unknown")
        phase = getattr(payload, "phase_class", "unknown")
        key = f"forecast-lab:{as_of}:{bundle_id}"
        title = f"Forecast Lab {as_of}"
        content = json.dumps(dump, ensure_ascii=False, default=str)[:12000]
        await self.memory.upsert_document(
            db,
            source="forecast_lab",
            doc_key=key,
            title=title,
            content=content,
            metadata={
                "quality_score": 1.0,
                "as_of_date": str(as_of),
                "bundle_id": str(bundle_id),
                "phase_class": str(phase),
            },
            tags=["forecast_lab", "predictions", str(phase).lower().replace(" ", "_")],
        )

    async def snapshot_analysis_indicators(self, db: AsyncSession, source_version: str = "v1") -> dict:
        run_key = f"analysis_indicators:{datetime.now(timezone.utc).isoformat()}"
        run = await self._start_run(db, "analysis_indicators_snapshot", run_key)
        try:
            market = MarketService(db)
            infl = InflationService(db)

            idx = await market.get_indices_dashboard(365 * 5)
            sectors = await market.get_sector_performance(365)
            sentiment = await market.get_sentiment_dashboard(365)
            currencies = await market.get_currency_dashboard(365 * 5)
            rates = await market.get_rates_dashboard(365 * 5)
            breadth = await market.get_breadth_dashboard(365 * 5)
            macro = await market.get_macro_overview(365 * 5)
            inflation = await infl.get_inflation_dashboard(365 * 5)

            indicators = (await db.execute(select(Indicator).order_by(Indicator.category, Indicator.name))).scalars().all()
            indicator_records = []
            for ind in indicators:
                latest = (
                    await db.execute(
                        select(IndicatorValue)
                        .where(IndicatorValue.indicator_id == ind.id)
                        .order_by(desc(IndicatorValue.date))
                        .limit(1)
                    )
                ).scalar_one_or_none()
                history = (
                    await db.execute(
                        select(IndicatorValue)
                        .where(IndicatorValue.indicator_id == ind.id)
                        .order_by(desc(IndicatorValue.date))
                        .limit(120)
                    )
                ).scalars().all()
                indicator_records.append(
                    {
                        "indicator_id": ind.id,
                        "name": ind.name,
                        "category": ind.category,
                        "latest": {
                            "value": latest.value if latest else None,
                            "date": latest.date.isoformat() if latest else None,
                            "previous": latest.previous if latest else None,
                            "z_score": latest.z_score if latest else None,
                            "surprise": latest.surprise if latest else None,
                            "trend": latest.trend if latest else None,
                        },
                        "history": [
                            {"date": h.date.isoformat(), "value": h.value, "z_score": h.z_score, "surprise": h.surprise}
                            for h in history
                        ],
                    }
                )

            payload = {
                "analysis": {
                    "indices_dashboard": idx,
                    "sectors": sectors,
                    "sentiment_dashboard": sentiment,
                    "currency_dashboard": currencies,
                    "rates_dashboard": rates,
                    "breadth_dashboard": breadth,
                    "macro_overview": macro,
                    "inflation_dashboard": inflation,
                },
                "economic_indicators": indicator_records,
            }
            snapshot_key = f"analysis-indicators:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
            safe_payload = self._json_safe(payload)
            rec = AnalysisIndicatorsSnapshot(
                snapshot_key=snapshot_key,
                source="analysis_pipeline",
                source_id=snapshot_key,
                source_version=source_version,
                model_version="memory-v1",
                payload_json=safe_payload,
                quality_score=1.0,
                provenance_links=[
                    "/api/market/indices-dashboard",
                    "/api/market/sectors",
                    "/api/market/sentiment-dashboard",
                    "/api/market/currency-dashboard",
                    "/api/market/rates-dashboard",
                    "/api/market/breadth",
                    "/api/market/macro-overview",
                    "/api/indicators/inflation-dashboard",
                    "/api/indicators",
                    "/api/indicators/{id}/history",
                ],
            )
            db.add(rec)

            await self.memory.upsert_document(
                db,
                source="analysis_indicators",
                doc_key=snapshot_key,
                title="Analysis+Indicators Snapshot",
                content=json.dumps(safe_payload, ensure_ascii=False, default=str)[:12000],
                metadata={"quality_score": 1.0, "source_version": source_version, "as_of_date": datetime.now(timezone.utc).date().isoformat()},
                tags=["analysis", "indicators", "snapshot"],
            )
            await self._finish_run(run, rows_written=1)
            return {"snapshot_key": snapshot_key, "rows_written": 1}
        except Exception as e:
            await self._finish_run(run, rows_written=0, error=str(e))
            raise

    async def ingest_domain_records(self, db: AsyncSession, source_version: str = "v1", as_of_date: date | None = None) -> dict:
        run_key = f"domain_ingestion:{datetime.now(timezone.utc).isoformat()}"
        run = await self._start_run(db, "domain_ingestion", run_key)
        written = 0
        as_of = as_of_date or datetime.now(timezone.utc).date()
        try:
            from app.services.fed_press_ingestion import ingest_fed_press_rss
            from app.services.telegram_news_ingestion import ingest_telegram_whitelist

            written += await ingest_fed_press_rss(
                db, as_of=as_of, max_items=45, source_version=source_version
            )
            written += await ingest_telegram_whitelist(
                db, as_of=as_of, max_messages_per_channel=80, source_version=source_version
            )

            # fed
            fed_q = select(FedRate).where(FedRate.date <= as_of).order_by(FedRate.date.desc()).limit(1)
            fed = (await db.execute(fed_q)).scalar_one_or_none()
            if fed:
                await self.memory.upsert_document(
                    db,
                    source="fed_cb",
                    doc_key=f"fed:{fed.date.isoformat()}",
                    title="Fed latest rate snapshot",
                    content=json.dumps({"date": fed.date.isoformat(), "target_upper": fed.target_upper, "target_lower": fed.target_lower, "effr": fed.effr}),
                    metadata={"quality_score": 1.0, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["fed", "rates"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="fed_cb",
                    doc_key=f"fed:{as_of.isoformat()}",
                    title="Fed snapshot unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["fed", "rates", "missing"],
                )
                written += 1

            # yield
            y = (
                await db.execute(select(YieldData).where(YieldData.date <= as_of).order_by(YieldData.date.desc()).limit(10))
            ).scalars().all()
            if y:
                await self.memory.upsert_document(
                    db,
                    source="yield_curve",
                    doc_key=f"yield:{y[0].date.isoformat()}",
                    title="Yield curve latest points",
                    content=json.dumps(
                        [
                            {
                                "date": x.date.isoformat(),
                                "maturity": x.maturity,
                                "nominal": x.nominal_yield,
                                "tips": x.tips_yield,
                                "breakeven": x.breakeven,
                            }
                            for x in y
                        ]
                    ),
                    metadata={"quality_score": 1.0, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["yield", "curve"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="yield_curve",
                    doc_key=f"yield:{as_of.isoformat()}",
                    title="Yield curve snapshot unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["yield", "curve", "missing"],
                )
                written += 1

            # macro indicators
            inds = (
                await db.execute(select(IndicatorValue).where(IndicatorValue.date <= as_of).order_by(IndicatorValue.date.desc()).limit(100))
            ).scalars().all()
            if inds:
                await self.memory.upsert_document(
                    db,
                    source="macro",
                    doc_key=f"macro:{inds[0].date.isoformat()}",
                    title="Macro indicators latest batch",
                    content=json.dumps(
                        [
                            {"indicator_id": x.indicator_id, "date": x.date.isoformat(), "value": x.value, "z_score": x.z_score}
                            for x in inds
                        ]
                    ),
                    metadata={"quality_score": 0.95, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["macro", "indicators"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="macro",
                    doc_key=f"macro:{as_of.isoformat()}",
                    title="Macro snapshot unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["macro", "indicators", "missing"],
                )
                written += 1

            # navigator + decisions
            rec = (
                await db.execute(
                    select(Recommendation)
                    .where(Recommendation.rec_date <= as_of)
                    .order_by(Recommendation.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if rec:
                await self.memory.upsert_document(
                    db,
                    source="decisions",
                    doc_key=f"decision:{rec.rec_date.isoformat()}",
                    title="Latest recommendation decision",
                    content=json.dumps(
                        {
                            "regime": rec.regime,
                            "macro_thesis": rec.macro_thesis,
                            "confidence": rec.confidence,
                            "uncertainty": rec.uncertainty,
                            "no_trade": rec.no_trade,
                            "reason_codes": rec.reason_codes,
                        }
                    ),
                    metadata={"quality_score": 1.0, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["decision", "master"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="decisions",
                    doc_key=f"decision:{as_of.isoformat()}",
                    title="Decision snapshot unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["decision", "master", "missing"],
                )
                written += 1

            # news + agent
            signals = (
                await db.execute(
                    select(AgentSignal)
                    .where(AgentSignal.signal_date <= as_of)
                    .order_by(AgentSignal.created_at.desc())
                    .limit(20)
                )
            ).scalars().all()
            if signals:
                await self.memory.upsert_document(
                    db,
                    source="news",
                    doc_key=f"signals:{as_of.strftime('%Y%m%d')}",
                    title="Latest agent/news signals",
                    content=json.dumps(
                        [
                            {
                                "agent_name": s.agent_name,
                                "signal_type": s.signal_type,
                                "score": s.score,
                                "summary": s.summary,
                                "date": s.signal_date.isoformat(),
                            }
                            for s in signals
                        ]
                    ),
                    metadata={"quality_score": 0.9, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["news", "signals", "agents"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="news",
                    doc_key=f"signals:{as_of.strftime('%Y%m%d')}",
                    title="News/agent signals unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["news", "signals", "agents", "missing"],
                )
                written += 1

            # ml snapshots
            ml2 = (
                await db.execute(
                    select(ML2FactorScore)
                    .where(ML2FactorScore.date <= as_of)
                    .order_by(ML2FactorScore.date.desc())
                    .limit(20)
                )
            ).scalars().all()
            an = (
                await db.execute(
                    select(ML2AnomalySignal).where(ML2AnomalySignal.date <= as_of).order_by(ML2AnomalySignal.date.desc()).limit(1)
                )
            ).scalar_one_or_none()
            if ml2 or an:
                await self.memory.upsert_document(
                    db,
                    source="ml_snapshots",
                    doc_key=f"ml:{as_of.strftime('%Y%m%d')}",
                    title="Latest ML snapshots",
                    content=json.dumps(
                        {
                            "ml2_factors": [
                                {
                                    "date": x.date.isoformat(),
                                    "factor": x.factor_name,
                                    "horizon_months": x.horizon_months,
                                    "score": x.score,
                                    "confidence": x.confidence,
                                }
                                for x in ml2
                            ],
                            "ml2_anomaly": {
                                "date": an.date.isoformat() if an else None,
                                "score": an.anomaly_score if an else None,
                                "is_anomaly": an.is_anomaly if an else None,
                            },
                        }
                    ),
                    metadata={"quality_score": 0.95, "source_version": source_version, "as_of_date": as_of.isoformat()},
                    tags=["ml", "snapshots"],
                )
                written += 1
            else:
                await self.memory.upsert_document(
                    db,
                    source="ml_snapshots",
                    doc_key=f"ml:{as_of.strftime('%Y%m%d')}",
                    title="ML snapshots unavailable",
                    content=json.dumps({"as_of_date": as_of.isoformat(), "available": False}),
                    metadata={"quality_score": 0.0, "source_version": source_version, "as_of_date": as_of.isoformat(), "available": False},
                    tags=["ml", "snapshots", "missing"],
                )
                written += 1

            await self._finish_run(run, rows_written=written)
            return {"rows_written": written}
        except Exception as e:
            await self._finish_run(run, rows_written=written, error=str(e))
            raise

    @staticmethod
    def _month_ends(years: int) -> list[date]:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=365 * years)
        cursor = date(start.year, start.month, 1)
        points: list[date] = []
        while cursor <= today:
            if cursor.month == 12:
                next_month = date(cursor.year + 1, 1, 1)
            else:
                next_month = date(cursor.year, cursor.month + 1, 1)
            month_end = min(today, next_month - timedelta(days=1))
            points.append(month_end)
            cursor = next_month
        return points

    async def _upsert_snapshot_placeholders(self, db: AsyncSession, as_of: date, source_version: str) -> int:
        written = 0
        dashboard_payload = {
            "as_of_date": as_of.isoformat(),
            "kind": "dashboard_radar_snapshot",
            "backfill": True,
        }
        await self.memory.upsert_document(
            db,
            source="dashboard_radar",
            doc_key=f"dashboard-radar:{as_of.isoformat()}",
            title="Dashboard+Radar Snapshot",
            content=json.dumps(dashboard_payload),
            metadata={"quality_score": 0.8, "source_version": source_version, "as_of_date": as_of.isoformat(), "backfill": True},
            tags=["dashboard", "radar", "snapshot", "backfill"],
        )
        written += 1

        analysis_payload = {
            "as_of_date": as_of.isoformat(),
            "kind": "analysis_indicators_snapshot",
            "backfill": True,
        }
        await self.memory.upsert_document(
            db,
            source="analysis_indicators",
            doc_key=f"analysis-indicators:{as_of.isoformat()}",
            title="Analysis+Indicators Snapshot",
            content=json.dumps(analysis_payload),
            metadata={"quality_score": 0.8, "source_version": source_version, "as_of_date": as_of.isoformat(), "backfill": True},
            tags=["analysis", "indicators", "snapshot", "backfill"],
        )
        written += 1
        return written

    async def backfill_last_years(self, db: AsyncSession, years: int = 5, source_version: str = "backfill-v1") -> dict:
        run_key = f"backfill:{years}y:{datetime.now(timezone.utc).isoformat()}"
        run = await self._start_run(db, "memory_backfill", run_key)
        points = self._month_ends(years)
        total_written = 0
        try:
            for as_of in points:
                result = await self.ingest_domain_records(
                    db,
                    source_version=source_version,
                    as_of_date=as_of,
                )
                total_written += int(result.get("rows_written", 0))
                total_written += await self._upsert_snapshot_placeholders(db, as_of=as_of, source_version=source_version)
            await self._finish_run(run, rows_written=total_written)
            return {"points": len(points), "rows_written": total_written, "start_date": points[0].isoformat(), "end_date": points[-1].isoformat()}
        except Exception as e:
            await self._finish_run(run, rows_written=total_written, error=str(e))
            raise
