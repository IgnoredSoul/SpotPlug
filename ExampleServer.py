import socketio, uvicorn, time

# Create an ASYNC Socket.io server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Wrap it in an ASGI application
app = socketio.ASGIApp(sio)

# Realistically, there is only one client connecting to the server
sid_lock = None

@sio.on('connect')
async def connect(sid, data):
    global sid_lock

    # Drop any new connections
    if sid_lock is not None:
        await sio.disconnect(sid)

    sid_lock = sid

    print(f"✅ Spicetify Client Connected: {sid}")

@sio.on('disconnect')
async def disconnect(sid):
    global sid_lock

    sid_lock = None

@sio.on('songchange')
async def handle_song_change(sid, data):
    print(f"[Song Change]:", data)

@sio.on('playpause')
async def handle_play_pause(sid, data):
    print(f"[Play Pause]:", data)

@sio.on('progress')
async def handle_progress(sid, data):
    print(f"[Progress]:", data)

# Examples of sending the client commands
async def next():
    print('sending Next')
    await sio.emit('command', {'action': 'next'}, room=sid_lock)

async def prev():
    print('sending Prev')
    await sio.emit('command', {'action': 'prev'}, room=sid_lock)

async def pause():
    print('sending Pause')
    await sio.emit('command', {'action': 'pause'}, room=sid_lock)

async def play():
    print('sending Play')
    await sio.emit('command', {'action': 'play'}, room=sid_lock)

if __name__ == '__main__':
    print("Socket server starting on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)