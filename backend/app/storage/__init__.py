from backend.app.core.config import settings
from backend.app.storage.base import StorageBackend
from backend.app.storage.local import LocalStorageBackend

_storage_instance: StorageBackend = None


def get_storage() -> StorageBackend:
    global _storage_instance
    if _storage_instance is None:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            from backend.app.storage.supabase import SupabaseStorageBackend
            _storage_instance = SupabaseStorageBackend(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_KEY,
                bucket_name=settings.SUPABASE_BUCKET,
            )
        else:
            _storage_instance = LocalStorageBackend()
    return _storage_instance
