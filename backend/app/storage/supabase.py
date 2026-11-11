import mimetypes
import uuid
from pathlib import Path
from typing import Optional
import httpx
from backend.app.core.config import settings
from backend.app.storage.base import StorageBackend


class SupabaseStorageBackend(StorageBackend):
    """
    Storage backend powered by Supabase Storage REST API.
    Uploads images to a Supabase bucket and generates public CDN URLs.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or settings.SUPABASE_URL).rstrip("/")
        self.supabase_key = supabase_key or settings.SUPABASE_KEY
        self.bucket = bucket_name or settings.SUPABASE_BUCKET or "receipts"

        self.headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
        }
        self.client = httpx.Client(timeout=30.0)
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create public bucket if it does not already exist."""
        try:
            check_res = self.client.get(
                f"{self.supabase_url}/storage/v1/bucket/{self.bucket}",
                headers=self.headers,
            )
            if check_res.status_code == 404:
                self.client.post(
                    f"{self.supabase_url}/storage/v1/bucket",
                    headers=self.headers,
                    json={"id": self.bucket, "name": self.bucket, "public": True},
                )
        except Exception:
            # Non-blocking if permission or network is restricted
            pass

    def save(self, file_bytes: bytes, filename: str, subfolder: str = "") -> str:
        ext = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex[:12]}_{Path(filename).name}"
        path = f"{subfolder}/{unique_name}" if subfolder else unique_name

        content_type, _ = mimetypes.guess_type(filename)
        headers = {
            **self.headers,
            "Content-Type": content_type or "image/jpeg",
            "x-upsert": "true",
        }
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{path}"
        res = self.client.post(url, headers=headers, content=file_bytes)
        if res.status_code not in (200, 201):
            res.raise_for_status()
        return path

    def save_file(
        self,
        file_bytes: bytes,
        prefix: str = "receipt",
        extension: str = ".jpg",
        subfolder: str = "",
    ) -> str:
        if not extension.startswith("."):
            extension = f".{extension}"
        fname = f"{prefix}_{uuid.uuid4().hex[:8]}{extension}"
        return self.save(file_bytes, filename=fname, subfolder=subfolder)

    def get(self, path: str) -> Optional[bytes]:
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{path}"
        res = self.client.get(url, headers=self.headers)
        if res.status_code == 200:
            return res.content
        return None

    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        """Returns direct public CDN URL for the Supabase asset."""
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket}/{path}"

    def delete(self, path: str) -> bool:
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{path}"
        res = self.client.delete(url, headers=self.headers)
        return res.status_code in (200, 204)
