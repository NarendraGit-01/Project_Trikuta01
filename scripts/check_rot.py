from PIL import Image

for name in ['sample_img10.jpeg', 'sample_img11.jpeg']:
    im = Image.open(f'Reference Images/{name}')
    # If the receipt header is at the top when rotated 90 CW vs 270 CW (90 CCW)
    # Let's save both 90 CW and 90 CCW thumbnails to check
    rot_90_cw = im.rotate(270, expand=True) # in PIL, rotate(270) is 90 CW
    rot_90_ccw = im.rotate(90, expand=True)
    print(f"{name}: rot_90_cw size = {rot_90_cw.size}, rot_90_ccw size = {rot_90_ccw.size}")
