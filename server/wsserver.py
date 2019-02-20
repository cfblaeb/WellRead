import asyncio
import websockets


async def hello(websocket, path):
	image = await websocket.recv()
	print(image)
	await websocket.send(open("/home/laeb/PycharmProjects/WellRead/timages/t1.jpg", 'rb').read())

asyncio.get_event_loop().run_until_complete(websockets.serve(hello, 'localhost', 8765))
asyncio.get_event_loop().run_forever()
