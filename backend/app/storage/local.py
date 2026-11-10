import os
import uuid
from pathlib import Path
from typing import Optional
from backend.app.core.config import settings
from backend.app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file_bytes: bytes, filename: str, subfolder: str = "") -> str:
        folder = self.base_dir / subfolder if subfolder else self.base_dir
        folder.mkdir(parents=True, exist_ok=True)
        
        # Ensure unique name to prevent collision
        ext = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex[:12]}_{Path(filename).name}"
        full_path = folder / unique_name
        
        with open(full_path, "wb") as f:
            f.write(file_bytes)
            
        # Return path relative to base_dir (forward slashes for consistency)
        rel_path = full_path.relative_to(self.base_dir).as_posix()
        return rel_path

    def save_file(
        self,
        file_bytes: bytes,
        prefix: str = "receipt",
        extension: str = ".jpg",
        subfolder: str = ""
    ) -> str:
        """Convenience method to save raw bytes with generated filename based on prefix and extension."""
        if not extension.startswith("."):
            extension = f".{extension}"
        fname = f"{prefix}_{uuid.uuid4().hex[:8]}{extension}"
        return self.save(file_bytes, filename=fname, subfolder=subfolder)

    def get(self, rel_path: str) -> Optional[bytes]:
        full_path = (self.base_dir / rel_path).resolve()
        if not full_path.is_file() or not str(full_path).startswith(str(self.base_dir)):
            return None
        with open(full_path, "rb") as f:
            return f.read()

    def get_url(self, rel_path: str, expires_in_seconds: int = 3600) -> str:
        # For local dev, served via FastAPI static /api/v1/storage/{rel_path}
        return f"/api/v1/storage/{rel_path}"

    def delete(self, rel_path: str) -> bool:
        full_path = (self.base_dir / rel_path).resolve()
        if full_path.is_file() and str(full_path).startswith(str(self.base_dir)):
            full_path.unlink()
            return True
        return False
