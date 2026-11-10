from typing import Any, Optional, Tuple
from PIL import Image
from backend.pipeline.image_loader import to_b64
from backend.pipeline.schemas import RotationAssessment


def detect_orientation_heuristic(img: Image.Image) -> int:
    """
    Fast aspect-ratio heuristic:
    The temple receipts are rectangular horizontal slips with aspect ratio ~2.2:1.
    If height is significantly greater than width (aspect < 0.8), it is oriented vertically.
    """
    w, h = img.size
    aspect = w / float(h)
    if aspect < 0.75:
        # Tall image; rotated by 90 or 270 degrees.
        # Heuristic default for phone camera sideways is 90 CW.
        return 90
    return 0


def detect_orientation_with_gemini(
    img: Image.Image,
    llm_client: Optional[Any] = None
) -> Tuple[int, RotationAssessment]:
    """
    Pass 0: Content-based orientation detection using Gemini on a small thumbnail (saves tokens).
    Determines if document is right-side up or needs 90°, 180°, or 270° clockwise rotation.
    """
    # 1. Create a lightweight thumbnail (600px width)
    w, h = img.size
    scale = 600.0 / float(max(w, h)) if max(w, h) > 600 else 1.0
    thumb = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    thumb_b64 = to_b64(thumb, quality=75)

    if llm_client is None:
        # Fallback to heuristic if no LLM provided
        deg = detect_orientation_heuristic(img)
        return deg, RotationAssessment(
            is_receipt=True,
            is_right_side_up=(deg == 0),
            rotation_needed_degrees=deg,
            confidence="medium"
        )

    prompt = (
        "Inspect this document. It is a printed Indian temple receipt (in Telugu/English).\n"
        "Check its orientation:\n"
        "1. Is it right-side up, so that the printed header with temple name and details reads naturally from left-to-right, top-to-bottom?\n"
        "2. If it is upside down or sideways, specify how many degrees CLOCKWISE it must be rotated (0, 90, 180, or 270) to become right-side up."
    )

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        messages = [
            SystemMessage(content="You are an expert document preprocessor. Detect document orientation precisely."),
            HumanMessage(content=[
                {"type": "text", "text": prompt},
                {"type": "image", "base64": thumb_b64, "mime_type": "image/jpeg"}
            ])
        ]
        result = llm_client.with_structured_output(RotationAssessment).invoke(messages)
        deg = result.rotation_needed_degrees
        if deg not in (0, 90, 180, 270):
            deg = 0
        return deg, result
    except Exception:
        deg = detect_orientation_heuristic(img)
        return deg, RotationAssessment(
            is_receipt=True,
            is_right_side_up=(deg == 0),
            rotation_needed_degrees=deg,
            confidence="low"
        )


def apply_rotation(img: Image.Image, degrees: int) -> Image.Image:
    """
    Rotate image by specified degrees clockwise: 0, 90, 180, 270.
    In PIL, rotate(degrees) rotates counter-clockwise, so clockwise rotation is (360 - degrees) % 360.
    """
    if degrees == 0:
        return img
    pil_rot = (360 - degrees) % 360
    return img.rotate(pil_rot, expand=True)
