import os
import shutil
from pathlib import Path
from backend.app.storage.local import LocalStorageBackend


def test_local_storage(tmp_path):
    storage = LocalStorageBackend(base_dir=str(tmp_path))

    # Save
    data = b"sample image bytes content"
    rel_path = storage.save(data, filename="sample.jpg", subfolder="receipts")
    assert "receipts" in rel_path

    # Get
    retrieved = storage.get(rel_path)
    assert retrieved == data

    # URL
    url = storage.get_url(rel_path)
    assert url.startswith("/api/v1/storage/")

    # Delete
    deleted = storage.delete(rel_path)
    assert deleted is True
    assert storage.get(rel_path) is None
