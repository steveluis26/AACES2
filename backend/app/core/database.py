from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from typing import AsyncGenerator
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings
from sqlalchemy import event
import logging

logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

# Create async engine
# Ensure async driver for PostgreSQL
db_url = settings.DATABASE_URL
try:
    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://").replace("postgres://", "postgresql+asyncpg://")
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
except Exception:
    pass

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=3600,
    future=True,
    connect_args={"server_settings": {"search_path": "aaces"}},
)

# Fija el search_path a 'aaces' en cada conexion fisica. Neon/Render no aplican
# fiablemente server_settings para search_path, y sin esto los queries sin
# esquema calificado (FROM cursos, FROM participantes, ...) fallan en prod con
# "relation X does not exist". Se hace a nivel de conexion (no por request) para
# no romper transacciones, y es tolerante si el rol no tiene permiso.
# Nota: los eventos sync deben registrarse en engine.sync_engine (AsyncEngine
# no soporta eventos asincronos).
@event.listens_for(engine.sync_engine, "connect")
def _set_search_path(dbapi_conn, conn_record):
    try:
        cur = dbapi_conn.cursor()
        cur.execute("SET search_path TO aaces")
    except Exception as e:
        logger.warning(f"No se pudo fijar search_path en la conexion: {e}")

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            try:
                await session.commit()
            except Exception as e:
                logger.warning(f"Commit error ignored: {e}")
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

async def init_db():
    """Initialize database tables."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")
