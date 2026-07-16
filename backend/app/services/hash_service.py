import hashlib


class HashService:

    async def sha256(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()


hash_service = HashService()
