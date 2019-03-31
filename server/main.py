from cffi_decoder._decoder import ffi, lib
from wsserver import get_dem_wells
from skimage import io, color, img_as_ubyte
from io import BytesIO
from json import load
from base64 import decodebytes

all_data = load(open("../0f37293e-dd4b-4691-bbce-5778e997c0e7.json"))
images = all_data['images']
grid = all_data['grid']
iscale = all_data['scale']
image_zero = io.imread(BytesIO(decodebytes(images[0]['src'].split(',')[1].encode())))
scale = image_zero.shape[1] / iscale
all_wells = get_dem_wells(images, grid, scale)

print("--------------------")
results = ffi.new("unsigned char [96][40]")
fimage = b''
widths = []
heights = []
for well in all_wells[3]:
	img = img_as_ubyte(color.rgba2rgb(well['well']))
	fimage += img.tobytes()
	widths.append(img.shape[1])
	heights.append(img.shape[0])
return_val = lib.do_it(results, fimage, widths, heights, len(widths))
print("back in python")
print(return_val)
for i in range(96):
	print(ffi.string(results[i]).decode())
