import numpy as np
from PIL import Image, ImageFilter
from backend.pipeline.schemas import QualityAssessment


def evaluate_image_quality(
    img: Image.Image,
    blur_threshold_poor: float = 55.0,
    blur_threshold_acceptable: float = 75.0,
    min_short_side: int = 700
) -> QualityAssessment:
    """
    Evaluates image quality:
    - Laplacian edge variance for blur
    - Mean luminance for underexposure / overexposure
    - Standard deviation for contrast
    - Resolution check
    Returns bilingual diagnostic messages and overall verdict.
    """
    w, h = img.size
    short_side = min(w, h)

    # Convert to grayscale array
    gray = img.convert("L")
    arr = np.array(gray, dtype=np.float32)

    mean_lum = float(np.mean(arr))
    std_lum = float(np.std(arr))

    # Laplacian filter using 3x3 kernel
    # [0, 1, 0, 1, -4, 1, 0, 1, 0]
    laplacian_kernel = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], 1, 0)
    edges = gray.filter(laplacian_kernel)
    lap_var = float(np.var(np.array(edges, dtype=np.float32)))

    issues_en = []
    issues_te = []

    # 1. Blur Check
    is_poor_blur = lap_var < blur_threshold_poor
    is_acceptable_blur = lap_var < blur_threshold_acceptable

    if is_poor_blur:
        issues_en.append("Image is blurry. Please hold the phone steady and retake.")
        issues_te.append("చిత్రం స్పష్టంగా లేదు (బ్లర్). దయచేసి ఫోన్ను స్థిరంగా ఉంచి మళ్లీ ఫోటో తీయండి.")
    elif is_acceptable_blur:
        issues_en.append("Image has mild blur, text may be difficult to read.")
        issues_te.append("చిత్రంలో కొద్దిగా అస్పష్టత ఉంది, చేతివ్రాత చదవడంలో తేడా రావచ్చు.")

    # 2. Lighting Check
    if mean_lum < 60:
        issues_en.append("Image is too dark. Please ensure good lighting.")
        issues_te.append("ఫోటో చాలా చీకటిగా ఉంది. దయచేసి తగినంత వెలుతురులో ఫోటో తీయండి.")
    elif mean_lum > 225:
        issues_en.append("Image is overexposed or has strong glare.")
        issues_te.append("ఫోటోలో అతిగా వెలుతురు లేదా మెరుపు (గ్లేర్) పడింది.")

    # 3. Contrast Check
    if std_lum < 22:
        issues_en.append("Low contrast between ink and receipt paper.")
        issues_te.append("కాగితం మరియు అక్షరాల మధ్య వ్యత్యాసం (కాంట్రాస్ట్) తక్కువగా ఉంది.")

    # 4. Resolution Check
    if short_side < min_short_side:
        issues_en.append(f"Image resolution is too low ({w}x{h}). Please move closer.")
        issues_te.append(f"చిత్రం పరిమాణం చాలా చిన్నదిగా ఉంది ({w}x{h}). దయచేసి రసీదుకి దగ్గరగా వెళ్లి తీయండి.")

    # Determine Verdict
    if is_poor_blur or mean_lum < 40 or mean_lum > 240 or short_side < 400:
        verdict = "POOR"
        can_proceed = True  # Can proceed if user clicks "Use Anyway" override
    elif is_acceptable_blur or issues_en:
        verdict = "ACCEPTABLE"
        can_proceed = True
    else:
        verdict = "GOOD"
        can_proceed = True

    return QualityAssessment(
        laplacian_variance=round(lap_var, 1),
        mean_luminance=round(mean_lum, 1),
        std_luminance=round(std_lum, 1),
        resolution=(w, h),
        verdict=verdict,
        issues_en=issues_en,
        issues_te=issues_te,
        can_proceed=can_proceed
    )
