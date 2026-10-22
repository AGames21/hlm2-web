# YouTube music sources

The game does not ship, download, or proxy the soundtrack. Playback uses a visible
YouTube privacy-enhanced iframe and the official YouTube IFrame Player API. A user
may need to press play inside the iframe because of browser autoplay rules.

## Built-in references

| Use | Source link | Public metadata used to identify it |
| --- | --- | --- |
| Standalone soundtrack compilation | [Video](https://www.youtube.com/watch?v=dEFcpyy_vq8) | [GetShitDoneMusic README](https://github.com/2001db8/GetShitDoneMusic#readme), the Hotline Miami 2 entry |
| In the Face of Evil — Magic Sword | [Video](https://www.youtube.com/watch?v=-h5snZTfoEA) | [AET Media Pack request #33](https://github.com/Nomas-X/AET_Media_Pack/issues/33), which gives the title and video URL |
| Roller Mobster — Carpenter Brut | [Playlist entry 5](https://www.youtube.com/playlist?list=PL1M4SFkXjuhhxIIELResZTZMJTX6fM35v&index=5) | [mpjo “lado a” track list](https://github.com/noah-art3mis/mpjo/#readme) |
| She Swallowed Burning Coals — El Tigr3 | [Playlist entry 3](https://www.youtube.com/playlist?list=PL1M4SFkXjuhhxIIELResZTZMJTX6fM35v&index=3) | Same published playlist/track list |

These references identify community links; they do not establish official-upload
status, current availability, completeness, or current playlist order. Live
YouTube pages, search, and embeds are blocked by this cloud environment. No video
ID or chapter boundary was guessed to fill the remaining catalog.

For a fixed playlist entry, the player uses the documented index to resolve its
video through the IFrame API, then loads that single video for looping. Normal
manual playlists keep their original playback order. A playlist owner may reorder
or remove songs; a saved direct video link is preferable when available.

Track title/artist labels where available also use the public [HotlineRadio catalog](https://github.com/HeadHoffer/HotlineRadio/blob/master/js/player.js). Two cue names without an established title are explicitly marked unverified.

## Scene mapping and user links

`web/game.js` and `web/menu.js` provide the existing music cues. The named catalog
in `web/soundtrack.js` covers those cues; **most do not yet have built-in URLs**.
Cue names and scene order come from this reconstruction and have not been checked
against a running original game. There is no claim of complete soundtrack or
cutscene fidelity.

The UI shows the current cue and its track search link. Users can save a video URL,
a compilation URL with start/end timestamps, or a fixed playlist entry for any
named cue. Links and scene-following preference are saved locally in that browser.
An unmapped cue stops YouTube and explains which link is missing; it does not play
the synth fallback as if it were the original track. Closing YouTube or choosing
local music releases its audio priority.

## Validation

Node tests cover all declared cues, URL/ID validation, timestamps, playlist
indices, routing, manual priority, and cancellation of local audio decoding.
Browser scenarios use a recording implementation of the documented IFrame API
and intercepted iframe responses. They test scene switching, same-song floor
continuity, loops, game volume/mute, autoplay/error feedback, persistent bindings,
and manual playlist priority. They do not test actual YouTube streaming, ads,
regional restrictions, or embedding permission.
