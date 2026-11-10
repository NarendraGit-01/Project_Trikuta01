import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException, Response
from backend.app.storage import get_storage

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.get("/{file_path:path}")
def serve_storage_file(file_path: str):
    storage = get_storage()
    data = storage.get(file_path)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")

    content_type, _ = mimetypes.guess_type(file_path)
    if not content_type:
        content_type = "application/octet-stream"

    return Response(content=data, media_type=content_type)
