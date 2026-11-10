import os
from PIL import Image, ImageOps
from pathlib import Path

os.makedirs("evals/crops", exist_ok=True)
ref_dir = Path("Reference Images")

for img_path in sorted(ref_dir.glob("*.jpeg")):
    im = Image.open(img_path)
    im_trans = ImageOps.exif_transpose(im)
    if im_trans.height > im_trans.width:
        im_trans = im_trans.rotate(270, expand=True)
    w, h = im_trans.size
    
    # Save a thumbnail of 800 width for each receipt
    thumb = im_trans.resize((800, int(h * 800 / w)), Image.LANCZOS)
    thumb.save(f"evals/crops/{img_path.stem}_thumb.jpg", quality=85)

print("Saved thumbnails to evals/crops")
