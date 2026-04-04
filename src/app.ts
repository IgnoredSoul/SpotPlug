import { io, Socket } from "socket.io-client";
import { SettingsSection } from "spcr-settings";

const settings: SettingsSection = new SettingsSection('SpotPlug Settings', 'spotplug-settings')
const get_progress_throttle = () => Number(settings.getFieldValue('progress_throttle'));
settings.addInput('socket_port', 'Socket Port', '8000', refresh_socket)
settings.addInput('progress_throttle', 'How frequent the progress data is sent (ms)', '800');
settings.addToggle('autoconnect_socket', 'Enable the socket client', true, refresh_socket)
settings.pushSettings();

// Define socket
let socket: Socket | null = null;

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
    socket!.emit('p2s_connect', {IamHere:true})
    
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
    socket?.emit('p2s_songchange', {
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
    socket?.emit('p2s_playpause', { isPaused: event.data.isPaused });

}

// Send the progress of the current track
let lastProgressThrottle = 0;
async function event_progress(event: any) {

    // A few checks
    if(!socket?.connected || !event?.data) return;

    // Progress throttle | So it doesn't constantly send progress for every little fucking number
    const now = Date.now();
    if(now - lastProgressThrottle < get_progress_throttle()) return;
    lastProgressThrottle = now;

    socket?.emit('p2s_progress', {
        milliseconds: Spicetify.Player.getProgress(),
        percentage: parseFloat((Spicetify.Player.getProgressPercent() * 100).toFixed(2)) // Cuts the percentage down to XXX.YY%
    });

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
async function current_artist() {
    try {
        const response = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.queryArtistOverview, { uri: Spicetify.Player.data.item.metadata.artist_uri, locale: "en", includePrerelease: false });
        const Union = response?.data?.artistUnion;
        if(!Union) throw Error("No Union?");
        return Union;
    } catch (err) {
        console.error("Failed to get current artists profile:", err);
    }
}

// Retrieve the next track
async function next_track() {
    if(Spicetify.Player.data.nextItems) {
        return Spicetify.Player.data.nextItems[0] ?? null;
    }
    return null;
}

// Retrieve (N) next tracks
async function next_tracks(n: number) {
    if(Spicetify.Player.data.nextItems) {
        return Spicetify.Player.data.nextItems.slice(0, n) ?? null;
    }
    return null;
}

//#endregion

async function main() {

    // Does thou have a player?
    while (!Spicetify?.Player) await new Promise(resolve => setTimeout(resolve, 100)); 

    // Listeners
    Spicetify.Player.addEventListener('songchange', event_songchange);
    Spicetify.Player.addEventListener('onplaypause', event_playpause);
    Spicetify.Player.addEventListener('onprogress', event_progress);
    
    // Refresh socket
    refresh_socket();

    // Setup callbacks
    socket?.on('playback', async (data) => await playback(data));
    socket?.on('current_track', async (callback) => callback(await current_track()));
    socket?.on('current_artist', async (callback) => callback(await current_artist()));
    socket?.on('next_track', async (callback) => callback(await next_track()));
    socket?.on('next_tracks', async (data, callback) => callback(await next_tracks(data)));
}

export default main;