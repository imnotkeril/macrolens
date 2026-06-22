import ssl as _ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Local Postgres (docker-compose / localhost) needs no TLS. Managed providers
# (Supabase pooler / Neon) require TLS and sit behind pgbouncer, so verify against the
# system CA bundle (ca-certificates in the image) and disable the prepared-stmt cache.
_url = settings.database_url
_is_local = any(h in _url for h in ("localhost", "127.0.0.1", "@db:", "@db/"))
if _is_local:
    _connect_args: dict = {}
    _pool_size, _max_overflow = 20, 10
else:
    # Supabase signs its Postgres cert with a private CA absent from the system trust
    # store, so chain verification cannot pass. Connection is TLS-encrypted; cert
    # verification is disabled (user-authorized). pgbouncer-safe: no prepared-stmt cache.
    _ctx = _ssl.create_default_context()
    _ctx.check_hostname = False
    _ctx.verify_mode = _ssl.CERT_NONE
    _connect_args = {"ssl": _ctx, "statement_cache_size": 0}
    _pool_size, _max_overflow = 5, 5

engine = create_async_engine(
    _url,
    echo=False,
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
