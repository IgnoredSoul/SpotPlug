# SpotPlug

SpotPlug is a Spicetify extension that establishes a local socket connection between Spotify and a custom server. It allows for seamless external control and real-time monitoring of your playback.

## Features

- Connects Spicetify directly to a local socket server.

- Automatically sends data to your server when things change.

- Accept commands from your server to control playback.

## Communication

### Client to Server (Outbound)

- `songchange`: Triggered when the track changes.

- `playpause`: Triggered when playback is toggled.

- `progress`: Periodic updates of the current timestamp in the song.

### Server to Client (Inbound)

- `pause`: Toggles or pauses playback.

- `next`: Skips to the next track.

- `prev`: Goes back to the previous track.

## Configuration

You can find the settings directly within Spotify's Preferences menu:

- `Enable Client`: The the socket connection on or off.
- `Port`: Set the specific local port for the socket server.
- `Progress Interval`: Adjust how frequently the progress event is sent.

## FAQ

> Why did you make this?

Since Spotify decided to lock their API behind a Premium sub and fucked the community off,  
my 'now playing' overlay doesn't work anymore due to not being able to use their API.

> How do I use this?

You can use example [python socket server](/spotplug/ExampleServer.py) and expand from there.

<hr/>

<img src='./marketplace/preview.png' style='width:256px'/>

###### Made with Spicetify Creator: https://github.com/spicetify/spicetify-creator