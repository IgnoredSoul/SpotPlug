import { io, Socket } from "socket.io-client";
import { SettingsSection } from "spcr-settings";

const settings: SettingsSection = new SettingsSection('SpotPlug Settings', 'spotplug-settings')
settings.addInput('socket_port', 'Socket Port', '8000', refresh_socket)
settings.addToggle('autoconnect_socket', 'Enable the socket client', true, refresh_socket)
settings.addToggle('force_progress', 'forces the progress update', false, forceProgress);
settings.addInput('progress_throttle', 'How frequent the progress data is sent (ms)', '800', () => progressThrottle = Number(settings.getFieldValue('progress_throttle')));
settings.pushSettings();

// Define socket
let socket: Socket | null = null;

// Define force_progress interval
let fpWorker: Worker | null = null;

let progressThrottle: number = 800;

// Refresh the socket state, either turning it on or off
async function refresh_socket() {
    const isEnabled = Boolean(settings.getFieldValue('autoconnect_socket'));
    const port = Number(settings.getFieldValue('socket_port')) || 8000;

    // Disconnect existing if it exists
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
    }

    // If the socket is now enabled, connect
    if (isEnabled) {
        socket = io(`http://localhost:${port}`, { autoConnect: true, reconnection: true });
        socket.on('connect', connect);
        socket.on('disconnect', disconnect);
    } else { // Else set it to null
        socket = null;
    }
}

async function connect() {
    
    // Show notification on spotify client
    Spicetify.showNotification('Connected to server');
    
    // Send "I'm spotify" data to the server
    socket!.emit('p2s-connect')
    
}

async function disconnect() {
    
    // Show notification on spotify client
    Spicetify.showNotification('Disconnected from server');
    
}

//#region Events that are automatically sent to the server

// Send the current song
async function event_songchange(event: any) {
    
    // A few checks
    if(!socket?.connected || !event?.data?.item) return;
    
    // Some constants
    const track = event.data.item;
    const artId = (track.metadata.image_xlarge_url || track.metadata.image_url || "").split(':')[2] ?? "";
    
    // Emit data to the server
    socket?.emit('p2s-songchange', {
        title: track.name,
        artists: Array.from(track.artists.map((a: any) => a.name)),
        album: track.metadata.album_title,
        art: `https://i.scdn.co/image/${artId}`,
        duration: track.duration.milliseconds,
        isPaused: event.data.isPaused
    });

}

// Send the current pause state of the player
async function event_playpause(event: any) {

    // A few checks
    if(!socket?.connected || !event?.data) return;

    // Emit data to the server
    socket?.emit('p2s-playpause', { isPaused: event.data.isPaused });

}

// Send the progress of the current track
let lastProgressThrottle = 0;
async function event_progress(event: any) {

    // A few checks
    if(!socket?.connected || !event?.data || settings.getFieldValue('force_progress')) return;

    // Progress throttle | So it doesn't constantly send progress for every little fucking number
    const now = Date.now();
    if(now - lastProgressThrottle < progressThrottle) return;
    lastProgressThrottle = now;

    socket?.emit('p2s-progress', {
        milliseconds: Spicetify.Player.getProgress(),
        percentage: parseFloat((Spicetify.Player.getProgressPercent() * 100).toFixed(2)) // Cuts the percentage down to XXX.YY%
    });

}

