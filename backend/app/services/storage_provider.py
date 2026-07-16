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
