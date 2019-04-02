from json import load
from time import time
from wsserver import do_it
#from skimage import io
#from io import BytesIO
#from base64 import decodebytes
files = [
	load(open("../0f37293e-dd4b-4691-bbce-5778e997c0e7.json", 'r')),
]

start = time()
for i, file in enumerate(files):
	#images = file['images']
	#image_zero = io.imread(BytesIO(decodebytes(images[0]['src'].split(',')[1].encode())))
	#print(image_zero.shape[1])

	print(f"{i+1}/{len(files)}")
	istart = time()
	bla, pic = do_it(file)
	print(time()-istart)
	print(f"{sum([0 if x['barcode']=='failed' else 1 for x in bla])}/96")
print(f"total: {time()-start}")
