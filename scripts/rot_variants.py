from PIL import Image

for name in ['sample_img10', 'sample_img11']:
    im = Image.open(f'evals/crops/{name}_thumb.jpg')
    # Let's verify whether rotating 90 CW or 270 CW gives the right-side-up orientation
    # Let's save both and inspect
    im.rotate(270, expand=True).save(f'evals/crops/{name}_rot_cw.jpg')
    im.rotate(90, expand=True).save(f'evals/crops/{name}_rot_ccw.jpg')
print("Saved rot variants")
