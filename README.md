# SpotPlug

SpotPlug is an extension for Spicetify that creates a socket connection between Spotify and a server. It enables the control and monitoring of your Spotify playback externally.

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

- `toggle`: Pauses or resumes playback.

- `next`: Skips to the next track.

- `prev`: Goes back to the previous track/start of song.

- `play`: Play a spotify track, album or whatever with a URI

- `seek`: Seeks to a part of a song in milliseconds

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

You can use example [python socket server](/ExampleServer.py) and expand from there.

<hr/>

<img src='./marketplace/preview.png' style='width:256px'/>

###### Made with Spicetify Creator: https://github.com/spicetify/spicetify-creator