# hlm2-web

Goal: play the real Hotline Miami 2 in a browser, without streaming. The site holds only
this code. Each player loads the game data from their own copy, or a private server (this PC,
the homelab) serves it. **Never publish the .wad files or anything from `_extract/`.**

## Status (2026-10-21)

Step 1 is done. The browser reads `hlm2_data_desktop.wad`, decodes the room tables and draws
any of the 321 rooms with their tiles and object sprites. A sweep showed every room draws with
no missing art.

Step 2 is done. **Play** drops the room's player (for example the pig butcher in
`rmTutorialFloor1`) into the room: WASD or the arrow keys to walk, the mouse to aim, Esc to
leave. Walls collide pixel-exactly using the game's own collision masks. Walking uses the
exe's own numbers (`MOVE` in `web/game.js`, from movement script 0x115c060; see Exe notes).

Step 3 is done. Left click punches (sprPigAttackPunch); a hit knocks the enemy down, it
slides, lies there for 120–220 steps, gets up and walks again. objVictim1 runs from the player to
the door nearest (512, 69) and cowers when cornered. Doors swing when pushed, bounce off walls and
knock enemies over. Constants are in `MELEE`, `KO`, `VICTIM1` and `DOOR` in `web/game.js`.

Step 4 is done. Right click picks up a bat, hammer, stick or taser (dropping the held one) or
throws the held weapon; a thrown weapon spins, slows and knocks down enemies it hits hard enough.
Left click swings the held weapon. Space next to a downed enemy executes it: a bat, hammer or stick
kill uses the victim's KillBlunt art, anything else a stomp (KillStomp), and the body stays dead.
Constants are in `ARMS`, `WEAPON` and `EXEC` in `web/game.js`. Guesses: the execution image speed
(0.25) and the thrown weapon's wall bounce (half speed).

Step 5 is done. The 9mm (15 rounds), shotgun (6, 8 pellets) and double barrel (2, 12 pellets)
can be picked up and fired; bullets stop at walls and kill enemies outright with their DeadMachinegun
or DeadShotgun art. The mafia (objEMafiaRandom, Patrol, Static, MeleeRandom) wander on their alarm,
spot the player, wait 15 steps, then close in and shoot, or run in with a melee weapon; a bullet or a
melee mafia kills the player (R restarts the room). Knocked-out mafia drop the gun if the pig can use
it. Constants are in `GUNS`, `BULLET` and `ENEMY`. Guesses: sight range, chase speed, enemy fire
rate, the dead-sprite pose, and the melee mafia's instant kill. Rooms without a player start the pig
near the centre, 64px clear of enemies.

Step 6 is done. Once no enemy or knocked-out body is left, the room's objNextroom shows an arrow,
and walking onto it loads the next room in the game's room order (verified rmFansLevel1Floor1 →
rmFansLevel1Floor2). The player keeps position, weapon and ammo, and the exit you arrive on stays
off until you step away. The mafia's chase and fire timing now come from the exe: they close in to
120px, back off under 32px, turn their aim 10° a step, and fire per gun (M16 every 6 steps).
Guesses: the arrow's direction frame and the elevator's ride. Not done yet: sound, pathfinding, the
other enemies.

Step 7 is done. Sound effects play from the data wad at the exe's volumes (`web/audio.js`; swings,
hits, doors, pickups, guns, floor cleared). Level music streams from the 488 MB music wad with HTTP
Range reads (`server.js` answers HEAD and 206), so only the one track is fetched; `MUSIC` in
`web/game.js` holds each scene's first room and track from the scene setters 0x8d6f00/0x11c5bf0.
The elevator (objElevator) now rides: on a clear floor, stepping in shuts the doors, pulls the player
to its centre, waits 25 steps and goes to the next floor, where the player arrives in the matching
elevator (`ELEVATOR`). The gang (objEGang*) runs the mafia AI with its own weapons: Random/Static
swap their gun for an Uzi, shotgun or 9mm, MeleeRandom picks a knife, chain, pipe or bat
(`ENEMY_SWAP`); the Uzi fires every 3 steps, the gang 9mm every 20. Idle gang and mafia stand still
but can be knocked out and killed. Guesses: the elevator pull direction sign; the idle enemies'
behaviour is not read.

