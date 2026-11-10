import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple, Union


def auto_orient_and_crop(
    img_input: Union[Image.Image, np.ndarray, str]
) -> Tuple[Image.Image, int, List[int]]:
    """
    Automatically orient receipt right-side-up and crop tightly to receipt slip,
    removing distracting background (table, hands, desk clutter).

    Returns:
        (cropped_pil_image, rotation_applied_degrees, bounding_box [x1, y1, x2, y2])
    """
    # 1. Convert to OpenCV BGR numpy array
    if isinstance(img_input, str):
        img_bgr = cv2.imread(img_input)
    elif isinstance(img_input, Image.Image):
        rgb = np.array(img_input.convert("RGB"))
        img_bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    elif isinstance(img_input, np.ndarray):
        img_bgr = img_input.copy()
    else:
        raise ValueError(f"Unsupported image type: {type(img_input)}")

    if img_bgr is None or img_bgr.size == 0:
        raise ValueError("Invalid or empty image.")

    h, w = img_bgr.shape[:2]
    rot = 0

    # 2. Aspect Ratio Orientation Check
    # Temple receipts are horizontal rectangular slips with aspect ratio ~2.2:1.
    # If height > width, the camera was held vertically: rotate so width > height.
    if h > w:
        img_bgr = cv2.rotate(img_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
        rot = 270
        h, w = img_bgr.shape[:2]

    # 3. Content-Based Orientation Check (Printed Temple Header)
    # The header has printed blue ink and temple seal at the top.
    def blue_ink_count(slice_):
        b, g, r = slice_[:, :, 0], slice_[:, :, 1], slice_[:, :, 2]
        blue_mask = (b > 90) & (b > r.astype(int) + 20) & (b > g.astype(int) + 10)
        return np.count_nonzero(blue_mask)

    top_b = blue_ink_count(img_bgr[: h // 3, :])
    bot_b = blue_ink_count(img_bgr[2 * h // 3 :, :])

    if bot_b > top_b * 1.5:
        # Document is upside-down: rotate 180
        img_bgr = cv2.rotate(img_bgr, cv2.ROTATE_180)
        rot = (rot + 180) % 360
        h, w = img_bgr.shape[:2]

    # 4. Receipt Slip Boundary Detection
    # Pink paper slip in HSV + fallback for white paper receipts
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    mask_pink = cv2.inRange(hsv, np.array([120, 15, 60]), np.array([180, 255, 255]))
    mask_white = cv2.inRange(hsv, np.array([0, 0, 130]), np.array([180, 50, 255]))
    paper_mask = cv2.bitwise_or(mask_pink, mask_white)

    # Bridge printed text and lines inside the receipt slip
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 35))
    closed = cv2.morphologyEx(paper_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    crop_box = [0, 0, w, h]

    if contours:
        valid_c = [c for c in contours if cv2.contourArea(c) > 0.20 * (h * w)]
        if valid_c:
            best_c = max(valid_c, key=cv2.contourArea)
            bx, by, bw, bh = cv2.boundingRect(best_c)

            # Add 1.5% padding so borders/stamps are preserved
            pad_x = int(bw * 0.015)
            pad_y = int(bh * 0.015)
            x1 = max(0, bx - pad_x)
            y1 = max(0, by - pad_y)
            x2 = min(w, bx + bw + pad_x)
            y2 = min(h, by + bh + pad_y)

            # Safety check: must cover at least 50% of dimension
            if (x2 - x1) > 0.50 * w and (y2 - y1) > 0.50 * h:
                img_bgr = img_bgr[y1:y2, x1:x2]
                crop_box = [x1, y1, x2, y2]

    # 5. Convert back to RGB PIL Image
    rgb_out = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    pil_out = Image.fromarray(rgb_out)

    return pil_out, rot, crop_box
