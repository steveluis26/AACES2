import os
import aiofiles
from abc import ABC, abstractmethod
from typing import AsyncIterator


class StorageProvider(ABC):

    @abstractmethod
    async def save(self, path: str, content: bytes) -> str: ...

    @abstractmethod
    async def get_stream(self, path: str) -> AsyncIterator[bytes]: ...

    @abstractmethod
    async def read(self, path: str) -> bytes: ...

    @abstractmethod
    async def delete(self, path: str) -> bool: ...

    @abstractmethod
    async def exists(self, path: str) -> bool: ...

    @abstractmethod
    async def url(self, path: str) -> str: ...


class LocalStorageProvider(StorageProvider):

    _provider_name = "local"

    def __init__(self, base_dir: str = "./storage"):
        self.base_dir = base_dir

    def _full_path(self, path: str) -> str:
        full = os.path.join(self.base_dir, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        return full

    async def save(self, path: str, content: bytes) -> str:
        full = self._full_path(path)
        async with aiofiles.open(full, "wb") as f:
            await f.write(content)
        return path

    async def get_stream(self, path: str) -> AsyncIterator[bytes]:
        full = self._full_path(path)
        CHUNK = 64 * 1024
        async with aiofiles.open(full, "rb") as f:
            while True:
                chunk = await f.read(CHUNK)
                if not chunk:
                    break
                yield chunk

    async def read(self, path: str) -> bytes:
        full = self._full_path(path)
        async with aiofiles.open(full, "rb") as f:
            return await f.read()

    async def delete(self, path: str) -> bool:
        full = self._full_path(path)
        try:
            os.remove(full)
            return True
        except FileNotFoundError:
            return False

    async def exists(self, path: str) -> bool:
        return os.path.exists(self._full_path(path))

    async def url(self, path: str) -> str:
        return f"/storage/{path}"


class DatabaseStorageProvider(StorageProvider):
    """Guarda los archivos en Postgres (aaces.archivos_almacenados).

    Render borra el disco en cada deploy, así que los PDF guardados con
    LocalStorageProvider se perdían. Al leer, si la clave no está en la base,
    se busca en el disco anterior (útil en desarrollo y para migrar)."""

    _provider_name = "database"

    def __init__(self, fallback_dir: str = "./storage"):
        self._disco = LocalStorageProvider(base_dir=fallback_dir)

    @staticmethod
    def _sesion():
        from app.core.database import AsyncSessionLocal
        return AsyncSessionLocal()

    async def save(self, path: str, content: bytes) -> str:
        from sqlalchemy import text
        async with self._sesion() as s:
            await s.execute(
                text("""
                    INSERT INTO aaces.archivos_almacenados (clave, contenido, tamano)
                    VALUES (:k, :c, :t)
                    ON CONFLICT (clave) DO UPDATE SET contenido = EXCLUDED.contenido,
                        tamano = EXCLUDED.tamano, fecha_creacion = now()
                """),
                {"k": path, "c": content, "t": len(content)},
            )
            await s.commit()
        return path

    async def _leer_db(self, path: str):
        from sqlalchemy import text
        async with self._sesion() as s:
            r = await s.execute(text("SELECT contenido FROM aaces.archivos_almacenados WHERE clave = :k"), {"k": path})
            row = r.fetchone()
            return bytes(row[0]) if row else None

    async def read(self, path: str) -> bytes:
        data = await self._leer_db(path)
        if data is not None:
            return data
        if await self._disco.exists(path):
            data = await self._disco.read(path)
            await self.save(path, data)  # migrar a la base
            return data
        raise FileNotFoundError(path)

    async def get_stream(self, path: str) -> AsyncIterator[bytes]:
        yield await self.read(path)

    async def delete(self, path: str) -> bool:
        from sqlalchemy import text
        async with self._sesion() as s:
            r = await s.execute(text("DELETE FROM aaces.archivos_almacenados WHERE clave = :k"), {"k": path})
            await s.commit()
        return (r.rowcount or 0) > 0 or await self._disco.delete(path)

    async def exists(self, path: str) -> bool:
        from sqlalchemy import text
        async with self._sesion() as s:
            r = await s.execute(text("SELECT 1 FROM aaces.archivos_almacenados WHERE clave = :k"), {"k": path})
            if r.fetchone():
                return True
        return await self._disco.exists(path)

    async def url(self, path: str) -> str:
        # Pasa por /api, que Vercel sí redirige al backend (/storage no)
        return f"/api/v1/archivos/{path}"


def get_storage() -> StorageProvider:
    from app.core.config import settings
    if settings.STORAGE_PROVIDER == "local_only":
        return LocalStorageProvider(base_dir=settings.STORAGE_DIR)
    return DatabaseStorageProvider(fallback_dir=settings.STORAGE_DIR)
