from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.market_service import MarketService

router = APIRouter()


@router.get("/series/{symbol}")
async def get_series(symbol: str, days: int = Query(365), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_time_series(symbol, days)


@router.get("/ratios")
async def get_ratios(
    a: str = Query(...), b: str = Query(...), days: int = Query(365),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_ratio_series(a, b, days)


@router.get("/net-liquidity")
async def get_net_liquidity(days: int = Query(730), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_net_liquidity(days)


@router.get("/recession-bands")
async def get_recession_bands(db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_recession_bands()


@router.get("/sectors")
async def get_sectors(days: int = Query(180), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_sector_performance(days)


@router.get("/sector-groups")
async def get_sector_groups(days: int = Query(180), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_sector_groups(days)


@router.get("/factors")
async def get_factors(days: int = Query(365), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_factor_ratios(days)


@router.get("/indices")
async def get_indices(db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_index_status()


@router.get("/currencies")
async def get_currencies(days: int = Query(365), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_fx_relative_strength(days)


@router.get("/breadth")
async def get_breadth(days: int = Query(365 * 5), db: AsyncSession = Depends(get_db)):
    svc = MarketService(db)
    return await svc.get_breadth_dashboard(days)


@router.get("/sectors-dashboard")
async def get_sectors_dashboard(
    days: int = Query(365),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_sectors_dashboard(days)


@router.get("/currency-dashboard")
async def get_currency_dashboard(
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_currency_dashboard(days)


@router.get("/sentiment-dashboard")
async def get_sentiment_dashboard(
    days: int = Query(365),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_sentiment_dashboard(days)


@router.get("/rates-dashboard")
async def get_rates_dashboard(
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_rates_dashboard(days)


@router.get("/indices-dashboard")
async def get_indices_dashboard(
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_indices_dashboard(days)


@router.get("/macro-overview")
async def get_macro_overview(
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    return await svc.get_macro_overview(days)


@router.get("/cross-asset-radar")
async def get_cross_asset_radar(db: AsyncSession = Depends(get_db)):
    """All 20 Cross-Asset Radar cells (same data sources as macro overview)."""
    svc = MarketService(db)
    return await svc.get_cross_asset_radar()
