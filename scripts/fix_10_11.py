from PIL import Image

im10 = Image.open('evals/crops/sample_img10_thumb.jpg')
im10.rotate(180).save('evals/crops/sample_img10_fixed.jpg')

im11 = Image.open('evals/crops/sample_img11_thumb.jpg')
im11.rotate(180).save('evals/crops/sample_img11_fixed.jpg')

print("Saved fixed images")
