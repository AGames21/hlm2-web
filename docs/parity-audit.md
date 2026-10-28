# Original-game comparison: 2026-10-23

## 2026-10-28: requested easier-mode tuning

- The owner requested a more forgiving game. Only the existing optional
  easier-enemies tuning changed; normal mode retains its previous constants.
- Easier-mode first-shot delay increased from 30 to 42 simulation steps
  (0.5 to 0.7 seconds at 60 steps/s); aim turn rate decreased from 7 to 6.
  Firing cooldown multiplier increased from 1.25 to 1.5, direct chase speed
  decreased from 85% to 75%, and melee cooldown increased from 1.5x to 1.8x.
- Behavioral tests compare actual gunner fire timing and melee displacement
  between both modes. These tuning values are accessibility choices, not
  native-game measurements or proof of a balanced full-story playthrough.
  Special bosses, unarmed weapon-fetch movement and path-following have
  separate logic; no uniform slowdown of every enemy is claimed.
- Measured synthetic encounter: first bullet at step 16 in normal mode and
  step 43 in easier mode; ten-step melee chase traveled 25 versus 18.75 px.
  Final local verification passed 49/49 unit tests and 30/30 browser checks.
- The option remains enabled by default and preserves saved user choices.
  Use Options > Easier enemies to enable it if previously disabled.
- No native session was needed; Steam and native save files were untouched.
  No game files or new game text were added. Full native parity is still
  incomplete; the pause-animation and Floor 2 comparison work remains open.

## 2026-10-28: pause-label comparison chunk

- Read the full private handoff before editing; checkout started clean at a9d7807.
- Compared the cached 960x540 native pause capture with a fresh private-WAD
  browser render and six new native pause captures in Down Under Floor 1.
  Native was driven offscreen with drive.py/Frida; Chrome ran headless.
- Native bright-label bounds, normalized to 480x270: x=56.5..125.5,
  y=26..37. The handoff's proposed scale [1.78, 1.12] produced isolated
  browser glyph bounds x=58..133, y=25..36, so that proposal was rejected.
  Position [54, 23] and scale [1.64, 1.12] produce x=56..125, y=26..37.
  These are bounding-box measurements, not proof of identical glyph pixels.
- Captured six frames per implementation at requested 0.2-second intervals
  after pausing. These are wall-clock samples, not synchronized simulation
  frames. Native's lower static has broad streaks and an uneven lower edge;
  web static remains fine-grained inside a fixed rectangle. Native's menu was
  absent in the first new sample and present later. Its entrance timing and
  the static/band motion remain unported; no animation fix is claimed.
- Both implementations reached Floor 1, but player/cursor positions and wash
  phases were not matched. This is not a controlled combat or whole-scene
  comparison. Floor 2, combo/ammo placement, AI, audio and later story parity
  remain unverified. Finish pause motion before proceeding to Floor 2.
- Private screenshots, measurement helper, logs and save backups remain under
  ignored re/comparison-20261028/. No game assets or new game text were added
  to tracked files. No Steam-install changes were made.
- Native-session cleanup restored window.dat and savedata.vfs byte for byte
  against both session backups and the pristine handoff originals. The first
  session exited on a Windows request-file rename collision; cleanup succeeded,
  the ignored wrapper was corrected, and the comparison was repeated.
- Final local verification: 47/47 unit tests and 30/30 browser playtest checks
  passed. Generated-fixture checks do not establish native gameplay parity.

The browser port is **not yet equivalent to the original game**.

## Shipped deploy-test correction

Commit `0ee98b2` fixed a race in the second-floor browser test. GitHub run
39968772972 passed all checks and deployed Pages. The published `game.js` was
compared byte for byte with that commit and matched.

## Additional corrections

- Character identity now survives floor handoff for every playable character,
  rather than only characters with Fans/mask abilities. Real-file runs previously
  switched the Soldier, Henchman and Rat to the Pig on later floors. The second
  run retains their original object identities and art; explicit room spawns
  still choose their specified actor.
- The bot now walks out of a used arrival elevator before trying to ride it.
  All four false elevator stalls from the first run disappeared.
- Local regression verification: 43 simulation tests and 30 browser checks passed.

## Real-file bot comparison

Both runs used the user's original WAD files, the actual port simulation and its
input handlers. Baseline: 367 attempts, 87 distinct rooms, 13 forced-leave room
failures, zero page exceptions. After corrections: 366 attempts, 87 distinct
rooms, 9 forced-leave room failures, zero page exceptions.

Attempts include deaths and restarts. The bot steps simulation manually, uses
path/combat assists and may remove enemies, teleport or force a room transition.
Its reaching the final menu is **not** proof of an unassisted full-game clear.
Randomized AI and changed character behavior also make aggregate bug counts
unsuitable as a controlled performance comparison.

## Still different or unresolved

- Missing endings: rmJungle1, rmDayJungle1-3, rmPowerPlant1-2,
  rmSewersEntrance, rmPoliceStationFloor2Part2 and rmFansLevel5Floor3.
- Son mansion floor-one traversal/exits remain blocked in the bot run.
- Enemy-wall overlaps and unreachable-target reports remain; these require
  individual original-room/mask and spawn checks before attributing a cause.
- LSD intro moves the player 40 pixels when releasing its scripted scene.
  `web/bosses.js` explicitly labels this couch-clearance handoff a guess.
- Glass, monitors/TVs, dogs and knife-draw sound behavior remain incomplete.
- The cached original-executable call index contains 110 sound names. Ninety
  are not explicit literals in the browser source. This is a candidate list,
  **not 90 proven missing effects**: sounds can be selected dynamically and
  the index may be incomplete. For example, original pickup script 0x1157500
  calls sndPickUpWeapon; sndDrawKnife is called by a separate 0x11d30f0 script.
- Bosses, scripted NPCs, cutscenes, scoring, timing and visual effects still
  contain documented approximations. No native-game live run or frame-by-frame
  comparison was performed in this pass.

## Original evidence and next work

The audit JSON identifies the original executable by SHA-256 and records sound
call addresses. Existing original handlers were inspected with the repository's
PE/event-table tooling and cached Ghidra exports. Start/end behavior is spread
across objStartPoint, objJungleReturn, player handlers and scene controllers;
a generic automatic exit would conceal missing logic rather than port it.

Next: recover and port those ending state machines, verify each affected room
without forced exits, then compare native and browser timing/animation/audio
for the same recorded inputs. Full original-game equivalence remains unverified.
