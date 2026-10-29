# Original-game comparison: 2026-10-23

## 2026-10-29: pause motion and combo/ammo HUD

- Pause VHS: a Frida trace of 30 native pause steps (VHS helper 0xe58360,
  about 1335 draws a step) replaced the guessed sprStatic band. Each step
  picks a new base line (212 + random 13) and redraws tinted
  sprMediumBlackDistortion, sprSmallBlackDistortion and sprSmallWhiteDistortion
  around it, plus a line on the white band's top edge and 10 faint rows whose
  heights are fixed per pause. The white band now spans y 162 to 8 rows past
  the base. Row-brightness profiles of web and six native frames match in shape.
  Measured: counts, spots, scale, alpha and colour ranges. Fitted: the
  distributions' exact curves.
- Combo and ammo HUD: Codex read objEffector's HUD draw 0xe040d0 statically
  (re/codex/hud-findings.md). Combo sits at (25,-5) and ammo at (32,220), each
  as two black copies plus two gradient copies, with the ammo wobble (+-0.5 px),
  colour blends and the 8 px/step slide from -160. A Frida probe of the live
  text draws confirmed every anchor, and a native frame with the HUD forced on
  screen matches web's ammo glyphs (same baseline, within 1 px). The alternate HUD 0x1108450 with a second ammo field and
  the 0xdcbd30 hide predicate are not ported.
- Score HUD: the same probe shows four copies, black at (459,17), black at
  (455+w,13+w), magenta at (458,16) and the face at (456+w,14+w), so the score
  also wobbles. Web now draws all four; its fntPoints anchor sits 3 px lower
  (456,17) to land on the same pixels (face box within the wobble pixel).
- Ammo text states (Codex, re/codex/ammo-states.md, static): a held gun shows
  its count zero-padded to two digits, an empty gun shows wad text 3009 and
  stays on screen, no gun gives 3012 and hides. Web now does the first two.
  Not ported: the scripted overrides (progression helper 0xf44230, the police
  rooms 75/320 and prison rooms 294/369 texts).
- Native Floor 2: writing the engine's pending room (engine+0x2ec = 12) loads
  room 12, but native crashes about 1 s later because objNextroom's collision
  and alarm snapshot state first. A teleport bot got the player shot, and the
  bot's player address is a copy, so teleporting it does nothing. Floor 2 still
  needs a real clear; Codex is finding the instance layout and clear gate.
- Native Floor 2, reached properly: the exit was off because Floor 1's exit is
  also the arrival exit, and its step 0x939c70 only turns it on once no
  objEnemy, objKnockedOut or third object (0x19a2da8) exists. Faking those
  existence results for the step and collision (Frida, no kills) let the real
  collision and alarm1 run: native loaded room 12 and stayed up. Web's Floor 2
  through its Floor 1 exit matches native's frame: same rooms, walls, enemy
  spot and score HUD. The camera sits about 50 px apart (native's cursor was
  off centre, which leads the camera).
- Arrival spot differs: native put the player at (302,30) on Floor 2 after
  leaving Floor 1 at (328,30); web keeps (328,30). Back on Floor 1 native kept
  (348,30). Rule not yet read.
- Arrival spot read and ported: touching a live objNextroom, native takes
  the controls and walks the player left 2 px a frame for about 13 frames,
  then changes room keeping that spot (Frida samples: exits at x 328, 316
  and 340 all walked 26 px left, even after moving right first; Floor 2
  arrival was the walked-to spot, 302 and 290). Web now does the same
  (EXIT_WALK). Web still lands at (308,24), not (302,30): its arrival pushes
  the player clear of the stairwell wall at x 288, which native lets the
  player overlap. Kept so the player cannot start stuck in a wall. What sets
  the walk direction for other exits is not read.
- Walk back: native's Floor 2 exit goes back to Floor 1 (room 11). Web goes
  straight on to the next level room. Floor 1 holds objFansVan and objHBorder,
  so the level presumably ends at the van after walking back down. Codex is
  reading the exit's target choice and the van/border ends.
- Walk back ported: in a level whose first floor has a car, the last floor's
  exit now leads one floor down with grey arrows, and on the first floor the
  level ends at the car. Web run with the real files: Floor 2's exit returned
  to Floor 1 with the player at (348,30), as native did, and walking to the
  van went on to the next level. Native's own van end (objFansVan step
  0x7ed400, objHBorder 0x8410b0) and the exit tag choice (alarm1 0x937290)
  are not fully read, so the car end and the floor order are guesses. Hub
  levels are unchanged. Codex hit its usage limit, so this was read directly.
- Playtest: five pause-menu checks added (35/35).

## 2026-10-28: native pause-symbol renderer recovered

- Started clean at c7736f3. Read the private handoff and current audit.
  Existing Ghidra project was opened with -noanalysis -readOnly; no Steam
  file was written. REA's connected Windows Ghidra provider advertises x64
  admission only; this game is x86, so existing local analysis was reused.
- Object 1073's handlers lead through 0x9e83a0 and 0x9e9fb0 to common VHS
  effect helper 0xe58360. Private decompilations and runtime records are in
  ignored re/parity-pause-20261028/.
- Frida observed 120 symbol draw calls in one second: sprVCRSymbol (1546)
  and sprVCRSymbol2 (1548), frame 4, position [34,24], scale [1.5,0.75].
  Caller sites were 0x9e9507 and 0x9e8edd. These are actual native draw
  parameters, superseding the earlier font-and-bars reconstruction.
- Browser now draws the WAD's sprVCRSymbol frame directly and removes the
  embedded label string/font reconstruction. No original artwork or game
  text was added to tracked files. The tinted flickering secondary symbol
  layer remains unported; using the original base sprite alone is partial.
- Twelve new native frames were sampled at requested 0.1-second intervals.
  These remain wall-clock samples rather than frame-locked replay. A later
  250-call trace observed sprMediumBlackDistortion, sprSmallBlackDistortion
  and sprSmallWhiteDistortion; sprStatic was absent from both inspected
  helper code and those traced sprite calls. The bounded trace is not proof
  about every native draw path. The browser's static animation still differs.
- Native ran offscreen through Frida and the browser ran headless. Both
  native save files were restored byte for byte to session backups and the
  handoff pristine originals. No real mouse or keyboard input was used.
- Private-WAD browser rendering exercised the replacement with no page
  exceptions. This is a symbol-rendering check, not a matched gameplay run.
  The isolated WAD symbol occupies x=37..125, y=26..36 at 480x270,
  including the two bars. Final local checks: 49/49 unit tests and 30/30
  integrated browser checks passed. Native colour/secondary-layer flicker
  and exact filtering still require comparison; a matching bounding box
  alone does not prove identical pixels.
  Next: recover common VHS particle/surface transforms and secondary-symbol
  tint/timing, then compare Floor 2; full-game parity remains incomplete.

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