// After a while, the progress event stops sending every second and only updates like 4 times through out the track, unless it's being watched.
async function forceProgress() {

    const isEnabled = settings.getFieldValue('force-progress');
    if(isEnabled && !fpWorker) {
        const worker = `
            let interval = null;
            onmessage = (e) => {
                if(e.data === 'start') {
                    if (interval) clearInterval(interval); // Prevent duplicate intervals
                    interval = setInterval(() => {
                        postMessage('tick');
                    }, 250);
                } else if (e.data === 'stop') {
                    clearInterval(interval);
                    interval = null;
                }
            };
        `;

        const blob = new Blob([worker], {type: 'text/javascript'});
        fpWorker = new Worker(URL.createObjectURL(blob));

        fpWorker.onerror = (err) => {
            error("Worker Error:", err.message, "at", err.lineno);
        };

        fpWorker.onmessage = () => {
            if (!Spicetify.Player.isPlaying()) return;

            const now = Date.now();
            if (now - lastProgressThrottle < progressThrottle) return;
            lastProgressThrottle = now;

            socket?.emit('p2s-progress', {
                milliseconds: Spicetify.Player.getProgress(),
                percentage: parseFloat((Spicetify.Player.getProgressPercent() * 100).toFixed(2))
            });
        }

        fpWorker.postMessage('start');
        log('Background worker started. Force progress should be active.');
    } else if(!isEnabled && fpWorker) {
        fpWorker.postMessage('stop');
        fpWorker.terminate();
        fpWorker = null;
        log('Background worker stopped.');
    }
    
}

//#endregion

//#region Methods that the server calls

async function playback(control: { type: string, uri: string|null, milli:number|null }) {
    switch(control.type) {
        case 'next': Spicetify.Player.next(); break;
        case 'prev': Spicetify.Player.back(); break;
        case 'play': if(control.uri) Spicetify.Player.playUri(control.uri); break;
        case 'toggle': Spicetify.Player.togglePlay();
        case 'seek':if(control.milli) Spicetify.Player.seek(control.milli); break;
    }
}

//#endregion

//#region Methods that the server calls, waiting for a callback

// Retrieve the current track
async function current_track() {

    const track = Spicetify.Player.data.item;
    const artId = (track.metadata.image_xlarge_url || track.metadata.image_url || "").split(':')[2] ?? "";

    return {
        title: track.name,
        artists: Array.from(track.artists!.map((a: any) => a.name)),
        album: track.metadata.album_title,
        art: `https://i.scdn.co/image/${artId}`,
        duration: track.duration.milliseconds,
        isPaused: Spicetify.Player.data.isPaused
    }
}

// Retrieve the artists profile
// This for some reason can be a prick. So chuck it in a try catch
async function current_artist() {
    try {
        const response = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.queryArtistOverview, { uri: Spicetify.Player.data.item.metadata.artist_uri, locale: "en", includePrerelease: false });
        const Union = response?.data?.artistUnion;
        if(!Union) throw Error("No Union?");
        return Union;
    } catch (err) {
        error("Failed to get current artists profile:", err);
    }
    return null;
}

// Retrieve the next track
async function next_track() {
    return next_tracks(1) ?? null;
}

// Retrieve (N) next tracks
async function next_tracks(n: number) {
    if(Spicetify.Player.data.nextItems) {
        return Spicetify.Player.data.nextItems.slice(0, n) ?? null;
    }
    return null;
}

//#endregion

function log(...data: any[]) { console.log('[SPOTPLUG]: ', data) }
function error(...data: any[]) { console.error('[SPOTPLUG]: ', data); }

async function main() {

    // Does thou have a player?
    while (!Spicetify?.Player) await new Promise(resolve => setTimeout(resolve, 100)); 

    // Listeners
    Spicetify.Player.addEventListener('songchange', event_songchange);
    Spicetify.Player.addEventListener('onplaypause', event_playpause);
    Spicetify.Player.addEventListener('onprogress', event_progress);
    
    // Refresh socket
    refresh_socket();

    // Force progress
    forceProgress();

    // Setup callbacks
    socket?.on('s2p-playback', async (data) => await playback(data));
    socket?.on('s2p-current_track', async (callback) => callback(await current_track()));
    socket?.on('s2p-current_artist', async (callback) => callback(await current_artist()));
    socket?.on('s2p-next_track', async (callback) => callback(await next_track()));
    socket?.on('s2p-next_tracks', async (data, callback) => callback(await next_tracks(data)));
}

export default main;