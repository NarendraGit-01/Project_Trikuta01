from PIL import Image, ImageOps
from pathlib import Path

ref_dir = Path("Reference Images")
images = sorted(ref_dir.glob("*.jpeg"))

for img_path in images:
    im = Image.open(img_path)
    exif = im.getexif()
    orient = exif.get(0x0112, 1) if exif else 1
    im_trans = ImageOps.exif_transpose(im)
    w, h = im_trans.size
    print(f"File: {img_path.name:<18} Original: {im.size} Exif: {orient} Transposed: ({w}, {h}) Aspect: {w/h:.2f}")
