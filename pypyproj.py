from PIL import Image
from pylibdmtx.pylibdmtx import decode
import matplotlib.pyplot as plt
import numpy as np
im = Image.open('1024.jpg')
def draw_square(arr, rect):
    width = rect.width
    height = rect.height
    if np.abs(width) <= 30:
        width = 30
    if np.abs(height) <= 30:
        height = 30
        
    x_start = rect.left
    x_stop = rect.left + width
    if width < 0:
        x_start = rect.left + width
        x_stop = rect.left
    
    y_start = rect.top
    y_stop = rect.top + height
    if height < 0:
        y_start = rect.top + height
        y_stop = rect.top
    
    for xc in range(x_start, x_stop):
        for yc in range(y_start, y_stop):
            arr[yc][xc] = np.array([255,0,0])
    return arr
plt.figure(figsize=(20,20))
arr = np.array(im)
results = decode(arr, max_count=96)
for code in results:
    arr = draw_square(arr, code.rect)
plt.imshow(arr)
plt.show()