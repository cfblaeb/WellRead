from asyncio import get_event_loop
from websockets import serve
from sklearn.cluster import KMeans
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from skimage.filters import threshold_otsu
from skimage.segmentation import clear_border
from skimage.measure import label, regionprops
from skimage.morphology import closing, square
from skimage import io, feature
from skimage.transform import rescale
from skimage.color import rgb2grey
from pylibdmtx.pylibdmtx import decode
from scipy import ndimage
from multiprocessing import Pool
from io import BytesIO
from json import dumps


def decode_thread(pospos):
	col, xs, row, ys, well, effort = pospos

	res = decode(well, timeout=100, shrink=2, deviation=40, threshold=20, max_count=1)
	if res:
		return {'row': row, 'xs': xs, 'col': col, 'ys': ys, 'barcode': res[0].data.decode()}
	else:
		found = False
		for i in range(effort):
			res = decode(ndimage.rotate(well, i, reshape=False), timeout=100, max_count=1)
			if res:
				return {'row': row, 'xs': xs, 'col': col, 'ys': ys, 'barcode': res[0].data.decode()}
		if not found:
			return {'row': row, 'xs': xs, 'col': col, 'ys': ys, 'barcode': 'failed'}


def read_dem_wells(ski_image, scale=2, direction='portrait', effort=10):
	# direction = 'portrait'  # 'landscape'/'portrait'
	if direction == 'portrait':
		number_of_y_groups = 12
		number_of_x_groups = 8
	else:
		number_of_y_groups = 8
		number_of_x_groups = 12
	ski_image = io.imread("timages/op3t/t1.jpg")  # perfect
	grey_image = rgb2grey(ski_image)
	rescaled = rescale(grey_image, 1 / scale, multichannel=False)
	edges2 = feature.canny(rescaled)
	thresh = threshold_otsu(edges2)
	bw = closing(edges2 > thresh, square(3))
	cleared = clear_border(bw)

	box_ys = np.array([region.bbox[0] for region in regionprops(label(cleared)) if region.area >= 500 / scale and region.area < 5000 / scale])
	box_xs = np.array([region.bbox[1] for region in regionprops(label(cleared)) if region.area >= 500 / scale and region.area < 5000 / scale])
	y_groups = KMeans(n_clusters=number_of_y_groups).fit_predict(box_ys.reshape(-1, 1))
	x_groups = KMeans(n_clusters=number_of_x_groups).fit_predict(box_xs.reshape(-1, 1))
	y_poss = pd.DataFrame({'cat': y_groups, 'data': box_ys}).groupby('cat').median()['data'].to_list()
	x_poss = pd.DataFrame({'cat': x_groups, 'data': box_xs}).groupby('cat').median()['data'].to_list()

	x_diffs = []
	for x in range(len(x_poss) - 1):
		x_diffs.append(sorted(x_poss)[x + 1] - sorted(x_poss)[x])
	y_diffs = []
	for x in range(len(y_poss) - 1):
		y_diffs.append(sorted(y_poss)[x + 1] - sorted(y_poss)[x])

	s_size = int(np.median(x_diffs + y_diffs)) * scale

	pps = []
	for col, xs in enumerate(sorted(x_poss)):
		for row, ys in enumerate(sorted(y_poss)):
			well = ski_image[int(ys * scale):int(ys * scale) + s_size, int(xs * scale):int(xs * scale) + s_size]
			pps.append([col, xs, row, ys, well, effort])

	with Pool(4) as p:
		rar = p.map(decode_thread, pps)

	fig, ax = plt.subplots(figsize=(10, 6))
	ax.imshow(ski_image)
	#for col, xs in enumerate(sorted(x_poss)):
	#	for row, ys in enumerate(sorted(y_poss)):
	for irar in rar:
		#{'row': row, 'xs': xs, 'col': col, 'ys': ys, 'barcode': 'failed'}
		if irar['barcode'] == 'failed':
			color = 'red'
		else:
			color = 'green'
		rect = mpatches.Rectangle((irar['xs'] * scale, irar['ys'] * scale), s_size, s_size, fill=False, edgecolor=color, linewidth=2)
		ax.add_patch(rect)

	f = BytesIO()
	ax.axis('off')
	fig.savefig(f, format='png', bbox_inches='tight')
	return rar, f.getvalue()


async def hello(websocket, path):
	image = await websocket.recv()
	print("received image")
	blob = BytesIO(image)
	rar, ready_to_send_fig = read_dem_wells(io.imread(blob), scale=2, direction='landscape', effort=10)
	print("analyzed")
	await websocket.send(ready_to_send_fig)
	await websocket.send(dumps(rar))

get_event_loop().run_until_complete(serve(hello, 'localhost', 8765))
get_event_loop().run_forever()
