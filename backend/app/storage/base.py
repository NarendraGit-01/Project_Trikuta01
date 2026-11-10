from abc import ABC, abstractmethod
from typing import BinaryIO, Optional


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_bytes: bytes, filename: str, subfolder: str = "") -> str:
        """Save bytes to storage and return relative path or storage key."""
        pass

    def save_file(
        self,
        file_bytes: bytes,
        prefix: str = "receipt",
        extension: str = ".jpg",
        subfolder: str = ""
    ) -> str:
        """Convenience method to save raw file bytes."""
        return self.save(file_bytes, f"{prefix}{extension}", subfolder=subfolder)

    @abstractmethod
    def get(self, path: str) -> Optional[bytes]:
        """Retrieve raw bytes from storage given a relative path or key."""
        pass

    @abstractmethod
    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        """Get an accessible URL or file serving path for the stored resource."""
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """Delete file from storage."""
        pass
