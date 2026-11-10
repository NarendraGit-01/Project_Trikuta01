import numpy as np
from PIL import Image, ImageOps
from pathlib import Path

ref_dir = Path("Reference Images")

for img_path in sorted(ref_dir.glob("*.jpeg")):
    im = Image.open(img_path)
    im_trans = ImageOps.exif_transpose(im)
    w, h = im_trans.size
    
    # If aspect ratio is height > width (like sample_img10, sample_img11), rotate 90 CW to make it horizontal
    if h > w:
        im_rot = im_trans.rotate(270, expand=True)
        w, h = im_rot.size
        print(f"{img_path.name}: Rotated 90 CW -> New size {w}x{h}")
    else:
        print(f"{img_path.name}: Size {w}x{h}")
