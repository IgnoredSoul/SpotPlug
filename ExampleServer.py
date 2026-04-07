import socketio, uvicorn, time

# Create an ASYNC Socket.io server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Wrap it in an ASGI application
app = socketio.ASGIApp(sio)

# Keep track of the spotify sid
spotify_sid = None

@sio.on('connect')
async def connect(sid, data):
    print(f"A new client has connected: {sid}")

@sio.on('disconnect')
async def disconnect(sid):
    global spotify_sid

    if(sid == spotify_sid):
        spotify_sid = None
        print("The spotify client has disconnected.")
    else:
        print(f"A client has disconnected: {sid}")

@sio.on('p2s-connect')
async def p2s_connect(sid, data):
    global spotify_sid

    # There should NOT be more than one spotify client connecting
    if(spotify_sid != None): return

    spotify_sid = sid
    print(f"Spotify has connected!")
    print(f"Data sent from connection:\n{data}")

@sio.on('songchange')
async def handle_song_change(sid, data):
    print(f"[Song Change]:", data)

@sio.on('playpause')
async def handle_play_pause(sid, data):
    print(f"[Play Pause]:", data)

@sio.on('progress')
async def handle_progress(sid, data):
    print(f"[Progress]:", data)

# Play next song
async def next():
    await sio.emit('s2p-playback', {'type': 'next'}, room=sid_lock)

# Play previous / Start of track
async def prev():
    await sio.emit('s2p-playback', {'type': 'prev'}, room=sid_lock)

# Play/Pause
async def toggle():
    await sio.emit('s2p-playback', {'type': 'toggle'}, room=sid_lock)

# Play a spotify URI
async def play():
    await sio.emit('s2p-playback', {'type': 'play', 'uri': 'spotify:track:709ZIqPHyFOpx2QdjmeWAM' })

# Seek current track to 5 seconds in
async def seek():
    await sio.emit('s2p-playback', {'type': 'seek', 'milli': '5000'})

if __name__ == '__main__':
    print("Socket server starting on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)