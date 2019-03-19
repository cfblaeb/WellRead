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


def decode_thread(pospos):
	col, xs, row, ys, well = pospos
	return_package = {'row': row, 'xs': xs, 'col': col, 'ys': ys, 'barcode': 'failed'}
	if well.shape[0] > 0 and well.shape[1] > 0:
		res = decode(well, max_count=1)
		if res:
			return_package['barcode'] = res[0].data.decode()
		else:
			res = decode(well, threshold=100, timeout=1000, max_count=1)
			if res:
				return_package['barcode'] = res[0].data.decode()
	return return_package


def map_wells(col, row, orientation):
	if orientation == 'landscape':  # "normal". A1 is top left
		return f"{['A','B','C','D','E','F','G','H'][row]}{col+1}"
	else:  # rotated 90 degrees right
		return f"{['H','G','F','E','D','C','B','A'][col]}{row+1}"


def read_dem_wells(im, meta):
	grid = meta['grid']
	iscale = meta['scale']
	scale = im.shape[1] / iscale
	fig, ax = plt.subplots(1, figsize=(10, 20))
	ax.imshow(im)
	rect = patches.Rectangle((grid['left'] * scale, grid['top'] * scale), width=grid['width'] * grid['scaleX'] * scale,
													 height=grid['height'] * grid['scaleY'] * scale, angle=grid['angle'], linewidth=1,
													 edgecolor='r', facecolor='none')
	ar_pa = patches.Arrow(grid['left'] * scale, grid['top'] * scale, cos(((grid['angle'] - 90) / 360) * (2 * pi)) * 50,
												sin(((grid['angle'] - 90) / 360) * (2 * pi)) * 50, color='green', width=10)
	ax.add_patch(ar_pa)
	ax.add_patch(rect)

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

			well = im[int(min(dys)):int(max(dys)), int(min(dxs)):int(max(dxs))]
			pps.append([col, dx1, row, dy1, well])

	with Pool(8) as p:
		rar = p.map(decode_thread, pps)

	for irar in rar:
		if irar['barcode'] == 'failed':
			color = 'red'
			lw = 3
		else:
			color = 'green'
			lw = 1
		mrect = patches.Rectangle((irar['xs'], irar['ys']), width=width, height=height, angle=grid['angle'], linewidth=lw, edgecolor=color,facecolor='none')
		ax.add_patch(mrect)

	f = BytesIO()
	ax.axis('off')
	fig.savefig(f, format='png', bbox_inches='tight')
	return [{'loc': map_wells(entry['col'], entry['row'], orientation), 'barcode': entry['barcode']} for entry in rar], f.getvalue()


async def hello(websocket, path):
	image = await websocket.recv()
	print(type(image))
	print(image[:1000])
	print("received image")
	meta_data = await websocket.recv()
	print("meta data recieved")
	unique_name = str(uuid4())
	with open(unique_name + ".json", 'w') as f:
		f.write(meta_data)
	image = io.imread(BytesIO(image))

	io.imsave(f"{unique_name}.png", image)
	rar, ready_to_send_fig = read_dem_wells(image, loads(meta_data))
	print("analyzed. Returning results.")
	await websocket.send(ready_to_send_fig)
	await websocket.send(dumps(rar))

get_event_loop().run_until_complete(serve(hello, '127.0.0.1', 8765, max_size=100E6))
get_event_loop().run_forever()
