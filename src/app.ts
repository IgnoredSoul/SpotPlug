import { io, Socket } from "socket.io-client";
import { SettingsSection } from "spcr-settings";

// Config located in spotifys' preferences
const settings: SettingsSection = new SettingsSection('SpotPlug Settings', 'spotplug-settings')

// Define progress throttle
let progress_throttle: number = Number(settings.getFieldValue('progress_throttle'));

// Define the last time we sent the progress
let lastProgressUpdate: number = 0;

// Define socket
let socket: Socket | null = null;

// Refresh socket
function refreshSocket() {
    const isEnabled = Boolean(settings.getFieldValue('autoconnect_socket'));
    const port = Number(settings.getFieldValue('socket_port')) || 8000;

    // Disconnect existing if it exists
    if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
    }

    // If we should connect
    if (isEnabled) {
        socket = io(`http://localhost:${port}`, { autoConnect: true, reconnection: true });
        socket?.on("connected", () => { on_connected(Spicetify.Player.data); Spicetify.showNotification("Connected to the socket server") });
        socket?.on("disconnect", () => Spicetify.showNotification('Disconnected from the socket server'));
        // If they leave it on, their fault lmao
        // socket.on("connect_error", (err) => {console.error("Socket Error:", err); Spicetify.showNotification('SpotPlug encountered an error. Did you turn off auto connect?')});
    } else {
        socket = null;
    }
}

// Socket port entry
settings.addInput('socket_port', 'Socket Port', '8000', () => refreshSocket())

// A toggle to see if we should auto connect to a socket or not
// Changed the description to just make it toggle the socket instead of 'auto connect' smh
settings.addToggle('autoconnect_socket', 'Enable the socket client', true, () => refreshSocket())

// How often does the songs' progress get sent
settings.addInput('progress_throttle', 'How frequent the progress data is sent (ms)', '900', () => progress_throttle = Number(settings.getFieldValue('progress_throttle')));

// Push settings
settings.pushSettings();

async function on_connected(data: any) {
    if (!data?.item || !socket?.connected) return;
    const track = data.item;
    const metadata = track.metadata;
    const albumArt = metadata.image_xlarge_url || metadata.image_url || "";
    const artId = albumArt.includes(':') ? albumArt.split(':')[2] : albumArt;
    const payload = {
        title: track.name,
        artists: Array.from(track.artists.map((a: any) => a.name)),
        album: metadata.album_title,
        artUrl: artId ? `https://i.scdn.co/image/${artId}` : "",
        durationMs: track.duration.milliseconds,
        isPaused: data.isPaused
    };
    socket?.emit('connected', payload)
}

async function on_songchange(data: any) {
    if (!data?.item || !socket?.connected) return;
    const track = data.item;
    const metadata = track.metadata;
    const albumArt = metadata.image_xlarge_url || metadata.image_url || "";
    const artId = albumArt.includes(':') ? albumArt.split(':')[2] : albumArt;
    const payload = {
        title: track.name,
        artists: Array.from(track.artists.map((a: any) => a.name)),
        album: metadata.album_title,
        artUrl: artId ? `https://i.scdn.co/image/${artId}` : "",
        durationMs: track.duration.milliseconds,
        isPaused: data.isPaused
    };
    socket?.emit('songchange', payload)
}

async function on_playpause(data: any) {
    if (!data || !socket?.connected) {
        console.log("socket aint connected?", socket?.connected ? 'yes':'no', ' data?', data ? 'yes':'no');
        return;
    }
    socket?.emit('playpause', { isPaused: data.isPaused })
}

async function on_progress(data: any) {
    if (!data || !socket?.connected) return;
    const now = Date.now();
    if (now - lastProgressUpdate < progress_throttle) return;
    lastProgressUpdate = now;
    socket?.emit('progress', { progress_ms: Spicetify.Player.getProgress(), progress_p: parseFloat((Spicetify.Player.getProgressPercent() * 100).toFixed(2))})
}

// When the extension loads
async function main() {

    // Does thou have a player?
    while (!Spicetify?.Player) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Refresh
    refreshSocket();

    // Add listeners
    Spicetify.Player.addEventListener("songchange", (event) => on_songchange(event?.data));
    Spicetify.Player.addEventListener("onplaypause", (event) => on_playpause(event?.data));
    Spicetify.Player.addEventListener("onprogress", (event) => on_progress(event?.data));
    
    // Custom commands 'cause why not
    socket?.on('command', (data: { action: string }) => {
        switch(data.action) {
            case 'next': Spicetify.Player.next(); break;
            case 'prev': Spicetify.Player.back(); break;
            case 'pause': Spicetify.Player.pause(); break;
            case 'play': Spicetify.Player.play(); break;
        }
    });
}

export default main;