Step 8 is done. Enemy pathfinding follows the exe's mp_grid setup (grid builder in
`re/ghidra/out/d19t.c`): 16-px cells blocked by objSolid, objFurniture and objElevator; the goal
is the first free cell on rings of 1, 6 and 11 px around the player (8 angles, random start,
0x42c900); the path is made again every 20 steps and walked at 2.5 px/step without collision, as
`path_start` does (`PATH`, `gridPath`, `pathTo`, `followPath` in `web/game.js`). An unarmed enemy
runs straight in when it sees the player and the step is free, else follows the path. Idle enemies
(objEGangIdle*, objEMafiaIdle*) check sight every 15 steps and, on sight, turn into their alert
type with the weapon they carry (`IDLE.become`). Fat enemies (objE{Gang,Mafia}Fat) have 5 HP, one
per bullet; once hurt they bleed out after 100 steps (`FAT`). Test rooms: rmFansLevel1Floor2
(idle smoker, path round the wall), rmFansLevel1Floor2Hard (Fat). Guesses: the Fat ignores melee
knockouts; the idle money bag is not dropped yet.

## Run

```bash
node server.js "C:/Program Files (x86)/Steam/steamapps/common/Hotline Miami 2"
```

Open http://127.0.0.1:8077. With a game folder given, the page fetches the wad from
`/game/` by itself. Without one, use **Load .wad**. Either way the wad is kept in the
browser's IndexedDB, so each device needs it only once. To reach the server from other
machines set `HOST=0.0.0.0`, and keep that private (LAN or Tailscale only).

Online: https://agames21.github.io/hlm2-web/ (GitHub Pages, deployed from `web/` on every
push to `main` by `.github/workflows/pages.yml`). It holds code only, so each device loads
its own wad with **Load .wad**.

## Layout

| Path | What |
| --- | --- |
| `web/` | The site: `agar.js` (wad reader), `tables.js` (format decoders), `app.js` (viewer), `game.js` (play mode) |
| `server.js` | Static server, plus optional private `/game/*.wad` |
| `tools/` | Python twins used to work out the formats (`wad.py`, `formats.py`, `meta.py`, `peek.py`, `rooms_probe.py`) |
| `_extract/` | Local extraction of the data wad for analysis. Never publish it |
| `re/` | Copy of the exe and the REA/Ghidra snapshot. Never publish it |

## Engine facts

HLM2 on PC runs Abstraction Games' own C++ engine, with the original GML transpiled to C++.
It is not GameMaker: there is no `data.win`, and GameMaker decompilers don't work on it. The
data is GameMaker-shaped (rooms, objects, sprites, depth), so the room logic maps over
cleanly, but the gameplay code exists only as native code in `HotlineMiami2.exe` (no PDB).

## File formats (all little endian)

**AGAR .wad**: `"AGAR"`, u32 major, u32 minor, u32 extra_len, then extra bytes. Next comes
u32 file_count, then per file u32 name_len, name, u64 size, u64 offset. Then u32 dir_count,
then per dir u32 len, name, u32 n, and n × (u32 len, name, u8 type). File offsets are
relative to the end of these tables.

**GL tables** (`sprites`, `objects`, `backgrounds`): u32 n, i32 lookup[n] (id → record
index), u32 count, fixed i32 records, then u32 strtab_size and null-terminated names.
- sprite, 16 words: id, w, h, origin x, origin y, bbox left, right, top, bottom, frame count,
  …, name offset at word 14
- object, 11 words: id, sprite id, depth, parent, mask sprite (-1 = own sprite), solid,
  visible, ?, ?, ?, name offset
- background, 8 words: id, name offset, ?, tile w, tile h, tileset flag, image w, image h

**hlm2_rooms.bin**: u32 n, i32 lookup[n], u32 c, i32 order[c], u32 room_count, the rooms,
then the strtab. Each room has these parts:
- 20-byte header: u16 id, w, h, speed, ?, ?, then u32 colour (BGR) at byte 12
- 8 views × 28 bytes
- u32 nt, then tiles of 16 bytes: i16 x, y, u16 background id, src x, src y, w, h, i16 depth
- u32 ni, then instances of 12 bytes: u16 id, ?, ?, object id, i16 x, y
- u32 8, then 8 × 20-byte room backgrounds (not decoded yet)
- u32 name offset

