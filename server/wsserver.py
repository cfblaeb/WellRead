from asyncio import get_event_loop
from websockets import serve
from matplotlib import pyplot as plt
from matplotlib import patches
from skimage import io
from pylibdmtx.pylibdmtx import decode
from multiprocessing import Pool
from io import BytesIO
from json import dumps, loads
from uuid import uuid4
from math import cos, sin, pi
from base64 import decodebytes
from sys import maxsize
from collections import Counter


def decode_thread(pp_more):
	if pp_more['well'].shape[0] > 0 and pp_more['well'].shape[1] > 0:
		# try shrink
		res = decode(pp_more['well'], timeout=10, shrink=2, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
		# try defaults
		res = decode(pp_more['well'], timeout=10, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
		# try threshold
		res = decode(pp_more['well'], timeout=10, threshold=100, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
		# give it more time
			# try shrink
		res = decode(pp_more['well'], timeout=100, shrink=2, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
		# try defaults
		res = decode(pp_more['well'], timeout=100, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
		# try threshold
		res = decode(pp_more['well'], timeout=100, threshold=100, max_count=1)
		if res and res[0].data.decode().isnumeric():
			return {**pp_more['pp'], 'barcode': res[0].data.decode()}
	return {**pp_more['pp'], 'barcode': "failed"}


def map_wells(col, row, orientation):
	if orientation == 'landscape':  # "normal". A1 is top left
		return f"{['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][row]}{col + 1}"
	else:  # rotated 90 degrees right
		return f"{['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'][col]}{row + 1}"


def get_dem_wells(images, grid, scale):
	if grid['width'] > grid['height']:
		grid_size = (grid['width'] / 12) * scale
		no_rows = 8
		no_cols = 12
	else:
		grid_size = (grid['height'] / 12) * scale
		no_rows = 12
		no_cols = 8
	width = grid_size * grid['scaleX']
	height = grid_size * grid['scaleY']
	ori_x = grid['left'] * scale
	ori_y = grid['top'] * scale
	angle = (grid['angle'] / 360) * 2 * pi
	pps = []
	for row in range(no_rows):
		for col in range(no_cols):
			dx1 = ori_x + width * col * cos(angle) - height * row * sin(angle)
			dx2 = ori_x + width * col * cos(angle) - height * (row + 1) * sin(angle)
			dx3 = ori_x + width * (col + 1) * cos(angle) - height * (row + 1) * sin(angle)
			dx4 = ori_x + width * (col + 1) * cos(angle) - height * row * sin(angle)
			dxs = [dx1, dx2, dx3, dx4]
			dy1 = ori_y + width * col * sin(angle) + height * row * cos(angle)
			dy2 = ori_y + width * col * sin(angle) + height * (row + 1) * cos(angle)
			dy3 = ori_y + width * (col + 1) * sin(angle) + height * (row + 1) * cos(angle)
			dy4 = ori_y + width * (col + 1) * sin(angle) + height * row * cos(angle)
			dys = [dy1, dy2, dy3, dy4]

			pps.append({'col': col, 'row': row, 'minY': int(min(dys)), 'maxY': int(max(dys)), 'minX': int(min(dxs)), 'maxX': int(max(dxs)), 'x0': dx1, 'y0': dy1})

	wells_pr_img = []
	for image in images:
		image = io.imread(BytesIO(decodebytes(image['src'].split(',')[1].encode())))
		wells = [{'pp': pp, 'well': image[pp['minY']:pp['maxY'], pp['minX']:pp['maxX']]} for pp in pps]
		wells_pr_img.append(wells)
	return wells_pr_img


def do_it(all_data: dict):
	images = all_data['images']
	grid = all_data['grid']
	iscale = all_data['scale']
	image_zero = io.imread(BytesIO(decodebytes(images[0]['src'].split(',')[1].encode())))
	scale = image_zero.shape[1] / iscale

	all_wells = get_dem_wells(images, grid, scale)
	results = []
	for wells in all_wells:
		with Pool(8) as p:
			results.append(p.map(decode_thread, wells))

	if grid['width'] > grid['height']:
		grid_size = (grid['width'] / 12) * scale
		orientation = "landscape"
		no_rows = 8
		no_cols = 12
	else:
		grid_size = (grid['height'] / 12) * scale
		orientation = "portrait"
		no_rows = 12
		no_cols = 8
	width = grid_size * grid['scaleX']
	height = grid_size * grid['scaleY']
	# analyze results
	rar = []  # list of well objects with {'row', 'col', 'barcode', 'x0', 'y0'}
	for well_no in range(no_rows * no_cols):
		# check that its the same well
		if len(set([results[i][well_no]['col'] for i in range(len(results))])) == 1 and len(set([results[i][well_no]['row'] for i in range(len(results))])) == 1:
			barcodes = [results[i][well_no]['barcode'] for i in range(len(results)) if results[i][well_no]['barcode'] != 'failed']
			barcodes_set = set(barcodes)
			if len(barcodes_set) == 1:
				rar.append({**results[0][well_no], 'barcode': barcodes_set.pop()})
			elif len(barcodes_set) == 0:
				rar.append({**results[0][well_no], 'barcode': 'failed'})
			else:
				# lets see if theres a concensus
				barcodes_counter = Counter(barcodes)
				two_most_common = barcodes_counter.most_common(2)
				if two_most_common[0][1] == two_most_common[1][1]:  # cant decide
					rar.append({**results[0][well_no], 'barcode': f"uncertain: {barcodes}"})
				else:
					rar.append({**results[0][well_no], 'barcode': two_most_common[0][0]})
		else:
			print("error...not same well?")

	# draw result consensus
	fig, ax = plt.subplots(1, figsize=(10, 20))
	ax.imshow(image_zero)
	rect = patches.Rectangle((grid['left'] * scale, grid['top'] * scale), width=grid['width'] * grid['scaleX'] * scale, height=grid['height'] * grid['scaleY'] * scale, angle=grid['angle'], linewidth=1, edgecolor='r', facecolor='none')
	ar_pa = patches.Arrow(grid['left'] * scale, grid['top'] * scale, cos(((grid['angle'] - 90) / 360) * (2 * pi)) * 50, sin(((grid['angle'] - 90) / 360) * (2 * pi)) * 50, color='green', width=10)
	ax.add_patch(rect)
	ax.add_patch(ar_pa)

	for irar in rar:
		if irar['barcode'] == 'failed':
			color = 'red'
			lw = 3
		elif irar['barcode'] == 'multi_barcodes':
			color = 'blue'
			lw = 3
		else:
			color = 'green'
			lw = 1
		mrect = patches.Rectangle((irar['x0'], irar['y0']), width=width, height=height, angle=grid['angle'], linewidth=lw, edgecolor=color, facecolor='none')
		ax.add_patch(mrect)

	f = BytesIO()
	ax.axis('off')
	fig.savefig(f, format='png', bbox_inches='tight')
	return [{'loc': map_wells(entry['col'], entry['row'], orientation), 'barcode': entry['barcode']} for entry in rar], f.getvalue()


async def hello(websocket, path):
	all_data = await websocket.recv()
	print("data recieved")
	unique_name = str(uuid4())
	with open(unique_name + ".json", 'w') as f:
		f.write(all_data)
	rar, ready_to_send_fig = do_it(loads(all_data))
	print("analyzed. Returning results.")
	await websocket.send(ready_to_send_fig)
	await websocket.send(dumps(rar))

if __name__ == "__main__":
	get_event_loop().run_until_complete(serve(hello, '127.0.0.1', 8765, max_size=maxsize))
	get_event_loop().run_forever()
