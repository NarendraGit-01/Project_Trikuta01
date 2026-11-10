import base64
import io
from pathlib import Path
from typing import List, Optional, Union
import numpy as np
from PIL import Image, ImageOps

IMG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def resolve_image(path_or_str: Union[str, Path]) -> Path:
    """Find and return absolute path of an image, checking working directory and subdirectories."""
    p = Path(path_or_str).expanduser()
    if p.is_file():
        return p.resolve()
    # Search locally
    hits = [h for h in Path.cwd().rglob(p.name) if h.is_file()]
    if hits:
        return hits[0].resolve()
    raise FileNotFoundError(f"Image '{path_or_str}' could not be located in {Path.cwd()}")


def load_image_bytes(path_or_bytes: Union[str, Path, bytes]) -> Image.Image:
    """Load an image from filepath or raw bytes into a PIL Image."""
    if isinstance(path_or_bytes, bytes):
        return Image.open(io.BytesIO(path_or_bytes))
    path = resolve_image(path_or_bytes)
    return Image.open(path)


def prepare_image(path_or_bytes: Union[str, Path, bytes], max_side: int = 3000) -> Image.Image:
    """Load image, apply EXIF orientation transposition, ensure RGB, and resize if larger than max_side."""
    img = load_image_bytes(path_or_bytes)
    img = ImageOps.exif_transpose(img).convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    return img


def to_b64(img: Image.Image, quality: int = 95) -> str:
    """Convert PIL image to base64 JPEG string."""
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def from_b64(b64_str: str) -> Image.Image:
    """Convert base64 JPEG string to PIL Image."""
    data = base64.b64decode(b64_str)
    return Image.open(io.BytesIO(data)).convert("RGB")


def crop_from_box(
    img: Image.Image,
    box: List[int],
    pad: float = 0.03,
    target_long_side: int = 2000
) -> Optional[Image.Image]:
    """
    Crop region using normalized bounding box [ymin, xmin, ymax, xmax] (0 to 1000 scale).
    Applies padding and upscales with LANCZOS if smaller than target_long_side.
    """
    try:
        if not box or len(box) != 4:
            return None
        ymin, xmin, ymax, xmax = [float(v) / 1000.0 for v in box]
        if not (0 <= ymin < ymax <= 1 and 0 <= xmin < xmax <= 1):
            return None

        w, h = img.size
        left = max(0.0, xmin - pad) * w
        top = max(0.0, ymin - pad) * h
        right = min(1.0, xmax + pad) * w
        bottom = min(1.0, ymax + pad) * h

        crop_w = int(right - left)
        crop_h = int(bottom - top)
        if crop_w < 10 or crop_h < 10:
            return None

        cropped = img.crop((int(left), int(top), int(right), int(bottom)))

        # Upscale if needed so handwritten pen strokes are clear
        long_side = max(cropped.size)
        if long_side < target_long_side and long_side > 0:
            factor = target_long_side / float(long_side)
            new_w = max(1, int(cropped.width * factor))
            new_h = max(1, int(cropped.height * factor))
            cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

        return cropped
    except Exception:
        return None