**hlm2_level_atlases.bin**: u32 n, i32 name_off[n], u32 strtab_size + names, then
u32 m and i32 lookup[m] (room id → name index). The name picks `Atlases/Levels/<name>.meta`.
More tables follow that the viewer doesn't use.

**.meta (AGTEXTUREPACKER)**: u8-length magic, u32 version, u32 count, then entries of
u8-length name, u32 frames, and frames of (i32 page, w, h, x, y, f32 u0, v0, u1, v1). The
x, y, w, h are pixel rects in the matching `.png`; every atlas is one page. Sprite names map
directly. A tileset is named `Backgrounds/<background name>`, and a tile's source is the
frame's x, y plus the tile's src x, src y.

**Drawing**: sort tiles and instances together by depth, higher first. A sprite is drawn
at the instance position minus the sprite origin from `sprites.bin`. Lighting objects such
as `objPiglight1` are blended in-game, so the viewer hides them by default.

**hlm2_collision_masks.bin**: u32 n, then n records of u32 sprite id, row stride (bytes),
w, h, frames, followed by frames × h rows of 1-bit pixels, high bit first. Sprites without a
record collide with their bbox.

**Collision**: walls are instances whose object descends from `objSolid` (id 84; `objWall`
and the brick, rail and window walls). Doors are not solid. Every `objPlayer` child uses the
mask `sprMask` (24×24, origin 12,12, fully solid).

## Exe notes (`re/py/`)

- `exe.py`: capstone helpers (VA ↔ file offset, `show`, `ann`, `find_imm`).
- `gl.py`: GL table loader. `sprite_globals()` reads the asset registration run at
  0x12093b2–0x121e47b, which stores every sprite id in a 16-byte GML value global
  (`push id; call 0x435c10` or `mov ecx,[0x19ba408]; push id`, then `mov ecx, G; call
  0x12a1430`). Code refers to sprites only through these globals, so xref the global, not the id.
- A GML value is 16 bytes: double or pointer at +0, type at +8 (2 and 3 are ref-counted).
- The `ctrl_move_*` strings feed the key-binding table at 0x199c140 (13 actions: up, left,
  down, right, attack, …, lock_on); they are engine input names, not gameplay code.
- `cg.py`, `callees.py`, `consts.py`: call graph, direct callees and float constants of a function.
  Ghidra runs read-only against the saved project with `re/ghidra/run.sh Script.java in out`
  (scripts in `re/ghidra/scripts/`, about 4 minutes per run).
