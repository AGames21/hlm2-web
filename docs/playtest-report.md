# Playtest report — October 22, 2026

Result after fixes: **36 simulation/regression tests and 30 integrated browser
scenarios passed**, with no uncaught browser exceptions in the exercised flow.
Browser testing used Chromium on Linux, generated WADs, authored placeholder
sprites/textures, generated WAV effects, and a generated OGG music track. No
original Hotline Miami 2 game files were available.

## What was checked

| Area | Checks |
| --- | --- |
| Loading and storage | Actual AGAR/GL parsing, atlas PNG decoding, textured viewer, music-only loading, IndexedDB restoration, corrupt archive handling |
| Input and settings | Keyboard/mouse focus, losing focus, movement, collision, remapping, duplicate bindings, saved settings, pause/resume, bug-report download |
| Combat | Punches, knockouts/recovery, executions, missing/short animations, pickups, melee weapons, throwing, shooting, ammunition, death and restart |
| Enemies and room mechanics | Dogs, dodgers, fat-enemy bleed-out, hiding gunfire, pathfinding around solids, doors, elevator handoff, both implemented boss intros and melee defeats |
| Floor and story flow | Locked exits, first/second-floor handoff, retained stats, second-floor textures/input, scores, menu, act/scene cards, intro-preview skip, saved progression |
| Display/audio | Native fullscreen at desktop and portrait sizes, options inside fullscreen, generated music, separate volume gains, actual WAV/OGG decoding |
| Lifecycle | Rapid Play clicks, delayed room draws, leaving score screens, old input-handler removal, cancelled screen loads |
| HTTP and embeds | Current assets, HEAD and byte ranges, missing files, YouTube URL validation, cue routing, chapter loops, volume/mute, saved links, playlist priority, autoplay/error feedback, and iframe creation/closing with a recording IFrame API fixture |

Tests use real browser input and the actual application, decoders, renderer, and
simulation. They also place actors or clear synthetic targets at selected
boundaries to reach transitions quickly. These are scripted regression scenarios,
not complete manual playthroughs of the original levels.

## Problems fixed during this pass

- Clicking Play or closing Settings could leave focus on a button and block
  movement keys. Gameplay and menus now receive canvas focus appropriately.
- Losing focus could leave movement keys held. Blur/visibility changes now clear
  pending input and movement.
- Keyboard activity in Settings could dismiss the score screen. The score screen
  now respects modal input and pause state.
- Returning to Menu could leave score rendering and input handlers alive. Score
  screens now cancel when another screen takes over.
- Rapid Play clicks could create two active simulations. Cancelled starts now
  discard their handles and input handlers.
- A delayed room render could overwrite a newer menu. Asynchronous loads/draws
  now check that their screen request is still current.

## Limits

- No original-room, complete-game, original-artwork, or soundtrack-completeness
  claim is established by these generated fixtures.
- Original scripted cutscenes/dialogue remain unimplemented; see
  [cutscene status](cutscene-status.md). They need the executable or REA exports.
- The YouTube scene catalog currently has three sourced entries; the prologue and other missing entries require saved links. See [music sources](music-sources.md).
- Live YouTube playback was not tested because the environment blocks YouTube;
  embed wiring was tested using a local network response fixture.
- macOS-specific Chrome fullscreen behavior, controllers, and other browsers were
  not tested. Browser/OS overlays remain outside the game's control.

## Reproduce

Simulation tests need Node.js 24:

```bash
node --test tests/*.test.mjs
```

The browser suite needs Playwright 1.62.1, Chromium or Google Chrome, and FFmpeg.
It starts and stops its own code-only server on an unused loopback port and keeps
generated archives in memory. It does not touch your saved browser data.

```bash
npm install --prefix /tmp/hlm2-playtest --no-audit --no-fund playwright@1.62.1
NODE_PATH=/tmp/hlm2-playtest/node_modules node tests/browser/playtest.cjs
```

Set `CHROMIUM_PATH` or `FFMPEG` if those executables are in custom locations.
The Pages workflow runs both suites before uploading `web/`; the test fixtures
and test tools are excluded from the published site.