- **Object handler table** at 0x1987640: 5 slots × 2414 objects, block-major
  (`table[slot*2414 + objId]`, getter 0x438ca0). Slot 0 is the key map, slot 1 the event lookup
  `(type, subtype)` (falls back to the parent's), slots 2–4 per-object events. objPlayer is 36,
  objPigButcher 35 (parent objPlayer; step 0xa5f870).
- Keyboard builtins 0x12c0b60 / 0x12c0c40 / 0x12c0d20 go through slot 0. objPlayer's key map
  0x436720: W 0, S 1, A 2, D 3, Shift 4, Space 9. 0x41a640 is a global-variable lookup, not input.
- Instance variables live at `inst + 0x28 + slot*16`; the slot for a var id is cached at
  `*(inst+0x20) + id*2` and assigned on first use.
- **Movement script 0x115c060** (called from the step): walk speed 3, or 1.5 for
  sprNickeWalkJacket / sprRatWalkMom and 2.25 for sprHenchmanWalkBag. A held key adds ±0.5 per
  step up to the walk speed; with no key on an axis the speed moves 0.5 toward 0 (snaps to 0 inside
  0.5). Then `while abs(hs)+abs(vs) > walk+2: hs *= 0.98; vs *= 0.98` (0x5511a0 is abs), so a
  diagonal settles near 2.47 per axis.

- **Doors** objEditorDoorV (25, step 0x6ef0b0, create 0x6eba70: x += 4) and objEditorDoorH
  (26, step 0x6e86c0). A push from the player or an NPC sets the swing speed to ±8 (±7 for H) unless
  it already exceeds 3.5. Each step: angle += speed; on a wall hit revert and speed *= −0.5;
  clamp ±135; snap shut inside ±6° below speed 3.5; friction 0.25. Only player-pushed doors knock
  enemies down. The H door's +4 y offset and the exact push-sign rule are guesses.
- **Attack** (decompiled in `re/ghidra/out/d7t.c`): scrIsAttacking 0xfab280 only narrows the hit
  window for nunchucks and karate, so the punch is active for its whole animation. Execution code
  is scrExecute 0xf4b2f0 / scrSpaceAction 0xfc7260 (not ported).
- **Knockout**: speed 2 + random(2) along the hit direction, friction 0.15, alarm 120 +
  random(100), then the GetUp sprite at 0.25 per step. Screen shake 2.
- **objVictim1** (40): alert within 96, cowers (Idle2) within 29, runs at speed 2.
- **Weapons** (`re/ghidra/out/d5t.c`, `d8t.c`): scrPigAttack sets image_speed 0.35, cooldown 30,
  start frame Punch 1, Hammer/Stick/Taser 3, Bat 4. scrPickupThrow scales the mask by 3 to find an
  objWeapon (parent 145); scrPickup 0x1157500 calls scrThrow 0x11d3830 first. scrThrow creates the
  weapon at speed 12 along the aim; objWeapon's step sets friction 0.25 and spins image_angle by
  speed*3; at speed 5 or more it knocks an enemy down and keeps 0.2 of its speed.
- **Executions**: scrSpaceAction 0xfc7260 scales the mask by 2 to find an objKnockedOut and creates
  the kill at the body, angle + 180. scrPigKillStart 0xf39380 picks sprPigKill{Hammer,Bat,Stick},
  else Stomp. scrExecute 0xf4b2f0 picks the body's KillBlunt for blunt weapons, else KillStomp.
  scrPigKillAnim 0x1150350 puts the player back with the same weapon (Hammer: 4px along angle + 90).

- **Guns** (`re/ghidra/out/d9t.c`): ammo is var 15 (slot cached at `+0x1e`), set by obj9mm 0x451ad0,
  objShotgun 0xc22910, objDoubleBarrel 0x6d1180. A shot creates objBullet (147) at the muzzle, aim −
  spread + random(2 × spread). The double barrel fires only from its walk sprite, offset 6px by
  var 23 × 90°. objBullet step 0x550bd0 destroys it 100px outside the room; its wall collision
  0x54f550 spawns an effect and destroys it.
- **Mafia** (`d9t.c`, `d10t.c`): objEMafiaRandom create 0x754c50 swaps an M16 for a random M16,
  Shotgun, DoubleBarrel or Kalashnikov. Step 0x74d0b0 bounces off walls 3 steps ahead and calls the
  obstacle avoider 0xd96830 (turns 18° at a time). Alarm 0 0xe8bc00: 60 + random(60) steps, direction
  random(360), speed round(random(1)), image speed speed × 0.1. The alert step 0x11a9000 re-checks
  sight every 15 steps (var 88) and switches on state var 31 (0 calm, 1–2 alert, 3 search, 4+);
  Chase (seeing, armed): motion_add 0.25 toward the player up to speed 3 beyond 120px, brake 0.25
  within it, back off 1.5 under 32px, aim turns 10° a step. Unarmed or searching: straight at 2.5/3.
- **Enemy fire** 0xee5fa0 (`d13t.c`): per sprite branch, counter var 65 counts down, then fires and
  resets it: M16/Kalashnikov 5 (shake 3, spread ±10, speed 12 + random(4), bullet at 26px), Silencer
  10 (shake 2), DoubleBarrel 15 (shake 6), Shotgun 60 (shake 6, 8 pellets ±6). Var 63 drops per shot.
- **Exits** (`d11t.c`, `d12t.c`): objNextroom (sprite sprMask, depth −101) draws sprArrow 0x9387f0
  with frame var 37 (0–3, from vars 32/36) 32px out by lengthdir; room start sets sprGreyArrow on
  matching exits. objElevator step 0x76a430: with no objEnemy or objKnockedOut left and the player on
  sprElevatorFloor, image_index rises 0.25 a step to 14 (doors open), then objLoadLevel; not fully read.
  Next room is `room_goto_next`, i.e. the second index array of `hlm2_rooms.bin`.

## Not decoded yet

- The room background entries and the view fields
- `hlm2_atlases.bin`, `collision_events`, `fonts`
- Execution sounds, wall bounce of thrown weapons, level-end screens, the idle money bag, and every
  enemy except objVictim1, the mafia, the gang and their Idle*/Fat kinds
