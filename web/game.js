// Play mode: the player walks a room with wall collision, top-down camera and
// mouse aim. Collision follows GameMaker: walls are objSolid descendants and
// collide with their mask sprite's 1-bit mask (or its bounding box), the
// player with sprMask (24x24, centred).
//
// MOVE comes from the player's movement script in the exe (0x115c060, called
// from objPigButcher's step): walk speed 3 (1.5 when carrying a body, 2.25 for
// the henchman's bag), +-0.5 per step while a key is held, 0.5 friction per
// step on release, then both speeds shrink by 0.98 while |hs|+|vs| exceeds
// walk speed + 2, which caps diagonals. animSpeed is still a guess.
import { drawRoomItems } from './render.js';
import { loadFont, drawText, textWidth } from './score.js';
import { options, gameKey } from './settings.js';
import { TALKS, TALKERS } from './conversations.js';
import { conversation, TALK } from './dialogue.js';
import { DATES } from './dates.js';
import { SON_BOSS_WHO, sonBossDefinitions, stepSonBoss, hitSonBoss } from './bosses.js';

// Date card (objDate), measured against native frames at 480x270: a near
// black veil, the time in fntTime red at y 100, a white rule at 135 and the
// date and place in fntDate under it. The time slides in from above and the
// text from below (offset 120 down by 7 a frame), then the rule reaches full
// width; it holds, then slides out twice as fast while the veil fades.
export const DATE_CARD = { veil: 0.96, time: 100, rule: 135, ruleW: 107, text: 140, line: 12, from: 120, in: 7, hold: 100, out: 14, fade: 0.11,
  clock: 'rgb(255,30,30)' };
// Month names and day suffixes as the exe builds them (months are 0-based).
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const daySuffix = d => ({ 1: 'ST', 2: 'ND', 3: 'RD', 21: 'ST', 22: 'ND', 23: 'RD', 31: 'ST' })[d] || 'TH';
export const dateLine = (y, mo, d) => `${MONTHS[mo]} ${d}${daySuffix(d)}, ${y}`;

export const MOVE = { accel: 0.5, maxSpeed: 3, friction: 0.5, diagSlack: 2, diagScale: 0.98, animSpeed: 0.25 };
const VIEW_W = 480, VIEW_H = 270, STEP_MS = 1000 / 60;

// Melee, from objPigButcher's step 0xa5f870 and its mouse handler 0xa5f430:
// a punch sets sprPigAttackPunch at image_index 1, image_speed 0.35 and a
// 30-step cooldown. While an attack sprite plays, an enemy is hit when the
// player's mask overlaps it either where the player stands or pushed 12px
// along the aim. An unarmed enemy is knocked out (scrKnockOut 0xee2c40).
export const MELEE = { imageSpeed: 0.35, startFrame: 1, cooldown: 30, reach: 12 };
// scrKnockOut and objKnockedOut (80): the body slides off at random(2)+2
// with friction 0.15, lies still for random(100)+120 steps, then plays the
// get-up at image_speed 0.25 and turns back into the enemy, walking.
export const KO = { speedMin: 2, speedRand: 2, friction: 0.15, waitMin: 120, waitRand: 100, getUpSpeed: 0.25, shake: 2 };
// objVictim1 (40) step: alert within 96px, then run at speed 2 for the spot
// 24px below the door nearest (512, 69); cower (sprVictim1Idle2) within 29px.
export const VICTIM1 = { alert: 96, cower: 29, speed: 2, walkSpeed: 0.25, cowerSpeed: 0.2, idleSpeed: 0.15, target: [512, 69], targetDy: 24 };
// The first level's upstairs (rmTutorialFloor2). objVictim45Idle (105) is
// the couple on the bed: its step (0xc37200) counts var 21 down, then makes
// objVictim4 at y-12 and objVictim5 at y+12 and destroys itself; at the end of
// each loop (0xc37180) it picks choose(Idle1, Idle1, Idle1, Idle2). What
// starts the count is not read: here it is the player in sight within `near`
// px, or any hit on them. objVictim4 (the man) and objVictim6 (the hall) share
// the step 0x765de0, which plays sndPunch; it is not read. The man runs here as
// an unarmed chaser. The hall man spawns a few steps from the player, so he
// stays put and idles (a guess); he has one dead pose, used for every death.
// objVictim5 (step 0xc38910) is not read either: she stays and idles. The
// Pig's execution of her is sprPigDeadGirl, one 60x40 sprite holding both (the
// size of sprVictim5Crawl); its last frame stays as the body. The room has no
// exit: once nobody in it is left alive (or down) the scene cuts to the next
// room in order (rmTutorialFloor2MovieSet) after `cut` steps (a guess at the
// controller, not read). As in play footage, the screen fades to black over
// `fade` steps and the Pig is left alone in a red glow until the cut.
export const COUPLE = { obj: 'objVictim45Idle', imageSpeed: 0.15, near: 96, idle: ['sprVictim45Idle1', 'sprVictim45Idle1', 'sprVictim45Idle1', 'sprVictim45Idle2'],
  split: [['objVictim4', -12], ['objVictim5', 12]], cut: 170, fade: 50, glow: 90 };
// rmTutorialFloor2MovieSet: the "CUT!" scene. The room sits above the film
// set; objDirector (416,-144) walks down into it while the camera follows,
// then the camera settles on the set and the rest of the talk plays. The Pig is not seen.
// Speed, stop row and set centre are read off play footage, not the code
// (centre re-measured against the native game on 2026-10-26).
export const FILM_SET = { obj: 'objDirector', walk: 'sprDirectorWalk', speed: 1, imageSpeed: 0.2, stopY: 104, centre: [476, 160], ease: 0.04, after: 30,
  // GUESS: frames from his stop to the second talk (native pans first, about 1.5 s).
  panWait: 90 };
// The rooms left at GameMaker's default colour (0xC0C0C0) have no backdrop
// object; the game shows a slow purple and teal wash there instead (footage).
// How far from its car the player starts (a guess from footage).
export const CAR_EXIT = 40;
const LAYER_PAD = 64;
// The score HUD as the native view shows it (480x270): right-aligned at
// x 455, glyph tops at y 20, about 12px of face. The face and its 1px step
// are vertical gradients over `band` (glyph top to bottom on screen): pale to
// full cyan, and magenta to red.
// The kill combo, from the exe: each kill bumps the count (global +0x10b0) and
// resets a 180-step timer (+0x51b0); when it runs out with two or more kills,
// n*(n-1)*250 is added to the score (+0x16b0) and an "<n>xCOMBO" popup rises
// 24px above the player. While it runs the HUD shows "<n>x" in fntCombo; the
// exe draws it from a slide-in offset, so its screen spot here is a guess.
const COMBO = { time: 180, bonus: n => n * (n - 1) * 250, popupDy: 24, font: 'fntCombo', x: 8, y: 6 };
const SCORE_HUD = { font: 'fntPoints', x: 455, y: 18, scale: 1, band: [20, 32],
  face: ['#bfffff', '#2cffff'], shadow: ['#f0108a', '#fc0028'] };
// The wash cycles between two screen-space gradients, purple `a` and teal `b`
// (top and bottom colours, fitted to the two ends in native Down Under
// frames). A halo on the view centre brightens it by `halo.k` of the colour
// there, and a small grey-white core is added on the player.
export const WASH = { colour: 0xC0C0C0, period: 600,
  a: [[129, 1, 113], [34, 1, 29]], b: [[2, 139, 136], [0, 50, 48]],
  halo: { r: 260, k: 0.4 }, core: { r: 38, colour: [18, 16, 18] } };
export const VICTIMS = {
  objVictim4: { walk: 'sprVictim4Walk', attack: 'sprVictim4Punch', legs: 'sprVictim4Legs' },
  objVictim6: { dead: 'sprVictim6Dead' },
  objVictim5: { exec: { sprPig: 'sprPigDeadGirl' } },
  // scrVictim2 (0x11f44d0): fetches the bat within 22px, swings sprVictim2AttackBat;
  // the 22/64 distances match the unarmed fetch (0xf4e710), so it runs that.
  objVictim2: { walk: 'sprVictim2Walk', idle: 'sprVictim2Idle', legs: 'sprVictim2Legs', arm: 'Unarmed' },
};
// objEditorDoorV (25) / objEditorDoorH (26): touching a door sets its swing
// to +-8 (+-7 for H) degrees a step unless it already turns faster than 3.5.
// It turns by that each step, bounces off walls at half speed, stops at
// +-135, snaps shut below 3.5 within 6 degrees of closed, and loses 0.25 a
// step. A door the player swung knocks out an enemy it touches.
export const DOOR = { pushV: 8, pushH: 7, maxPush: 3.5, length: 32, limit: 135, snap: 6, friction: 0.25, bounce: -0.5 };
// Melee weapons, from scrPigAttack: each swaps the walk sprite for its own
// (sprPigWalkBat ...) and swings sprPigAttack<name> at image_speed 0.35 from
// the frame below.
export const ARMS = { Bat: { frame: 4 }, Hammer: { frame: 3 }, Stick: { frame: 3 }, Taser: { frame: 3 } };
// Guns, from scrPigAttack's gun branches and the gun objects' create events
// (ammo is var 15: obj9mm 0x451ad0 15, objShotgun 0xc22910 6, objDoubleBarrel
// 0x6d1180 2). A shot costs one round, shakes the screen, and creates objBullet
// (147) `muzzle` px along the aim, each pellet at aim - spread + random(2*spread)
// and speed + random(speedRand). The double barrel also shifts 6px sideways
// (by var 23 * 90 degrees) and only fires from its walk sprite. When the muzzle
// is inside a wall the exe hits what is in front directly instead.
// The double barrel's alternating barrel (var 23, Attack1/Attack2) is a guess.
// Guns hung on a wall (objShotgunWall, no parent): the create 0xb99bb0 sets
// the ammo to 2 and the draw 0x9b1690 is a shadow plus the sprite; it has no
// step, so the player's pickup takes it like a loose gun of that kind.
export const WALL_GUNS = { objShotgunWall: { name: 'Shotgun', ammo: 2 } };
export const GUNS = {
  '9mm': { ammo: 15, imageSpeed: 0.5, cooldown: 14, shake: 6, pellets: 1, spread: 6, speed: 12, speedRand: 4, muzzle: 26, sound: 'snd9mm' },
  Shotgun: { ammo: 6, imageSpeed: 0.5, cooldown: 30, shake: 6, pellets: 8, spread: 6, speed: 12, speedRand: 4, muzzle: 26, sound: 'sndShotgun' },
  DoubleBarrel: { ammo: 2, imageSpeed: 0.35, startFrame: 1, cooldown: 12, shake: 4, pellets: 12, spread: 8, speed: 10, speedRand: 2, muzzle: 24, side: 6, sound: 'sndDoubleBarrel' },
};
// The Fans, picked on objMaskMenu (menu.js MASKS). Their sprites are named
// like the Pig's except as listed: `punch` cycles through attack sprites,
// `stomp` is the execution, `noPickup` makes right click do nothing.
// Tony (objPlayerTiger): punches kill and he takes no weapons (known game
// behaviour; his handlers are not read).
// Corey (objPlayerZebra): space handler 0xa29490 rolls when not rolling and
// the cooldown (var 0x492) is out: sprZebraRoll, cooldown 30, counted down
// each step. The bullet collision 0xab5400 ignores bullets while the sprite
// is sprZebraRoll below image_index 19, so the whole roll. Roll speed and
// image speed are not decoded (guesses). A body in reach is executed first.
// Alex & Ash (objPlayerSwanChainsaw): the chainsaw kills (guess, as Tony);
// Ash's gun follower is not ported.
// Mark (objPlayerBear): right click 0xa18ff0 sets var 0x7e (taken to be the
// arm spread) while he walks with his special sprites; otherwise the normal
// pickup. Body sprBearWalkSpecial plus two sprBearArm. The MP5 stats, the
// 64 rounds (alarms 1/2 use 64), the shoulder offset and spreading the arms
// to the sides are guesses.
export const FANS = {
  objPlayerTiger: { lethal: true, noPickup: true, punch: ['AttackPunch1', 'AttackPunch2'], stomp: 'Kill' },
  objPlayerZebra: { stomp: 'KillBash', roll: { sprite: 'sprZebraRoll', cooldown: 30, invulnerable: 19, speed: 4, imageSpeed: 0.5 } },
  objPlayerSwanChainsaw: { lethal: true, noPickup: true, punch: ['AttackChainsaw'], stomp: 'KillChainsaw1' },
  // Jake's masks and the Son's styles (menu.js PICKERS). What each does is read
  // from the menus' own notes (string ids 3051..3062), not from the player
  // code: Jake's throws kill; Irvin starts armed (the gun is a guess: the first
  // of 9mm/Shotgun Jake has sprites for); Dallas takes no weapons, and his fists
  // killing like Tony's is a guess. The Son's first style rolls (sprSonRoll, the
  // roll numbers copied from Corey's), the second kills with punches and takes
  // no weapons, the third fires every gun twice (a guess at "firepower").
  'objPlayerCobra:0': { lethalThrow: true },
  'objPlayerCobra:1': { start: ['9mm', 'Shotgun'] },
  'objPlayerCobra:2': { lethal: true, noPickup: true },
  'objSon:0': { roll: { sprite: 'sprSonRoll', cooldown: 30, invulnerable: 19, speed: 4, imageSpeed: 0.5 } },
  'objSon:1': { lethal: true, noPickup: true },
  'objSon:2': { doubleFire: true },
  // Evan (objWriter): scrPickup checks his var 0x80 (raised only by the lethal
  // sprWriter2 kills) and below 2 plays sprWriterDisarm<gun> at image speed 0.5
  // instead of arming. Ported as never arming a gun: the gun is gone after the
  // animation (a guess; the game drops parts). His executions use the
  // non-lethal sprWriterKillPunch / Kill<weapon>2 and leave the body
  // unconscious for good; it counts as cleared (guess). The lethal "lost it"
  // mode is not ported.
  objWriter: { nonLethal: true, disarm: true, stomp: 'KillPunch' },
  objPlayerBear: { stomp: 'Stomp', special: { walk: 'sprBearWalkSpecial', arm: 'sprBearArm', shoulder: 9, flash: 3, label: 'MP5 x2',
    gun: { ammo: 64, imageSpeed: 0, cooldown: 4, shake: 3, pellets: 1, spread: 6, speed: 12, speedRand: 4, muzzle: 33, sound: 'sndMP5' } } },
};
// objBullet (147): flies straight and is destroyed on a wall (0x54f550) or
// 100px outside the room (step 0x550bd0). Hitting an enemy kills it outright
// (Enemy_col_bullet 0x762a60, not decoded: the dead sprite choice is a guess).
export const BULLET = { margin: 100 };
// Mafia (objEMafiaRandom: create 0x754c50, step 0x74d0b0, alarm0 0xe8bc00). A
// Random mafia holding an M16 swaps it for a random M16, Shotgun, DoubleBarrel
// or Kalashnikov. Calm, alarm 0 fires every 60 + random(60) steps and picks a
// direction random(360) and speed round(random(1)), animating at speed * 0.1;
// it turns back on an axis when place_free fails 3 steps ahead. It re-checks
// what it can see every 15 steps (var 88) and then goes alert.
// Alert and armed, it runs the chase state (0xdc68c0): beyond 120px it
// motion_adds 0.25 toward the player (speed capped at 3) aiming straight at
// them; inside 120px it brakes 0.25 a step, and once stopped it backs off 1.5
// a step when closer than 32 and turns its aim 10 degrees a step (0x1175ca0).
// It fires (0xee5fa0) while var 17 is 0; the gun's own counter (var 65) then
// makes it wait `cooldown` steps between shots.
// With a melee weapon it runs in at 2.5 and swings.
// Unarmed (any *WalkUnarmed sprite, 0xfad250) the step skips the states and
// runs 0xf4e710 (ENEMY.unarmed): it goes for the nearest weapon on the floor
// that is moving under 2 (straight at 2.5, image speed 0.2, when the line is
// clear, else by path) and takes it within 22 (sndPickUpWeapon, the weapon is
// destroyed). With no weapon it stops and turns its aim 10 degrees a step
// toward the player beyond 64px, and inside 64 steps 1px toward them (x and y
// each only if free). It never punches.
// The gang (objEGang*) runs the same step (0x74d0b0) and draw; only the
// creates differ. objEGangRandom (0x74cfc0) and objEGangStatic (0x74e190) swap
// a 9mm or Uzi for choose(Uzi, Shotgun, 9mm); objEGangMeleeRandom (0x74b580)
// always takes choose(Knife, Chain, Pipe, Bat). The Idle* gang and mafia
// (create 0x748610, step 0x7488c0) are not read: they stand still here.
// Sight (0x42d8e0, re-run every 15 steps from the step 0x11a9000): the
// player is seen within 260px along a line walked in 8px steps (160px when a
// global at +0xa90 is 18, not identified; left out). Within 22px of a weapon
// the unarmed chaser picks it up (sndPickUpWeapon); it is not a hit.
// Melee (step 0x11a7660 for *MeleeRandom, 0x11a43e0 Patrol): chasing within
// 22px with its cooldown (30 steps) done, it swings: attack sprite from frame
// 1 at image_speed 0.5 and a swing sound. On every step of the swing
// (scrIsAttacking is true for the whole animation) it kills a player who is
// not rolling (0xfacd80) and whose mask holds the point 8px ahead of it or
// its own spot; 0xee3f10 marks that death as melee.
// Still a guess: the search after losing the player (straight at the last spot).
// Sounds (sound_play 0x12c97c0 takes the sound's GML global; ids from the
// registration run, names and volumes from hlm2_sounds.bin). Guns carry
// their own in GUNS/ENEMY_GUNS (0x1116c70 player, 0xee5fa0 enemy branches).
// scrPigAttack plays choose(sndSwing1, sndSwing2) as any melee swing starts;
// scrCombat plays sndPunch for a fist and sndHit for a weapon; a thrown
// weapon hitting plays sndWeaponHit (0xc7fae0) and a door sndDoorHit.
// Which sndHit/sndPunch branch of scrCombat matches which weapon is not fully
// read. Executions: the execution sounds are not read either; here sndHit
// plays as the execution starts and on each new frame of the body's kill
// sprite (one per blow), sndPunch once for a non-lethal one.
// objPigKillStomp/objPigKillBlunt (0xa62510, 0xa610d0) play sndPunch and
// sndHit together on a blow; here both play once as the execution starts.
// objLevelCleared's create (0x8b2d10) plays sndLevelComplete.
export const SOUND = { exec: 'sndHit', execThud: 'sndPunch', levelComplete: 'sndLevelComplete', swing: ['sndSwing1', 'sndSwing2'], punch: 'sndPunch', hit: 'sndHit', thrown: 'sndWeaponHit',
  door: 'sndDoorHit', doorOpen: 'sndDoorOpen', pickup: 'sndPickUpWeapon',
  // The pickup (0x11d30f0) plays sndDrawKnife on its blade branches; which weapons take them is a guess.
  drawKnife: 'sndDrawKnife', blades: /^(Knife|Machete|Machette|Sword|Shard)$/, throw: 'sndThrow', cleared: 'sndFloorCleared' };
// Level music: the scene setters 0x8d6f00 (normal) and 0x11c5bf0 (hard) give
// each scene its first room and track ("\Name.mp3", played from
// Music/Name.ogg). Their second branch, the story start with its cutscene
// track, is left out. A room plays the track of the last scene start at or
// before it in room order, normal and Hard rooms apart; a Hard room without
// its own entry uses its normal twin's. The police station track is empty in
// the normal setter and taken from the hard one.
export const MUSIC = [
  ['rmTutorialFloor1', 'Detection'], ['rmFansLevel1Floor1', 'voyager'], ['rmMallFloor1', 'Technoir'],
  ['rmNewsPaperFloor1', 'Divide'], ['rmPoliceStationFloor1', 'Videodrome'], ['rmCasinoFloor1', 'NewWave'],
  ['rmFansLevel3Floor1', 'evil'], ['rmHenchmanLevel1Floor1', 'Remorse'], ['rmFansLevel2Floor1', 'Sexualizer'],
  ['rmJungle1', 'Rust'], ['rmJungle1Hard', 'Delay'], ['rmSewersEntrance', 'voyager'], ['rmBoatDock', 'Bloodline'],
  ['rmFansLevel5Floor1', 'RollerMobster'], ['rmSubwayPlatform', 'Run'], ['rmDayJungle1', 'HotlineTheme'],
  ['rmMethLabFloor1', 'Quixotic'], ['rmPowerPlant1', 'WayHome'], ['rmRatLevel1Floor1', 'Dubmood'],
  ['rmRatLevel2Floor1', 'NARC'], ['rmRatLevel3Floor1', 'Rumble'], ['rmPrisonFloor1A', 'Interlude'],
  ['rmStripClubEntrance', 'BurningCoals'], ['rmBankEntrance', 'Interlude'], ['rmNightmarePoliceOffice', 'SlumLord'],
  ['rmSonMansionFloor1', 'FutureClub'], ['rmLSDIntro', 'Interlude'], ['rm50Blessings1', 'AbyssIntro'],
];
export function musicFor(rooms, room) {
  const start = new Map(MUSIC), names = new Map(rooms.list.map(r => [r.id, r.name]));
  const hard = room.name.endsWith('Hard');
  let track = null;
  for (const id of rooms.order) {
    const name = names.get(id) || '';
    if (name.endsWith('Hard') === hard) track = start.get(name) ?? start.get(name.replace(/Hard$/, '')) ?? track;
    if (id === room.id) return track;
  }
  return null;
}

export const ENEMY = { wanderMin: 60, wanderRand: 60, wanderAnim: 0.1, ahead: 3, recheck: 15,
  accel: 0.25, maxSpeed: 3, hold: 120, near: 32, backOff: 1.5, turn: 10,
  chaseSpeed: 2.5, melee: 22, legsSpeed: 0.2, sight: 260,
  swing: { image: 0.5, start: 1, cool: 30, ahead: 8 },
  unarmed: { run: 2.5, image: 0.2, take: 22, slow: 2, near: 64, creep: 1 },
  guns: ['M16', 'Shotgun', 'DoubleBarrel', 'Kalashnikov'] };
// The "Easier enemies" option (on by default, not in the original): gunmen wait
// twice as long before the first shot, turn their aim slower and fire 25% less often.
// Port option, not in the game: melee ones also run a bit slower and wait before their first swing.
export const EASY = { firstShot: 30, turn: 7, cooldown: 1.25, chase: 0.85, swingCool: 1.5 };
const firstShot = () => options.easier ? EASY.firstShot : ENEMY.recheck;
// Create-time weapon swaps: object -> [held weapon that is swapped (null:
// always), choices].
export const ENEMY_SWAP = {
  objEMafiaRandom: ['M16', ENEMY.guns],
  objEGangRandom: ['9mm', ['Uzi', 'Shotgun', '9mm']],
  objEGangStatic: ['Uzi', ['Uzi', 'Shotgun', '9mm']],
  objEGangMeleeRandom: [null, ['Knife', 'Chain', 'Pipe', 'Bat']],
  // Faction creates 0x6063f0, 0x803990, 0x759110, 0x9ab820 (0xb44070 always
  // keeps the Kalashnikov).
  objColombianRandom: ['Mendoza', ['Mendoza', 'Shotgun', 'Famae', 'Silencer']],
  objGuardRandom: ['Magnum', ['Magnum', 'Shotgun']],
  objEPoliceRandom: [null, ['9mm', 'Shotgun']],
  objPrisonerRandom: ['Magnum', ['Magnum', 'Shotgun']],
};
// Enemy guns, from 0xee5fa0's per-sprite branches: steps between shots (var
// 65), screen shake, and bullets at 26px, aim +-spread, speed 12 + random(4).
const ENEMY_GUNS = {
  M16: { ...GUNS['9mm'], cooldown: 5, shake: 3, spread: 10, sound: 'sndM16' },
  Kalashnikov: { ...GUNS['9mm'], cooldown: 5, shake: 3, spread: 10, sound: 'sndKalashnikov' },
  Silencer: { ...GUNS['9mm'], cooldown: 10, shake: 2, spread: 10, sound: 'sndSilencer' },
  '9mm': { ...GUNS['9mm'], cooldown: 20, shake: 6, spread: 6, sound: 'snd9mm' },
  Uzi: { ...GUNS['9mm'], cooldown: 3, shake: 6, spread: 6, sound: 'sndUzi' },
  Shotgun: { ...GUNS.Shotgun, cooldown: 60, shake: 6 },
  DoubleBarrel: { ...GUNS.DoubleBarrel, cooldown: 15, shake: 6, spread: 10 },
  Famae: { ...GUNS['9mm'], cooldown: 5, shake: 3, spread: 10, sound: 'sndFamae' },
  Mendoza: { ...GUNS['9mm'], cooldown: 5, shake: 3, spread: 10, sound: 'sndMendoza' },
  Magnum: { ...GUNS['9mm'], cooldown: 20, shake: 6, spread: 6, sound: 'sndMagnum' },
  // The soldier's Kalashnikov fires a step faster than the mafia's.
  SoldierKalashnikov: { ...GUNS['9mm'], cooldown: 4, shake: 3, spread: 10, sound: 'sndKalashnikov' },
  FatGun: { ...GUNS['9mm'], cooldown: 4, shake: 6, spread: 16, sound: 'sndMP5' },
  Hiding: { ...GUNS['9mm'], cooldown: 4, shake: 6, spread: 6, sound: 'snd9mm' },
};
// The Colombian, soldier, guard, police and prisoner steps (0x6064f0,
// 0xb440f0, 0x803a80, 0x7591a0, 0x9ab9a0) are the mafia step 0x74d0b0 with
// their own sprites (the guard's adds one early exit not read), so they all
// run stepMafia. Their weapon is the end of the walk sprite's name.
const FACTION = /^obj(E(Mafia|Gang|Police)|Colombian|Soldier|Guard|Prisoner)(Melee)?(Random|Patrol|Static)$/;
// Pathfinding. The room start (0xf9bcf0) makes an mp_grid of 16px cells over
// the room and adds, precisely, objElevator, objEditorWindow*, objFurniture
// (and so objGlassPanel), objSolid and one object not resolved yet (global
// 0x199d378), then the objEditorDoorV/H instances whose var is 1. An alerted
// mafia or gang (0x11a9000, state 4 and up) re-paths every 20 steps with
// 0x42c700 -> 0x42c900: end the running path, then try points 1, 6 and 11px
// from the player at 8 angles 45 degrees apart from a random start; the first
// free one is the goal of mp_grid_path, else the player's own point is. The
// path runs at 2.5. Here the doors are left out of the grid, the path is
// followed with wall collision, and a start cell that is blocked is allowed.
// objSlidingDoors and objSlidingDoorsDark are solid objSolid children with no
// events of their own, and nothing in the exe reads them past the object table,
// so they keep GameMaker's default image_speed 1: their 10 frames loop, and the
// precise mask (one per frame) opens a gap in the middle on most of them. Here
// they draw looping and block walking only where every frame is solid; the
// room-start mp_grid still sees frame 0.
export const SLIDING = { objects: ['objSlidingDoors', 'objSlidingDoorsDark'], imageSpeed: 1 };
export const PATH = { cell: 16, every: 20, speed: 2.5, rings: [1, 6, 11], angles: 8,
  objects: ['objSolid', 'objFurniture', 'objElevator'] };
// Idle gang and mafia (create 0x748610 / 0x751f20 / 0x602bd0 / 0x750fa0,
// steps 0x7488c0 0x748070 0x747b00 0x749620 0x7519f0 0x751370 0x752170):
// every 15 steps (the first after random(15)) they test the player; on sight
// they are replaced by an alerted armed enemy at the same spot and direction.
// IdleMoney also drops an objMoneyBag at +2, +8 (drawn here as a still
// sprMoneyBag; what the bag does is not read), and the silenced one sets var
// 15 to 12 on the new enemy (not read).
// The faction idles (creates 0x602bd0 0x7ff8d0 0x9a4dd0 0xb404d0, steps
// 0x603160 0x7ffb30 0x9a4fd0 0xb40730) test on the same 15-step timer and
// turn into their walk sprite (sprColombianWalkPipe, sprGuardWalkStick,
// sprSoldierWalkKalashnikov) in place. The prisoner with guns leaves an
// instance drawn with sprPrisonerIdleGunsBody and makes a new enemy from a
// global not resolved; a shotgun prisoner is a guess.
export const IDLE = { every: 15, imageSpeed: 0.15, leave: {
  objEGangIdleMoney: { sprite: 'sprMoneyBag', dx: 2, dy: 8, still: true },
  objPrisonerIdleGuns: { sprite: 'sprPrisonerIdleGunsBody', dx: 0, dy: 0 },
}, become: {
  objColombianIdlePipe: ['objColombianMeleeRandom', 'Pipe'],
  objGuardIdleStick: ['objGuardMeleeRandom', 'Stick'],
  objSoldierIdleRain: ['objSoldierRandom', 'Kalashnikov'],
  objSoldierIdlePonchoSmoke: ['objSoldierRandom', 'Kalashnikov'],
  objPrisonerIdleGuns: ['objPrisonerRandom', 'Shotgun'],
  objEGangIdlePipe: ['objEGangMeleeRandom', 'Pipe'],
  objEGangIdleKnife: ['objEGangMeleeRandom', 'Knife'],
  objEGangIdleMoney: ['objEGangRandom'],
  objEGangIdleSmoke: ['objEGangRandom'],
  objEMafiaIdlePipe: ['objEMafiaMeleeRandom', 'Pipe'],
  objEMafiaIdleSmoke: ['objEMafiaRandom'],
  objEMafiaIdlePhoneSilencer: ['objEMafiaStatic', 'Silencer'],
} };
// objEGangFat / objEMafiaFat (create 0x7468b0, steps 0x747090 / 0x750690,
// bullet collisions 0x7453d0 / 0x74f360): unarmed chasers with 5 HP (var 95).
// Each bullet takes one; at 0 they fall (sprE*FatDie, frame 1). Once hurt,
// var 97 counts down from 100 a step and at 0 they fall anyway. Melee and
// thrown weapons not knocking them over is a guess (the player's side is not
// read), as is the fall leaving a body that counts as dead.
// The soldier, police and prisoner fat steps (0xb3d4e0, 0x7ac4c0, 0x9a39f0)
// are the same code with their own sprites. objSoldierFatGun (create
// 0xb3c9a0, step 0xb3cc30) has the same 5 HP and bleed-out but carries a gun:
// 0xee5fa0's sprFatSoldierWalkGun branch fires every 4 steps, shake 6, aim
// +-16, sndMP5. Its own chase routine 0x11a02e0 is not read; it runs the
// mafia AI here.
export const FAT = { hp: 5, bleed: 100, kinds: {
  objEMafiaFat: {}, objEGangFat: {},
  objSoldierFatKnife: { walk: 'sprFatSoldierWalkKnife', attack: 'sprFatSoldierAttackKnife', legs: 'sprFatSoldierLegs', die: 'sprFatSoldierDying' },
  objSoldierFatGun: { walk: 'sprFatSoldierWalkGun', attack: 'sprFatSoldierAttackGun', legs: 'sprFatSoldierLegs', die: 'sprFatSoldierDying', gun: 'FatGun' },
  objFatPolice: { walk: 'sprFatPoliceWalk', attack: 'sprFatPoliceAttack', die: 'sprFatPoliceDying' },
  objPrisonerFat: { walk: 'sprPrisonerWalkFat', attack: 'sprPrisonerAttackFat', legs: 'sprPrisonerFatLegs', die: 'sprPrisonerDieFat' },
  objFatMafiaLSD: { walk: 'sprFatMafiaLSDWalk', attack: 'sprFatMafiaLSDAttack', legs: 'sprEMafiaFatLegs', die: 'sprFatMafiaLSDDie', burst: true },
} };
// objFatMafiaLSD (create 0x7a8500, step 0x7a9f50): the shared fat step until
// it dies; then sprFatMafiaLSDDie plays at image_speed 0.2 and from frame 7
// it bursts: a sprSonDeadExplode body, 20 pieces flung at x/y +-16 with
// speed 2 + random(3) and friction 0.15, screen shake 8. The pieces' object
// is not read; sprTinyBlood stands in for it.
export const BURST = { speed: 0.2, at: 7, body: 'sprSonDeadExplode', pieces: 20, spread: 16, speedMin: 2, speedRand: 3, friction: 0.15, piece: 'sprTinyBlood', shake: 8 };

// Points, as the exe adds them to the score (global 0xd90):
// execution 800 (KnockedOut step 0x8a0fa0, which also makes the "800pts"
// text), shooting a knocked-out body 600 (0x89dbe0), a fat enemy's death 800
// (fat step 0x11a1ee0), a thrown knife kill 800 (0x8a3fe0). A standing kill
// adds through helpers whose values are not read; 400 is a guess.
export const POINTS = { exec: 800, downed: 600, fat: 800, kill: 400, popup: 60 };
// objBearBoss (create 0x4e7730, step 0x4e78c0). State 0 is the intro: once the
// player passes x 224 they lose control and walk up to y 248; the bear eats
// for 120 steps, rises (frames 0-4 at 0.2, shifted 17px left, the screen
// shaking 2 per frame), waits 120 more and starts walking. State 1 chases:
// beyond 96px it walks (motion_add 0.15, top speed 1), closer it runs (0.5,
// top speed 4). A player mid-swing whose point 12px behind them (toward the
// bear) is inside the bear kills it; a bear touching the player kills them.
// Reading the first check (0xfab280 on the player's sprite) as "attacking"
// is a guess, and the bear's sounds are left out.
export const BEAR = { introX: 224, stopY: 248, walkUp: 2, legSpeed: 0.3, eat: 120, rise: 0.2, riseTo: 4, shift: 17, shake: 2, hold: 120,
  near: 96, walk: { accel: 0.15, max: 1, anim: 0.15 }, run: { accel: 0.5, max: 4, anim: 0.1 }, reach: 12,
  body: { speedMin: 2, speedRand: 1, friction: 0.15 }, killSpeed: 3, killFrame: 10, killFriction: 0.15,
  spr: { eat: 'sprBearBossEat', rise: 'sprBearBossRise', walk: 'sprBearBossWalk', run: 'sprBearBossRun', dead: 'sprBearBossDead', kill: 'sprPlayerDeadDog' } };
// objPrisonBoss (create 0x99f130, step 0x99fd00, player collision 0x99e870).
// Intro: a player right of x 336 loses control and walks left 1.5 a step;
// the dialogue that follows is not ported, so a short pause stands in for it.
// Then three states: walk toward the player (speed +0.1 a step up to 2) for
// 240 steps; charge up (frames 0-3 at 0.1) for 60, facing the player; charge
// at 3.75, turning up to 2.25 degrees a step, for 120; then 30 steps' rest.
// A melee swing whose point 16px behind the player is inside them kills it,
// as with the bear; touching the player swaps both for the kill animation
// halfway between them. The room has no player instance: the player starts
// by the exit on the right. The kill animation's speed is a guess.
const BOSS_WHO = { ...SON_BOSS_WHO, objBearBoss: 'objSon', objPrisonBoss: 'objRatPrison' };
export const PRISON = { introX: 336, walkLeft: 1.5, legSpeed: 0.125, talk: 90, first: 40, rest: 30, reach: 16, enter: { x: 520, y: 176 },
  walk: { accel: 0.1, max: 2, anim: 0.1, legs: 0.15, time: 240 }, chargeUp: { to: 3, anim: 0.1, time: 60 },
  charge: { speed: 3.75, turn: 2.25, anim: 0.075, legs: 0.15, time: 120 }, body: { speed: 2, friction: 0.1 }, killSpeed: 0.2,
  spr: { walk: 'sprPrisonBossWalk', chargeUp: 'sprPrisonBossChargeUp', charge: 'sprPrisonBossCharge', dead: 'sprPrisonBossDead', kill: 'sprPrisonBossKill', legs: 'sprRatPrisonLegs' } };
// Dodgers (objColombianDodger/objGangDodger/objSoldierDodger, one step code):
// unarmed chasers on the gang AI (0xd96830). A bullet, or a weapon flying
// faster than 4, starts sprDodger*Dodge at frame 0 and stops them; one landing
// mid-dodge holds it at frame 3. The dodge runs at 0.25 to frame 3, then 0.5,
// and at 15 they walk again. sprColombianDodgerStunned (all three steps test
// that one) runs at 0.25 to frame 5. What stuns them is not read: a door here.
// Melee is taken to kill them. objPrisonerPsycho (create 0x9a9240, step
// 0x9a9bf0) has the same dodge handlers and idles on one of
// sprPrisonerIdlePsycho1-3 at 0.15, testing for the player every 15 steps.
export const DODGER = { slow: 0.25, fast: 0.5, hold: 3, end: 15, stun: 0.25, stunEnd: 5, wake: 15, idleSpeed: 0.15, kinds: {
  objColombianDodger: { walk: 'sprColombianDodgerWalk', attack: 'sprColombianDodgerAttack', dodge: 'sprColombianDodgerDodge', dead: 'sprColombianDeadBlunt' },
  objGangDodger: { walk: 'sprGangDodgerWalk', attack: 'sprGangDodgerAttack', dodge: 'sprGangDodgerDodge', dead: 'sprGangDodgerDead' },
  objSoldierDodger: { walk: 'sprSoldierDodgerWalk', attack: 'sprSoldierDodgerAttack1', dodge: 'sprSoldierDodgerDodge', dead: 'sprSoldierDodgerDead' },
  objPrisonerPsycho: { walk: 'sprPrisonerWalkPsycho', attack: 'sprPrisonerKillPsycho', dodge: 'sprPrisonerPsychoDodge',
    stunned: 'sprPrisonerPsychoStunned', dead: 'sprPrisonerDeadBlunt', idle: ['sprPrisonerIdlePsycho1', 'sprPrisonerIdlePsycho2', 'sprPrisonerIdlePsycho3'] },
} };
// Hiding gunners (create 0x6006c0, steps 0x6013a0 / 0xb3e6a0): they stay put.
// Every 8 steps (first after random(10)) they test for the player; seen, they
// rise at 0.25 to frame 4 and fire 24 rounds every 4 steps, shake 6, aim +-6,
// snd9mm, then reload (sprColombianHidingReload at 0.2). Their hit points
// (var 95) are not read: one bullet or hit kills here.
export const HIDE = { every: 8, first: 10, rise: 0.25, up: 4, ammo: 24, reload: 0.2, reloadSteps: 125, kinds: {
  objColombianHiding: { base: 'sprColombian', sprite: 'sprColombianHiding', reload: 'sprColombianHidingReload' },
  objSoldierHiding: { base: 'sprSoldier', sprite: 'sprSoldierHiding' },
} };
// Dogs (objDogPatrol: create 0x6be760 -> objDog 0xe02560, step 0x6bf290 ->
// 0xe02cf0). A state machine in var 31: sight is tested on a timer (var 88,
// first random(10)); in sight the dog runs straight at the player at 4
// (0xe01ed0), out of sight it paths to them (0x42c700) and walks the path at
// 4; within 22px the player dies (0x1123ee0). The step animates at speed *
// 0.1, at least 0.3 while running. Any knockout kills a dog. The calm patrol
// (var 31 = 0) is taken to be the mafia's wander; re-checking every 10 steps
// is a reading of the create.
// The step plays sndDogBark (0xe0315b) as the dog takes up the chase (state
// 2); the kill (0x1123ee0) plays sndDogRip. Here the bark is on first sight.
export const DOG = { recheck: 10, speed: 4, kill: 22, imageSpeed: 0.1, runImage: 0.3, bark: 'sndDogBark', rip: 'sndDogRip' };
// Exits: objNextroom (124, step 0x939c70, player collision 0x937ad0, room
// start 0x939700). An exit is live while no objEnemy and no objKnockedOut is
// left; then it shows its arrow and touching it goes to the next room in the
// room order. The player keeps their position, weapon and ammo (floors are
// drawn aligned), and the exit they arrive on stays off until they leave it.
// objNextroom's own sprite is sprMask; its draw (0x9387f0) shows sprArrow,
// one frame per direction (from vars 32/36). Here the direction is taken from
// the nearest room edge, which is a guess.
export const EXIT = { objects: ['objNextroom'] };
// How near the van the player walks to leave the hideout. Native, after the talk plays
// through, starts the level between x 136 and 123 at the van's door (van at 96,172):
// its collision event with the van's mask, which creation code turns to 270.
// The px of slack around that turned mask:
export const INTRO_VAN_REACH = 4;
// objStartPoint (709, no sprite; create 0xbd7800, alarm 0xbd7770, draw
// 0xbd78f0) marks the jungle and power plant screens, which have no player
// instance. Its draw shows a blinking sprArrow turned by the room edge once no
// enemy is left. Here the start point nearest a placed player (objNicke in
// the first room), else the lowest-id one not on an objNextroom, is where the
// player enters, and in rooms with no other exit the rest are exits
// (a box of half-size `reach` around the point). How the game picks the entry
// and leaves the screen (walking off the edge) is not read; this is a guess
// that fits every jungle room's layout.
export const START_POINT = { object: 'objStartPoint', reach: 24 };
// Rooms with no objNextroom, elevator or second start point end some other
// way: the sewer grate is kicked open (objSewerGrateKick 0xba0fe0 /
// objSewerEntrance), the power plant cave mouth (objCaveOpening step 0x619540)
// and the vault door (objVaultOpening 0xba4f00) are walked into, and the rest
// (objHBorder 0x8410b0 calling room_goto_next, objDeathWishRoof, objLSD) move on
// by themselves once the floor is clear. Their decompiled events are not fully
// read: here the objects below are walk-on exits once the floor is clear (a box
// of half-size `reach`), a room with one start point leaves from it, and any
// other such room moves on `wait` steps after it is clear.
export const ROOM_END = { objects: ['objSewerGrateKick', 'objCaveOpening', 'objVaultOpening'], reach: 24, wait: 90,
  auto: ['objHBorder', 'objDeathWishRoof', 'objLSD', 'objFather'] };
// TVs and monitors (objTVBig 215 step 0xc0af10, objWallTV step 0xc67670,
// objComputerMonitorBlack/Grey steps 0x5eff60 / 0x5fa6b0; their objBullet and
// objEBullet collisions 0xc01da0 / 0xc065a0 and kin): a round from either side
// plays sndBottleBreak and runs the Break sprite, which ends on the Broken one
// with image_speed 0 (objWallTV has no Broken sprite and stays on its last
// Break frame). The break speed is a guess from the step's constants, the
// round flies on, and the parts and shards they throw are left out.
export const SCREENS = { sound: 'sndBottleBreak', imageSpeed: 0.25, objects: {
  objTVBig: ['sprTVBigBreak', 'sprTVBigBroken'], objWallTV: ['sprWallTVBreak', null],
  objComputerMonitorBlack: ['sprComputerMonitorBlackBreak', 'sprComputerMonitorBlackBroken'],
  objComputerMonitorGrey: ['sprComputerMonitorGreyBreak', 'sprComputerMonitorGreyBroken'] } };
// objFloorCleared (create 0x7b45a0, step 0x7b5240) shows sprFloorCleared
// (frame 0 FLOOR CLEARED, 1 AREA CLEARED) once the floor is clear; its slide
// in is not read, so it sits centred 44px above the bottom of the view.
export const CLEARED = { sprite: 'sprFloorCleared', bottom: 44 };
// objElevator (810, Mall and NewsPaper floors; room start 0x7698e0, step
// 0x76a430, room end 0x76a2e0). Drawn as sprElevatorDown, frame 0 shut and
// 14 open; whether the player is inside is tested with the sprElevatorFloor
// mask. Floor not clear: the doors open while the player is inside and shut
// when they leave. Floor clear: an empty elevator opens; the player stepping
// in shuts the doors 0.25 a step and is pulled 2 px a step on each axis to
// the point 36 px along image_angle-45 (the sign of the 45 is a reading);
// once both are done, an alarm of 25 steps takes them to the next floor.
// The elevator the player starts on (var 21) does nothing until they leave
// it. The player arrives in the next floor's elevator nearest in x (the room
// start puts them there; how it finds them is not read). Here the player has
// no control from the moment the ride starts.
export const ELEVATOR = { object: 'objElevator', mask: 'sprElevatorFloor', open: 14, door: 0.25, pull: 2, reach: 36, angle: -45, wait: 25 };
// Right click (scrPickupThrow 0x1114f40 area, scrPickup 0x1157500, scrThrow
// 0x11d3830, objWeapon step 0xc86050): the player's mask is scaled by 3 to
// look for a weapon to pick up; picking up while armed throws the old one
// first; with nothing to pick up the held weapon is thrown along the aim at
// speed 12. A loose weapon loses 0.25 speed a step and spins speed*3 degrees
// a step. Hitting an enemy at speed 5 or more knocks it out and the weapon
// keeps 0.2 of its speed. The wall bounce (half speed) is a guess.
export const WEAPON = { pickupScale: 3, throwSpeed: 12, friction: 0.25, spin: 3, hitSpeed: 5, hitDamp: 0.2, bounce: 0.5 };
// Space (scrSpaceAction 0xfc7260): the mask is scaled by 2 to find a knocked
// out body. The execution is created at the body facing its angle + 180, the
// pig plays sprPigKill<Bat|Hammer|Stick>, or sprPigKillStomp when unarmed or
// holding anything else (0xf39380), and the body plays the victim's KillBlunt
// or KillStomp (scrExecute 0xf4b2f0). When it ends the player comes back with
// the same weapon, 4px along angle + 90 after a hammer kill (0x1150350).
// imageSpeed is a guess, and the body's speed is scaled to end with the pig's.
// objSplat (create 0xb03090, step 0xb03640): a random sprSplat1-4, image
// angle random(360), scale 0.8 + random(0.4), image speed 0.15; it slides
// and slows, then stays on the floor. objBigBlood (0x4e2a40) leaves the pool
// under a body. Count and spread are fitted to native death frames; speeds are guesses.
export const BLOOD = { splats: ['sprSplat1', 'sprSplat2', 'sprSplat3', 'sprSplat4'], pool: ['sprBigBlood1', 'sprBigBlood2'],
  scaleMin: 0.8, scaleRand: 0.4, imageSpeed: 0.15, count: 30, spread: 90, speedMin: 1, speedRand: 4, friction: 0.25 };
// Camera: the view leads toward the mouse (a guess at objCamera's step).
export const CAMERA = { lead: 0.5, max: 22, ease: 0.15 };
// During a talk the native view sits on whoever speaks: the view's top-left per
// portrait, matched pixel for pixel against native frames (the fans share one
// couch object, objFansInCouch at 456,208, so this is per room).
export const TALK_CAMERA = {
  rmFansHeadQuarters: { sprMaskTiger: [291, 72], sprMaskSwan2: [268, 71], sprMaskZebra: [310, 72], sprMaskBear: [249, 71] },
};

// The Pilot's night (rmTutorialFloor1), matched to the native game: a dark red
// backdrop instead of the wash, the world multiplied down and reddened, a soft
// glow on the player, no score HUD, and a tutorial hint in a black box at the
// bottom: text 0 (walking), or text 1 (doors) while a door is near.
export const NIGHT = {
  room: /^rmTutorialFloor1$/, top: [44, 0, 0], bottom: [16, 0, 0], tint: 'rgb(222,204,189)',
  glow: { r: 110, colour: [120, 40, 40], a: 0.35 },
  hint: { text: 0, door: 1, near: 96, font: 'fntLabel', scale: 1.15, track: 0, padX: 7, top: 245, h: 14, box: '#000', shadow: 'rgb(3,124,124)', a: [255, 135, 255], b: [255, 240, 255], flash: 12, pop: 18, popScale: 0.09, exec: 2, look: 3, swing: 5, throw: 6, swap: 120, pickup: 4, pickupNear: 48, pickupWeapon: 'Hammer',
    // Later on the night, as the native game showed them: text 7 from the second
    // kill, 8 once the floor is clear (go to the phone), 9 after the phone talk.
    second: 7, clear: 8, after: 9,
    // native draws the [SCROLL WHEEL] key of texts 11 and 17 shorter
    key: [/\[SCROLL WHEEL\]/, '[SCROLL]'] },
};
// The same hint box upstairs (rmTutorialFloor2), seen in the native game; this
// floor is lit normally and keeps the HUD. Text 15 until the wall shotgun is
// held, then 17 and 16 (lock-on, aim) swapping every `swap` steps, 18 (shoot)
// from the first lock-on. It hides inside the couple's bedroom (`bedroom`, read
// off screenshots) until only the woman is left, when text 19 shows.
export const FLOOR2_HINT = { room: /^rmTutorialFloor2$/, gun: 15, lock: 17, aim: 16, shoot: 18, finish: 19, finishObj: 'objVictim5',
  bedroom: { l: 306, t: 40, r: 511, b: 226 } };
// Native locks on with the middle button or the scroll wheel; a trackpad's
// scroll sends a burst of wheel events, so one toggle per `wheelGap` ms.
export const LOCK_INPUT = { wheelGap: 300 };
// Phones (objPigPhone and the like) wait for a click near them; other talkers
// start when the player comes near.
export const PHONES = /Phone/;
// The death prompt (text 3050, its [R] shown as R), measured off the native Pilot:
// a black box left of centre just above the hint, the text fading cyan to magenta.
// GUESS: the same spot in rooms with no hint, and the fade's speed.
export const RESTART = { text: 3050, key: /\[R\]/, font: 'fntLabel', scale: 1.38, x: 65, top: 224, h: 21, padX: 9, a: [0, 220, 217], b: [230, 0, 214], shadow: 'rgb(120,8,3)', period: 20 };
export const EXEC = { scale: 2, imageSpeed: 0.25, hammerShift: 4 };


function inherits(G, o, name) {
  for (let k = 0; o && k < 64; k++, o = G.objects.get(o.parent)) if (o.name === name) return true;
  return false;
}

// What the player walks into: GameMaker's place_free tests every instance with
// the solid flag, so furniture, cars and loose props block as well as walls
// (native stops the player on the hideout couch at y 248). Port choice: actors
// with the flag (NPCs, film crew, elevators) are left out since the port moves
// or triggers them; enemies keep the wall grid and path round furniture.
export const BODY = { objects: ['objSolid', 'objFurniture', 'objCar'], skip: ['objDirector', 'objElevator', 'objExplodingElevator'] };

// Rasterise every solid instance's mask into one room-sized grid. With `loose`,
// parentless objects that have the solid flag count too.
export function buildSolids(G, room, kinds = ['objSolid'], looping = SLIDING.objects, loose = null) {
  const grid = new Uint8Array(room.w * room.h);
  const put = (x, y) => { if (x >= 0 && y >= 0 && x < room.w && y < room.h) grid[y * room.w + x] = 1; };
  for (const inst of room.insts) {
    const o = G.objects.get(inst.obj);
    if (loose?.skip.includes(o?.name)) continue;
    if (!kinds.some(k => inherits(G, o, k)) && !(loose && o?.solid && !G.objects.get(o.parent))) continue;
    const s = G.sprites.get(o.mask >= 0 ? o.mask : o.sprite);
    if (!s) continue;
    const x0 = inst.x - s.ox, y0 = inst.y - s.oy;
    const m = G.masks.get(s.id);
    const turned = (inst.angle ?? 0) % 360 !== 0 || (inst.xs ?? 1) !== 1 || (inst.ys ?? 1) !== 1;
    if (turned) {
      // Placed with an angle or scale: sample the mask at each room pixel.
      const n = m && looping.includes(o.name) ? m.frames : 1;
      const hit = (x, y) => {
        if (x < s.bbox.l || x > s.bbox.r || y < s.bbox.t || y > s.bbox.b) return false;
        if (!m) return true;
        for (let f = 0; f < n; f++) if (!(m.bits[(f * m.h + y) * m.stride + (x >> 3)] & (0x80 >> (x & 7)))) return false;
        return true;
      };
      const kx = inst.xs ?? 1, ky = inst.ys ?? 1, c = Math.cos((inst.angle ?? 0) * Math.PI / 180), sn = Math.sin((inst.angle ?? 0) * Math.PI / 180);
      const loc = (dx, dy) => [(dx * c - dy * sn) / kx + s.ox, (dx * sn + dy * c) / ky + s.oy];
      const fwd = (lx, ly) => { const px = (lx - s.ox) * kx, py = (ly - s.oy) * ky; return [inst.x + px * c + py * sn, inst.y - px * sn + py * c]; };
      const cs = [fwd(s.bbox.l, s.bbox.t), fwd(s.bbox.r + 1, s.bbox.t), fwd(s.bbox.l, s.bbox.b + 1), fwd(s.bbox.r + 1, s.bbox.b + 1)];
      const xa = Math.floor(Math.min(...cs.map(p => p[0]))), xb = Math.ceil(Math.max(...cs.map(p => p[0])));
      const ya = Math.floor(Math.min(...cs.map(p => p[1]))), yb = Math.ceil(Math.max(...cs.map(p => p[1])));
      for (let y = ya; y <= yb; y++)
        for (let x = xa; x <= xb; x++) {
          const [lx, ly] = loc(x + 0.5 - inst.x, y + 0.5 - inst.y);
          if (hit(Math.floor(lx), Math.floor(ly))) put(x, y);
        }
    } else if (m) {
      const n = looping.includes(o.name) ? m.frames : 1;
      const on = (f, x, y) => m.bits[(f * m.h + y) * m.stride + (x >> 3)] & (0x80 >> (x & 7));
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          let all = true;
          for (let f = 0; f < n && all; f++) all = !!on(f, x, y);
          if (all) put(x0 + x, y0 + y);
        }
    } else {
      for (let y = s.bbox.t; y <= s.bbox.b; y++)
        for (let x = s.bbox.l; x <= s.bbox.r; x++) put(x0 + x, y0 + y);
    }
  }
  return { w: room.w, h: room.h, grid };
}

// The mp_grid: a cell is blocked when any solid pixel falls in it.
function buildPathGrid(G, room) {
  const px = buildSolids(G, room, PATH.objects, []), c = PATH.cell;
  const cw = Math.ceil(room.w / c), ch = Math.ceil(room.h / c), blocked = new Uint8Array(cw * ch);
  for (let y = 0; y < room.h; y++)
    for (let x = 0; x < room.w; x++)
      if (px.grid[y * room.w + x]) blocked[Math.floor(y / c) * cw + Math.floor(x / c)] = 1;
  return { cw, ch, blocked };
}
const cellFree = (pg, x, y) => {
  const cx = Math.floor(x / PATH.cell), cy = Math.floor(y / PATH.cell);
  return cx >= 0 && cy >= 0 && cx < pg.cw && cy < pg.ch && !pg.blocked[cy * pg.cw + cx];
};
// 4-way step counts over the free cells from (x, y), or, off the grid, from
// the nearest cell to it; 0 is unreached, so the start counts 1.
const gridCell = (pg, x, y) => Math.min(pg.ch - 1, Math.max(0, Math.floor(y / PATH.cell))) * pg.cw + Math.min(pg.cw - 1, Math.max(0, Math.floor(x / PATH.cell)));
function gridReach(pg, x, y) {
  const { cw, ch, blocked } = pg, dist = new Int32Array(cw * ch), s = gridCell(pg, x, y);
  let todo = [s]; dist[s] = 1;
  while (todo.length) {
    const next = [];
    for (const i of todo) {
      const ix = i % cw, iy = (i - ix) / cw;
      for (const [nx, ny] of [[ix + 1, iy], [ix - 1, iy], [ix, iy + 1], [ix, iy - 1]]) {
        const j = ny * cw + nx;
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !dist[j] && !blocked[j]) { dist[j] = dist[i] + 1; next.push(j); }
      }
    }
    todo = next;
  }
  return dist;
}
// mp_grid_path with diagonals: A* over the cells, a diagonal step only when
// both cells beside it are free. The path is the start, the cell centres and
// the goal; null when there is no way.
function gridPath(pg, x0, y0, x1, y1) {
  const { cw, ch, blocked } = pg, c = PATH.cell;
  const sx = Math.floor(x0 / c), sy = Math.floor(y0 / c), tx = Math.floor(x1 / c), ty = Math.floor(y1 / c);
  if (sx < 0 || sy < 0 || sx >= cw || sy >= ch || !cellFree(pg, x1, y1)) return null;
  const start = sy * cw + sx, goal = ty * cw + tx;
  const g = new Float64Array(cw * ch).fill(Infinity), from = new Int32Array(cw * ch).fill(-1), shut = new Uint8Array(cw * ch);
  const h = (i) => { const dx = Math.abs(i % cw - tx), dy = Math.abs(Math.floor(i / cw) - ty); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
  const heap = [];
  const push = (i, f) => {
    heap.push([f, i]);
    for (let k = heap.length - 1; k > 0;) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top[1];
  };
  g[start] = 0; push(start, h(start));
  while (heap.length) {
    const i = pop();
    if (shut[i]) continue;
    shut[i] = 1;
    if (i === goal) break;
    const ix = i % cw, iy = Math.floor(i / cw);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = ix + dx, ny = iy + dy, n = ny * cw + nx;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= cw || ny >= ch || blocked[n] || shut[n]) continue;
        if (dx && dy && (blocked[iy * cw + nx] || blocked[ny * cw + ix])) continue;
        const cost = g[i] + (dx && dy ? Math.SQRT2 : 1);
        if (cost < g[n]) { g[n] = cost; from[n] = i; push(n, cost + h(n)); }
      }
  }
  if (!shut[goal]) return null;
  const pts = [{ x: x1, y: y1 }];
  for (let i = from[goal]; i !== -1 && i !== start; i = from[i]) pts.push({ x: (i % cw) * c + c / 2, y: Math.floor(i / cw) * c + c / 2 });
  pts.push({ x: x0, y: y0 });
  return pts.reverse();
}

// place_free for the player's box at (x, y). Outside the room is free in
// GameMaker (the 24px strip under rmSonMansionFloor1's stair rails is only
// passable past the bottom edge), so the box may stick out `ROOM_EDGE` px.
export const ROOM_EDGE = 16;
const ARRIVE_PAD = 32;
function free(sol, box, x, y) {
  const l = Math.round(x) + box.l, t = Math.round(y) + box.t;
  const r = l + box.r - box.l, b = t + box.b - box.t, E = ROOM_EDGE;
  if (l < -E || t < -E || r >= sol.w + E || b >= sol.h + E) return false;
  for (let yy = Math.max(t, 0); yy <= Math.min(b, sol.h - 1); yy++)
    for (let xx = Math.max(l, 0); xx <= Math.min(r, sol.w - 1); xx++)
      if (sol.grid[yy * sol.w + xx]) return false;
  return true;
}

// Nearest free spot to (x, y), searching outward ring by ring.
function nearestFree(sol, box, x, y, ok = () => true) {
  for (let d = 0; d < Math.max(sol.w, sol.h); d += 2)
    for (let k = -d; k <= d; k += 2)
      for (const [dx, dy] of [[k, -d], [k, d], [-d, k], [d, k]])
        if (free(sol, box, x + dx, y + dy) && ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x, y };
}

// Move along one axis; when blocked, creep up to the wall a pixel at a time.
// With `corner`, a mover clipping the edge of a doorway or wall end slides
// sideways toward the clear lane up to that many px away instead of sticking.
// A port choice: a 24px box has only 4px either side in a 32px doorway.
export const CORNER = 18;
function moveAxis(sol, box, p, axis, v, corner = 0) {
  const at = (d) => axis === 'x' ? free(sol, box, p.x + d, p.y) : free(sol, box, p.x, p.y + d);
  if (at(v)) { p[axis] += v; return v; }
  const s = Math.sign(v);
  let moved = 0;
  while (Math.abs(moved + s) <= Math.abs(v) && at(moved + s)) moved += s;
  p[axis] += moved;
  if (corner && s) {
    const o = axis === 'x' ? 'y' : 'x';
    // At most 3/4 of the mover's width: one stopped past the centre of a wall end still slides
    // into the doorway beside it, while a head-on hit on a long wall still blocks.
    corner = Math.min(corner, Math.ceil((axis === 'x' ? box.b - box.t : box.r - box.l) * 0.75));
    const fits = (k, d) => axis === 'x' ? free(sol, box, p.x + d, p.y + k) : free(sol, box, p.x + k, p.y + d);
    for (let k = 1; k <= corner; k++)
      for (const side of [-1, 1]) {
        let ok = true;
        for (let j = 1; j <= k && ok; j++) ok = fits(side * j, 0);
        if (ok && fits(side * k, s)) { p[o] += side * Math.min(k, Math.abs(v)); return v; }
      }
  }
  return 0;
}

export function findPlayer(G, room) {
  return room.insts.find(i => inherits(G, G.objects.get(i.obj), 'objPlayer') && G.objects.get(i.obj).sprite >= 0);
}

// On a mask-picker room the player steps out of the car toward the room's
// middle; the picker draws the level around that point behind it.
export function pickerStart(G, room) {
  const menuAt = room.insts.find(i => /^obj(Mask|CobraMask|SonStyle)Menu$/.test(G.objects.get(i.obj)?.name));
  const car = menuAt && room.insts.find(i => inherits(G, G.objects.get(i.obj), 'objCar'));
  const carAt = car && (d => ({ x: car.x + lenX(CAR_EXIT, d), y: car.y + lenY(CAR_EXIT, d) }))(pointDir(car.x, car.y, room.w / 2, room.h / 2));
  return { menuAt, carAt };
}

// GameMaker angles: degrees, counter-clockwise, with y pointing down.
const RAD = Math.PI / 180;
const lenX = (l, d) => l * Math.cos(d * RAD), lenY = (l, d) => -l * Math.sin(d * RAD);
const pointDir = (x1, y1, x2, y2) => (Math.atan2(y1 - y2, x2 - x1) / RAD + 360) % 360;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const random = (n) => Math.random() * n;
// 0x1175ca0: turn angle a toward t by at most `step` degrees.
const turnToward = (a, t, step) => {
  const diff = ((t - a) % 360 + 540) % 360 - 180;
  return (a + Math.max(-step, Math.min(step, diff)) + 360) % 360;
};
const approach = (v, to, d) => v < to ? Math.min(v + d, to) : Math.max(v - d, to);

// A mask's box relative to the sprite origin; with a placed instance, the
// box around its scaled and rotated corners.
function maskBox(G, o, inst) {
  const s = G.sprites.get(o.mask >= 0 ? o.mask : o.sprite);
  if (!s) return { l: 0, r: 0, t: 0, b: 0 };
  const b = { l: s.bbox.l - s.ox, r: s.bbox.r - s.ox, t: s.bbox.t - s.oy, b: s.bbox.b - s.oy };
  const a = inst?.angle ?? 0, kx = inst?.xs ?? 1, ky = inst?.ys ?? 1;
  if (a % 360 === 0 && kx === 1 && ky === 1) return b;
  const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
  const pts = [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]].map(([x, y]) => [x * kx * c + y * ky * sn, -x * kx * sn + y * ky * c]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { l: Math.round(Math.min(...xs)), r: Math.round(Math.max(...xs)), t: Math.round(Math.min(...ys)), b: Math.round(Math.max(...ys)) };
}
const scaleBox = (b, k) => ({ l: b.l * k, r: b.r * k, t: b.t * k, b: b.b * k });
const ZERO = { l: 0, r: 0, t: 0, b: 0 };
// collision_point: GameMaker's bounding boxes include their right and bottom pixel.
const inBox = (pt, o, bb) => pt.x >= o.x + bb.l && pt.x < o.x + bb.r + 1 && pt.y >= o.y + bb.t && pt.y < o.y + bb.b + 1;
function overlap(a, ab, b, bb) {
  const ax = Math.round(a.x), ay = Math.round(a.y), bx = Math.round(b.x), by = Math.round(b.y);
  return ax + ab.l <= bx + bb.r && bx + bb.l <= ax + ab.r && ay + ab.t <= by + bb.b && by + bb.t <= ay + ab.b;
}

// env: { G, room, items, imgs, frames(name) -> {atlas, frames}, load(atlas), canvas, zoom, status }
export async function play(env) {
  const { G, room, items, imgs, canvas, zoom } = env;
  const sfx = name => G.audio?.play(name);
  const spawn = findPlayer(G, room);
  // The boss rooms have no player instance; the boss names the character
  // (the bear's step sets sprSonWalkUnarmed). Otherwise the Pig.
  const byName = n => n && G.objects.list.find(o => o.name === n);
  const bossWho = room.insts.map(i => BOSS_WHO[G.objects.get(i.obj)?.name]).find(Boolean);
  // env.character is a player object name, or '<object>:<pick>' from the Jake
  // and Son menus (the same object, played differently). The Son's story
  // scenes (bosses.js) always play as the Son.
  const pick = env.character || '', pickObj = pick.split(':')[0];
  const sonWho = room.name === 'rmLSDIntro' ? 'objSon' : room.insts.map(i => SON_BOSS_WHO[G.objects.get(i.obj)?.name]).find(Boolean);
  const pobj = byName(sonWho) || (spawn ? G.objects.get(spawn.obj) : byName(pickObj) || byName(bossWho) || byName('objPigButcher'));
  const fan = FANS[pick.startsWith(pobj.name + ':') ? pick : pobj.name];
  const sprByName = new Map(G.sprites.list.map(s => [s.name, s]));
  const art = new Map();
  let started = false;
  const need = (name) => {
    const s = sprByName.get(name), hit = s && env.frames(name);
    if (!hit?.frames.length) return null;
    // One first wanted mid-room (an enemy getting up unarmed) loads now and
    // is skipped by the draw until its atlas is in.
    if (!art.has(name) && started) env.load(hit.atlas);
    art.set(name, { s, hit });
    return name;
  };
  const walkName = G.sprites.get(pobj.sprite).name, pre = walkName.replace(/Walk\w*$/, '');
  const P = {
    walk: need(walkName),
    legs: need(pre + 'Legs'),
    punches: (fan?.punch || ['AttackPunch']).map(n => need(pre + n)).filter(Boolean),
    stomp: (fan?.nonLethal && need(pre + fan.stomp)) || need(pre + 'KillStomp') || (fan && need(pre + fan.stomp)),
  };
  P.punch = P.punches[0];
  // Per weapon: walk, attack and execution sprites, if the character has them.
  const arm = {};
  for (const [name, a] of Object.entries(ARMS)) {
    const walk = need(pre + 'Walk' + name), attack = need(pre + 'Attack' + name);
    if (walk && attack) arm[name] = { ...a, walk, attack, kill: (fan?.nonLethal ? need(pre + 'Kill' + name + '2') : need(pre + 'Kill' + name)) || P.stomp };
  }
  for (const [name, g] of Object.entries(GUNS)) {
    const walk = need(pre + 'Walk' + name);
    const attack = need(pre + 'Attack' + name) || need(pre + 'Attack' + name + '1');
    if (walk && attack) arm[name] = { ...g, gun: true, walk, attack, attack2: need(pre + 'Attack' + name + '2') || attack, kill: P.stomp };
  }
  if (fan?.special) {
    const s = fan.special;
    arm.Special = { ...s.gun, gun: true, special: true, label: s.label, walk: need(s.walk), attack: s.walk, attack2: s.walk, kill: P.stomp };
    P.arm = need(s.arm);
  }
  if (fan?.roll) P.roll = need(fan.roll.sprite);
  if (fan?.disarm) P.disarm = Object.fromEntries(Object.keys(GUNS).map(g => [g, need(pre + 'Disarm' + g)]));
  P.deadShot = need(pre + 'DeadShot') || need(pre + 'DeadShotgun') || need(pre + 'DeadMachinegun');
  P.deadBlunt = need(pre + 'DeadBlunt') || P.deadShot;
  const bulletSprite = need('sprBullet'), clearedArt = art.get(need(CLEARED.sprite)), leaveSprite = Object.fromEntries(Object.entries(IDLE.leave).map(([k, v]) => [k, need(v.sprite)]));
  const box = maskBox(G, pobj);
  const walls = buildSolids(G, room), sol = buildSolids(G, room, BODY.objects, SLIDING.objects, BODY);
  const pg = buildPathGrid(G, room);

  // Enemies: objEnemy / objVictim instances, their sprites named after the
  // idle one. Enemies collide with their object's mask (sprMaskEnemy for
  // most, sprCollisionMaskDog for dogs); maskless ones such as Victim1 use
  // the player's sprMask box.
  // Mafia and gang sprites are named after the held weapon (sprEMafiaWalkM16),
  // with no idle; `gun` carries the weapon over a knockout. Idle variants
  // (sprEGangIdlePipe) take the base from before Idle.
  const mkEnemy = (obj, x, y, walking, gun) => {
    const o = G.objects.get(obj), sname = G.sprites.get(o.sprite).name, base = sname.replace(/(Idle\w*|Walk\w*)$/, '');
    const e = { obj, base, kind: o.name, isEnemy: inherits(G, o, 'objEnemy'), x, y, box: o.mask >= 0 ? maskBox(G, o) : box, angle: 0, alert: false, frame: 0, imageSpeed: VICTIM1.idleSpeed,
      spr: { idle: need(base + 'Idle') || need(sname), walk: need(base + 'Walk'), cower: need(base + 'Idle2'), getUp: need(base + 'GetUp') } };
    e.spr.killBlunt = need(base + 'KillBlunt');
    e.spr.killStomp = need(base + 'KillStomp');
    e.spr.deadShot = need(base + 'DeadMachinegun') || need(base + 'DeadShot');
    e.spr.deadShotgun = need(base + 'DeadShotgun') || e.spr.deadShot;
    const dog = o.name === 'objDogPatrol';
    if (dog) {
      Object.assign(e.spr, { idle: need(base + 'Walk'), walk: need(base + 'Walk'), run: need(base + 'Run'), getUp: null,
        deadShot: need(base + 'DeadShot'), deadBlunt: need(base + 'DeadBlunt') });
      e.spr.deadShotgun = e.spr.deadShot;
      Object.assign(e, { dog: true, mafia: true, gun: null, hs: 0, vs: 0, moveDir: 0, legFrame: 0, alarm: 1, check: Math.floor(random(DOG.recheck)), cooldown: 0, wait: 0, seen: null });
      e.imageSpeed = 0;
    }
    const dodger = DODGER.kinds[o.name], hide = HIDE.kinds[o.name];
    if (dodger) {
      Object.assign(e.spr, { walk: need(dodger.walk), attack: need(dodger.attack), dodge: need(dodger.dodge),
        stunned: need(dodger.stunned || 'sprColombianDodgerStunned'), getUp: null, killStomp: null, legs: null });
      e.spr.deadShot = e.spr.deadShotgun = e.spr.deadBlunt = need(dodger.dead);
      e.spr.idle = dodger.idle ? need(dodger.idle[Math.floor(random(dodger.idle.length))]) : e.spr.walk;
      Object.assign(e, { dodger: true, mafia: true, gun: null, g: null, hs: 0, vs: 0, moveDir: 0, legFrame: 0, alarm: 1, check: Math.floor(random(ENEMY.recheck)), cooldown: 0, wait: 0, seen: null, imageSpeed: 0 });
      if (dodger.idle && !walking) Object.assign(e, { sleep: true, wake: Math.floor(random(DODGER.wake)), imageSpeed: DODGER.idleSpeed });
      e.sprite = e.sleep ? e.spr.idle : e.spr.walk;
      return e;
    }
    if (hide) {
      Object.assign(e.spr, { idle: need(hide.sprite), walk: null, reload: hide.reload ? need(hide.reload) : null, getUp: null });
      e.spr.deadBlunt = need(hide.base + 'DeadBlunt') || need(hide.base + 'DeadMachinegun');
      e.spr.deadShot = need(hide.base + 'DeadMachinegun') || e.spr.deadBlunt;
      e.spr.deadShotgun = need(hide.base + 'DeadShotgun') || e.spr.deadShot;
      Object.assign(e, { hiding: true, g: ENEMY_GUNS.Hiding, ammo: HIDE.ammo, reloading: 0, check: Math.floor(random(HIDE.first)), cooldown: 0, imageSpeed: 0 });
      e.sprite = e.spr.idle;
      return e;
    }
    const vic = VICTIMS[o.name];
    if (vic?.exec?.[pre]) e.spr.exec = need(vic.exec[pre]);
    if (vic?.dead) e.spr.deadShot = e.spr.deadShotgun = e.spr.deadBlunt = e.spr.killStomp = e.spr.killBlunt = need(vic.dead);
    if (vic?.walk) {
      Object.assign(e.spr, { walk: need(vic.walk), idle: need(vic.idle || vic.walk), attack: vic.attack ? need(vic.attack) : null, legs: need(vic.legs) });
      if (vic.arm) for (const w of ['Bat']) { need(base + 'Walk' + w); need(base + 'Attack' + w); }
      Object.assign(e, { mafia: true, gun: vic.arm || null, calmUntilSeen: !!vic.arm, g: null, hs: 0, vs: 0, moveDir: 0, legFrame: 0, alarm: 1, check: Math.floor(random(ENEMY.recheck)), cooldown: 0, wait: 0, seen: null,
        still: true, imageSpeed: 0 });
    }
    const fat = FAT.kinds[o.name];
    const armed = (fat || FACTION.test(o.name)) && (fat ? 'Unarmed' : (sname.match(/Walk(\w+)$/) || [])[1]);
    if (fat) {
      Object.assign(e, { fat: true, hp: FAT.hp, bleed: FAT.bleed, burst: !!fat.burst });
      if (fat.burst) { need(BURST.body); need(BURST.piece); }
      e.spr.walk = need(fat.walk || base + 'Walk'); e.spr.die = need(fat.die || base + 'Die');
      e.spr.attack = need(fat.attack || base + 'Attack'); e.spr.legs = fat.legs ? need(fat.legs) : need(base + 'Legs');
      e.spr.idle = e.spr.walk;
      e.spr.deadShot = e.spr.deadShotgun = e.spr.die;
      e.spr.getUp = null;
      Object.assign(e, { mafia: true, gun: null, g: ENEMY_GUNS[fat.gun], hs: 0, vs: 0, moveDir: 0, legFrame: 0, alarm: 1, check: Math.floor(random(ENEMY.recheck)), cooldown: 0, wait: 0, seen: null });
      e.imageSpeed = 0;
    } else if (armed) {
      let held = gun ?? armed;
      const swap = ENEMY_SWAP[o.name];
      if (!gun && swap && (swap[0] === null || swap[0] === held)) held = swap[1][Math.floor(random(swap[1].length))];
      e.mafia = true; e.gun = held; e.g = ENEMY_GUNS[base.slice(3) + held] || ENEMY_GUNS[held];
      e.spr.walk = need(base + 'Walk' + held);
      e.spr.idle = e.spr.walk;
      // sprColombianAttackMachette is spelt so in the wad.
      e.spr.attack = need(base + 'Attack' + held) || need(base + 'Attack' + held + '1') || (held === 'Machete' && need(base + 'AttackMachette'));
      e.spr.legs = need(base + 'Legs');
      // A knocked out one gets up unarmed: load those sprites with the room.
      if (!e.g) { need(base + 'WalkUnarmed'); need(base + 'AttackUnarmed'); }
      Object.assign(e, { hs: 0, vs: 0, moveDir: 0, legFrame: 0, alarm: 1, check: Math.floor(random(ENEMY.recheck)), cooldown: 0, wait: 0, seen: null,
        still: /Static/.test(o.name) });
      e.imageSpeed = 0;
    }
    // An idle one carries the enemy it becomes, made now so its sprites load.
    const become = IDLE.become[o.name], to = become && G.objects.list.find(q => q.name === become[0]);
    if (to) {
      e.idle = mkEnemy(to.id, x, y, true, become[1]);
      e.wake = Math.floor(random(IDLE.every)); e.imageSpeed = IDLE.imageSpeed;
    }
    e.sprite = walking && e.spr.walk ? e.spr.walk : e.spr.idle;
    return e;
  };
  const isEnemy = (o) => o && !BOSS_WHO[o.name] && o.sprite >= 0 && (inherits(G, o, 'objEnemy') || inherits(G, o, 'objVictim'));
  // A hub room the player cleared earlier (app.js hubNext) comes back as they
  // left it: no enemies, its bodies and loose weapons where they lay.
  const saved = env.carry?.level?.rooms?.[room.name];
  // Creation code may set the held weapon's sprite (sprColombianWalkShotgun)
  // and the facing (direction, else image_angle).
  const enemies = saved ? [] : room.insts.filter(i => isEnemy(G.objects.get(i.obj))).map(i =>
    Object.assign(mkEnemy(i.obj, i.x, i.y, false, (i.spr?.match(/Walk(\w+)$/) || [])[1]), { inst: i, angle: i.dir ?? i.angle ?? 0 }));
  // The couple counts as an enemy until it splits; the two it becomes are made
  // now so their sprites load.
  for (const i of saved ? [] : room.insts.filter(i => G.objects.get(i.obj)?.name === COUPLE.obj)) {
    for (const n of COUPLE.idle) need(n);
    const pair = COUPLE.split.map(([name, dy]) => {
      const to = G.objects.list.find(q => q.name === name);
      return to && Object.assign(mkEnemy(to.id, i.x, i.y + dy), { inst: i });
    }).filter(Boolean);
    enemies.push({ inst: i, obj: i.obj, kind: COUPLE.obj, couple: true, pair, isEnemy: true, x: i.x, y: i.y, box, angle: 0, frame: 0,
      imageSpeed: COUPLE.imageSpeed, sprite: need(COUPLE.idle[0]), spr: { idle: need(COUPLE.idle[0]) } });
  }
  const kos = [], dead = [], bullets = [];
  if (saved) for (const d of saved.dead) if (need(d.sprite)) dead.push({ ...d, speed: 0 });
  const BOSS = {
    ...sonBossDefinitions(room, G),
    objBearBoss: { k: BEAR, make: () => ({ wait: BEAR.eat, hold: BEAR.hold, sprite: BEAR.spr.eat, imageSpeed: 0.1 }) },
    objPrisonBoss: { k: PRISON, make: () => ({ intro: true, talk: PRISON.talk, wait: PRISON.first, timer: PRISON.walk.time, speed: 0, legFrame: 0,
      sprite: PRISON.spr.walk, imageSpeed: 0, angle: 180 }) },
  };
  const bosses = room.insts.filter(i => BOSS[G.objects.get(i.obj)?.name]).map(i => {
    const kind = G.objects.get(i.obj).name, d = BOSS[kind];
    for (const n of Object.values(d.k.spr)) need(n);
    return { inst: i, kind, x: i.x, y: i.y, box: G.objects.get(i.obj).sprite >= 0 ? maskBox(G, G.objects.get(i.obj), i) : ZERO, state: 0, frame: 0, hs: 0, vs: 0, angle: 0, ...d.make() };
  });
  const bossEnter = bosses.map(b => BOSS[b.kind].k.enter).find(Boolean);

  // Loose weapons: objWeapon children the player can hold.
  const wbox = maskBox(G, { mask: sprByName.get('sprWeaponMask')?.id ?? -1, sprite: -1 });
  const weapons = saved ? saved.weapons.filter(w => need(w.sprite)).map(w => ({ ...w })) : room.insts.filter(i => {
    const o = G.objects.get(i.obj);
    return o && (inherits(G, o, 'objWeapon') ? arm[o.name.slice(3)] : arm[WALL_GUNS[o.name]?.name]);
  }).map(i => {
    const o = G.objects.get(i.obj), wall = WALL_GUNS[o.name], name = wall ? wall.name : o.name.slice(3);
    return { inst: i, name, x: i.x, y: i.y, angle: i.angle ?? 0, speed: 0, dir: 0, ammo: wall ? wall.ammo : GUNS[name]?.ammo ?? 0,
      wall: !!wall, sprite: need(G.sprites.get(G.objects.get(i.obj).sprite).name) };
  });
  const looseSprite = Object.fromEntries(weapons.filter(w => !w.wall).map(w => [w.name, w.sprite]));
  for (const name of Object.keys(arm)) looseSprite[name] ??= need('spr' + name);

  // Doors: the create event moves V doors 4px right; H doors are taken to
  // move 4px down (their create 0x6e8180 is not read yet).
  const doors = room.insts.filter(i => /^objEditorDoor[VH]$/.test(G.objects.get(i.obj)?.name)).map(i => {
    const h = G.objects.get(i.obj).name.endsWith('H');
    return { inst: i, h, x: i.x + (h ? 0 : 4), y: i.y + (h ? 4 : 0), base: h ? 0 : 270, angle: 0, v: 0, byPlayer: false,
      sprite: need(G.sprites.get(G.objects.get(i.obj).sprite).name) };
  });

  const arrow = need('sprArrow');
  const splatSprites = BLOOD.splats.map(need).filter(Boolean), poolSprites = BLOOD.pool.map(need).filter(Boolean);
  // An exit back to a hub room already cleared (env.exitDone, from app.js) shows sprGreyArrow.
  const greyArrow = need('sprGreyArrow') || arrow;
  const exits = room.insts.filter(i => EXIT.objects.includes(G.objects.get(i.obj)?.name) && G.objects.get(i.obj).sprite >= 0).map(i => {
    const o = G.objects.get(i.obj), grey = !!env.exitDone?.(i);
    const edges = [room.w - i.x, i.y, i.x, room.h - i.y];
    return { inst: i, kind: o.name, x: i.x, y: i.y, box: maskBox(G, o), off: false, live: false, grey,
      sprite: o.name === 'objNextroom' ? grey ? greyArrow : arrow : need(G.sprites.get(o.sprite).name), frame: edges.indexOf(Math.min(...edges)) };
  });
  const starts = room.insts.filter(i => G.objects.get(i.obj)?.name === START_POINT.object).sort((a, b) => a.id - b.id);
  const near = (a, b) => Math.hypot(a.x - spawn.x, a.y - spawn.y) - Math.hypot(b.x - spawn.x, b.y - spawn.y);
  const entry = spawn ? [...starts].sort(near)[0] : starts.find(s => !exits.some(x => overlap(s, ZERO, x, x.box))) || starts[0];
  if (entry && !exits.length && !room.insts.some(i => G.objects.get(i.obj)?.name === ELEVATOR.object)) {
    const r = START_POINT.reach;
    for (const i of starts) if (i !== entry) {
      const edges = [room.w - i.x, i.y, i.x, room.h - i.y];
      exits.push({ inst: i, kind: START_POINT.object, x: i.x, y: i.y, box: { l: -r, r, t: -r, b: r }, off: false, live: false,
        sprite: arrow, frame: edges.indexOf(Math.min(...edges)) });
    }
  }
  const lifts = room.insts.some(i => G.objects.get(i.obj)?.name === ELEVATOR.object);
  if (!exits.length && !lifts) {
    const r = ROOM_END.reach, box = { l: -r, r, t: -r, b: r };
    const ends = room.insts.filter(i => ROOM_END.objects.includes(G.objects.get(i.obj)?.name));
    // The lone start point is where the player came in, so it stays off until they step off it.
    for (const i of ends.length ? ends : starts.length === 1 ? starts : []) {
      const edges = [room.w - i.x, i.y, i.x, room.h - i.y];
      exits.push({ inst: i, kind: G.objects.get(i.obj).name, x: i.x, y: i.y, box, off: i === entry, live: false,
        sprite: arrow, frame: edges.indexOf(Math.min(...edges)) });
    }
  }

  const screens = room.insts.filter(i => SCREENS.objects[G.objects.get(i.obj)?.name]).map(i => {
    const o = G.objects.get(i.obj), [brk, broken] = SCREENS.objects[o.name];
    return { inst: i, x: i.x, y: i.y, box: maskBox(G, o), sprite: need(G.sprites.get(o.sprite).name), frame: 0, speed: 0, hit: false,
      brk: need(brk), broken: broken && need(broken) };
  }).filter(s => s.sprite && s.brk);
  const sliders = room.insts.filter(i => SLIDING.objects.includes(G.objects.get(i.obj)?.name))
    .map(i => ({ inst: i, x: i.x, y: i.y, sprite: need(G.sprites.get(G.objects.get(i.obj).sprite).name), frame: 0 })).filter(d => d.sprite);

  const elevators = room.insts.filter(i => G.objects.get(i.obj)?.name === ELEVATOR.object).map(i => {
    const o = G.objects.get(i.obj), mask = G.sprites.list.find(s => s.name === ELEVATOR.mask);
    return { inst: i, x: i.x, y: i.y, box: maskBox(G, { mask: mask.id, sprite: o.sprite }), frame: 0, used: false, timer: 0,
      sprite: need(G.sprites.get(o.sprite).name),
      to: { x: i.x + lenX(ELEVATOR.reach, ELEVATOR.angle), y: i.y + lenY(ELEVATOR.reach, ELEVATOR.angle) } };
  });

  // Cutscene talk: the talker objects (NPCs, props and scene scripts that
  // call the dialogue dispatcher) pass the page index as their talk goes on.
  // Here the room's scenes play in order: one starts shortly after the room
  // does when a talker has no sprite (a scene script) or there is no talker,
  // else when the player walks up to any talker.
  const talkers = room.insts.filter(i => TALKERS.has(G.objects.get(i.obj)?.name));
  const script = !talkers.length || talkers.some(t => G.objects.get(t.obj).sprite < 0);
  const sonScene = bosses.some(b => b.kind === 'objBoss' || b.kind === 'objColombianBoss');
  const directorInst = room.insts.find(i => G.objects.get(i.obj)?.name === FILM_SET.obj);
  const film = directorInst && { inst: directorInst, x: directorInst.x, y: directorInst.y, frame: 0, sprite: need(FILM_SET.walk), arrived: false, wait: 0 };
  // The film set's talk is two pages played apart: one during the walk, one on the set.
  const talkList = sonScene ? [] : film ? (TALKS[room.id] || []).flat().map(pg => [pg]) : TALKS[room.id] || [];
  const talks = talkList.map((pages, k) => {
    for (const [face] of pages) if (face) need(face);
    const near = talkers.filter(t => G.objects.get(t.obj).sprite >= 0);
    return { pages, at: (script || env.intro) && k === 0 || !near.length ? null : near };
  });
  // Native: in the Fans' hideout the talk ends with the player free; the scene
  // goes on when they walk to the van (objFansVan).
  const van = env.intro && room.insts.find(i => G.objects.get(i.obj)?.name === 'objFansVan');
  // With no talk in the data the van is open from the start.
  let vanWait = !!van && !talks.length;
  const vanBox = van && maskBox(G, G.objects.get(van.obj), van);
  const atVan = () => overlap(p, box, van, { l: vanBox.l - INTRO_VAN_REACH, r: vanBox.r + INTRO_VAN_REACH, t: vanBox.t - INTRO_VAN_REACH, b: vanBox.b + INTRO_VAN_REACH });
  // The date card (objDate); see DATE_CARD.
  let card = DATES[room.id] && G.text?.[DATES[room.id][0]] ? { row: DATES[room.id], off: DATE_CARD.from, hold: DATE_CARD.hold, veil: DATE_CARD.veil } : null;
  function stepCard() {
    if (card.hold > 0 && card.off > 0) card.off = Math.max(0, card.off - DATE_CARD.in);
    else if (card.hold > 0) card.hold--;
    else {
      card.off += DATE_CARD.out;
      if ((card.veil -= DATE_CARD.fade) <= 0) card = null;
    }
  }
  function drawCard() {
    const [id, y, mo, d, h, mi] = card.row, D = DATE_CARD, mid = VIEW_W / 2, off = card.off;
    const rows = [dateLine(y, mo, d), G.text[id]];
    cx.save();
    cx.fillStyle = `rgba(0,0,0,${Math.max(0, card.veil)})`;
    cx.fillRect(0, 0, VIEW_W, VIEW_H);
    const put = (f, t, yy, colour, css) => f ? drawText(cx, f, t, mid, yy, { align: 0.5, colour })
      : (cx.font = css, cx.textAlign = 'center', cx.textBaseline = 'top', cx.fillStyle = colour, cx.fillText(t, mid, yy));
    put(dateFonts.time, `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, D.time - off, D.clock, 'bold 30px monospace');
    const w = Math.round(D.ruleW * Math.max(0, 1 - off / D.from));
    if (w > 0) {
      cx.fillStyle = 'rgb(247,247,247)'; cx.fillRect(Math.round(mid - w / 2), D.rule, w, 1);
      cx.fillStyle = 'rgb(119,119,119)'; cx.fillRect(Math.round(mid - w / 2), D.rule + 1, w, 1);
    }
    rows.forEach((r, k) => put(dateFonts.date, r, D.text + off + k * D.line, '#fff', 'bold 11px monospace'));
    cx.restore();
  }
  let talkClock = 0;
  const drawFace = (c, name, frame, x, y, h) => {
    const a = art.get(name);
    if (!a) return 0;
    const f = a.hit.frames[Math.floor(frame) % a.hit.frames.length];
    // h 0: the talk screen's big portrait, right edge on x (the talk screen's portrait panel)
    if (!h) { const z = TALK.faceScale; c.drawImage(imgs.get(a.hit.atlas), f.x, f.y, f.w, f.h, x - f.w * z, y, f.w * z, f.h * z); return f.w * z; }
    const k = Math.min(1, h / f.h);
    c.drawImage(imgs.get(a.hit.atlas), f.x, f.y, f.w, f.h, x, y + (h - f.h * k) / 2, Math.round(f.w * k), Math.round(f.h * k));
    return Math.round(f.w * k);
  };
  function stepTalk() {
    // Native opens no talk until the date card has gone.
    if (card) return;
    talkClock++;
    if (env.cutscene && !env.cutscene.done || p.dead) return;
    if (!talks.length) {
      if (env.cutscene) { env.cutscene = null; if (van) vanWait = true; else env.talkDone?.(); }
      if (vanWait && atVan()) { vanWait = false; env.talkDone?.(); }
      return;
    }
    const t = talks[0];
    // Native: the first talk plays while the director is still walking down; the
    // next waits for him to stop and the camera to pan over to the set.
    if (film && (film.arrived ? talkClock < FILM_SET.panWait : film.talked)) return;
    if (talkClock < TALK.startDelay || t.at && !t.at.some(a => Math.hypot(p.x - a.x, p.y - a.y) <= TALK.reach)) return;
    const phone = t.at?.some(a => PHONES.test(G.objects.get(a.obj).name));
    if (phone && !mouse.click && !mouse.right) return;
    if (phone) { mouse.click = mouse.right = false; if (hint) hint.talked = true; }
    talks.shift();
    if (film) film.talked = true;
    env.cutscene = conversation(G, t.pages, { drawFace, fonts: talkFonts });
  }

  if (sonScene) for (const [face] of (TALKS[room.id] || []).flat()) if (face) need(face);
  await Promise.all([...art.values()].map(a => env.load(a.hit.atlas)));
  started = true;
  if (env.cancelled?.()) return null;

  // Pre-render the room into the layers under and over the player, leaving
  // out everything that moves.
  const dynamic = new Set([spawn, ...enemies.map(e => e.inst), ...doors.map(d => d.inst), ...weapons.map(w => w.inst), ...exits.map(x => x.inst), ...screens.map(s => s.inst), ...sliders.map(d => d.inst), ...elevators.map(l => l.inst), ...bosses.flatMap(b => [b.inst, b.actor].filter(Boolean)), film?.inst]);
  // Art may hang past the room's edges (the Fans' van sits 11px below
  // rmFansLevel1Floor1); the exe draws it there, so the layers keep a margin.
  const layer = (keep) => {
    const pad = LAYER_PAD, c = new OffscreenCanvas(room.w + 2 * pad, room.h + 2 * pad), cx = c.getContext('2d');
    cx.translate(pad, pad);
    drawRoomItems(cx, items, imgs, keep, dynamic);
    c.pad = pad;
    return c;
  };
  const under = layer(i => i.depth >= pobj.depth), over = layer(i => i.depth < pobj.depth);
  // Blood stays where it lands: settled splats are drawn once into this layer.
  const gore = new OffscreenCanvas(room.w, room.h), goreCx = gore.getContext('2d'), splats = [];
  const stamp = (name, frame, x, y, angle, scale) => {
    const a = art.get(name);
    if (!a) return;
    const f = a.hit.frames[Math.floor(frame) % a.hit.frames.length];
    goreCx.save(); goreCx.translate(x, y); goreCx.rotate(-angle * RAD); goreCx.scale(scale, scale);
    goreCx.drawImage(imgs.get(a.hit.atlas), f.x, f.y, f.w, f.h, -a.s.ox, -a.s.oy, f.w, f.h);
    goreCx.restore();
  };
  function bleed(x, y, dir, pool) {
    if (pool && poolSprites.length) { const n = poolSprites[Math.floor(random(poolSprites.length))]; stamp(n, random(frames(n)), x, y, random(360), 1); }
    for (let i = 0; i < BLOOD.count && splatSprites.length; i++) {
      splats.push({ x, y, sprite: splatSprites[Math.floor(random(splatSprites.length))], frame: 0, angle: random(360),
        scale: BLOOD.scaleMin + random(BLOOD.scaleRand), dir: dir + random(2 * BLOOD.spread) - BLOOD.spread, speed: BLOOD.speedMin + random(BLOOD.speedRand) });
    }
  }
  function stepSplat(q) {
    q.x += lenX(q.speed, q.dir); q.y += lenY(q.speed, q.dir);
    q.speed = Math.max(0, q.speed - BLOOD.friction);
    q.frame = Math.min(q.frame + BLOOD.imageSpeed, frames(q.sprite) - 1);
    if (q.speed || q.frame < frames(q.sprite) - 1) return true;
    stamp(q.sprite, q.frame, q.x, q.y, q.angle, q.scale);
    return false;
  }

  // Most rooms have no player instance; then start near the centre, clear of enemies.
  // Coming up from the floor before, the player stays where they were.
  const carry = env.carry;
  // The level's tally so far: kills and steps, from the floors before.
  const stats = { kills: 0, steps: 0, score: 0, ...carry?.stats };
  // The HUD's score counts up toward the real one; popups are the "Npts" texts.
  let shownScore = stats.score;
  const popups = [], pieces = [];
  const award = (pts, x, y) => {
    stats.score += pts;
    popups.push({ text: pts + 'PTS', x, y, t: POINTS.popup });
  };
  const combo = { n: 0, t: 0 };
  const killed = () => { stats.kills++; combo.n++; combo.t = COMBO.time; };
  const stepCombo = () => {
    if (combo.t <= 0 || --combo.t > 0) return;
    if (combo.n > 1) {
      stats.score += COMBO.bonus(combo.n);
      popups.push({ text: combo.n + 'xCOMBO', x: p.x, y: p.y - COMBO.popupDy, t: POINTS.popup });
    }
    combo.n = 0;
  };
  // With no player instance the player gets out of the level's car (objCar's
  // children, e.g. objFansVan), as in play footage: a step toward the room's
  // middle from it. With no car, where the mask or style menu sits (a guess).
  const { menuAt, carAt } = pickerStart(G, room);
  const from = spawn || entry || bossEnter || carAt || menuAt;
  if (carry && entry && !spawn && !carry.elevator) { carry.x = entry.x; carry.y = entry.y; }
  const clear = (x, y) => carry || spawn || enemies.every(e => Math.hypot(e.x - x, e.y - y) > 64);
  const lift = carry?.elevator && elevators.reduce((a, l) => !a || Math.abs(l.x - carry.elevator.x) < Math.abs(a.x - carry.elevator.x) ? l : a, null);
  if (lift) { carry.x = lift.to.x; carry.y = lift.to.y; }
  // A smaller room after a big floor (rmBankVault after the back room) cannot take the carried spot.
  const fits = carry && carry.x >= 0 && carry.y >= 0 && carry.x < room.w && carry.y < room.h;
  let at = fits ? nearestFree(sol, box, carry.x, carry.y)
    : nearestFree(sol, box, from ? from.x : room.w >> 1, from ? from.y : room.h >> 1, clear);
  // A carried spot walled off from every exit (rmLSDFloor4 after rmTigersDen
  // keeps the last room's spot, outside its walls) moves to the room's marker
  // when that reaches one, else to the far end of the way to the first exit,
  // as if walked in from there. A guess: nothing places the player there.
  const reaches = (q) => { const d = gridReach(pg, q.x, q.y); return exits.some(x => d[gridCell(pg, x.x, x.y)]); };
  if (fits && exits.length && !reaches(at)) {
    const mark = from || room.insts.find(i => G.objects.get(i.obj)?.name === 'objLSD');
    const alt = mark && nearestFree(sol, box, mark.x, mark.y);
    if (alt && reaches(alt)) at = alt;
    else {
      const d = gridReach(pg, exits[0].x, exits[0].y), far = d.reduce((m, v, i) => v > d[m] ? i : m, 0), c = PATH.cell;
      const q = nearestFree(sol, box, (far % pg.cw + 0.5) * c, (Math.floor(far / pg.cw) + 0.5) * c);
      if (d[far] > 1 && reaches(q)) at = q;
    }
  }
  const p = { x: at.x, y: at.y, hs: 0, vs: 0, aim: 0, dir: 0, frame: 0, sprite: P.walk, attack: null, attackFrame: 0, cooldown: 0, weapon: null, exec: null,
    ammo: 0, barrel: -1, dead: null, roll: null, rollCool: 0, spread: false, flash: 0, punch: 0 };
  if (carry && arm[carry.weapon]) { p.weapon = carry.weapon; p.ammo = carry.ammo; p.sprite = arm[carry.weapon].walk; }
  else if (!carry && arm.Special) { p.weapon = 'Special'; p.ammo = arm.Special.ammo; p.sprite = arm.Special.walk; }
  else if (!carry && fan?.start) {
    const w = fan.start.find(w => arm[w]);
    if (w) { p.weapon = w; p.ammo = arm[w].ammo; p.sprite = arm[w].walk; }
  }
  // The exit the player arrives on stays off until they step off it. A hub
  // arrival lands a few px in from that exit, so near counts as on.
  const arriveBox = { l: box.l - ARRIVE_PAD, t: box.t - ARRIVE_PAD, r: box.r + ARRIVE_PAD, b: box.b + ARRIVE_PAD };
  for (const x of exits) x.off = overlap(p, carry ? arriveBox : box, x, x.box) && (carry ? arriveBox : box);
  for (const l of elevators) l.used = overlap(p, box, l, l.box);
  const keys = new Set(), pressed = new Set();
  const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, click: false, right: false };
  const cam = { x: 0, y: 0, shake: 0 };
  const night = NIGHT.room.test(room.name), floor2 = FLOOR2_HINT.room.test(room.name);
  const hint = (night || floor2) && G.text?.[NIGHT.hint.text] ? { font: await loadFont(G, NIGHT.hint.font), kills: stats.kills } : null;
  const restartFont = G.text?.[RESTART.text] ? await loadFont(G, RESTART.font) : null;
  const pointsFont = G.wad ? await loadFont(G, SCORE_HUD.font) : null;
  const comboFont = G.wad ? await loadFont(G, COMBO.font).catch(() => null) : null;
  const ammoFont = G.wad ? await loadFont(G, 'fntAmmo').catch(() => null) : null;
  const dateFonts = card ? { time: await loadFont(G, 'fntTime'), date: await loadFont(G, 'fntDate') } : {};
  const talkFonts = G.text ? { text: await loadFont(G, TALK.fontName), skip: await loadFont(G, TALK.skip.font) } : {};
  const onKey = (e) => {
    if (env.paused?.()) return;
    if (e.type === 'keydown' && (e.target.closest?.('input, select, textarea, button') || e.target.isContentEditable)) return;
    // Enter advances a talk box as in native; it is not rebindable.
    const k = e.key === 'Enter' ? 'enter' : gameKey(e.key);
    if (!['enter', 'w', 'a', 's', 'd', ' ', 'r', 'f', 'e', 'q', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) pressed.add(k);
    e.type === 'keydown' ? keys.add(k) : keys.delete(k);
  };
  const onMouse = (e) => {
    if (env.paused?.()) return;
    if (e.type === 'mousedown') canvas.focus?.({ preventScroll: true });
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * VIEW_W / r.width;
    mouse.y = (e.clientY - r.top) * VIEW_H / r.height;
    // Ctrl+click is a Mac trackpad's right click.
    if (e.type === 'mousedown' && e.button === 0 && !e.ctrlKey) mouse.click = true;
    if (e.type === 'mousedown' && (e.button === 2 || (e.button === 0 && e.ctrlKey))) mouse.right = mouse.rightHeld = true;
    if (e.type === 'mousedown' && e.button === 1) { e.preventDefault(); pressed.add('q'); }
  };
  let wheelAt = -Infinity;
  const onWheel = (e) => {
    if (env.paused?.()) return;
    e.preventDefault();
    if (e.timeStamp - wheelAt > LOCK_INPUT.wheelGap) pressed.add('q');
    wheelAt = e.timeStamp;
  };
  const noMenu = (e) => e.preventDefault();
  const clearInput = () => { keys.clear(); pressed.clear(); mouse.click = mouse.right = false; p.hs = p.vs = 0; };
  const visibility = () => { if (globalThis.document?.hidden) clearInput(); };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', clearInput);
  globalThis.document?.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('mousemove', onMouse);
  canvas.addEventListener('mousedown', onMouse);
  const onMouseUp = (e) => { if (e.button === 2 || e.button === 0) mouse.rightHeld = false; };
  globalThis.addEventListener?.('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', noMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = VIEW_W * zoom + 'px';
  canvas.style.height = VIEW_H * zoom + 'px';
  const cx = canvas.getContext('2d');

  const frames = (name) => art.get(name)?.hit.frames.length || 1;
  const held = () => p.weapon && arm[p.weapon];
  const walkSprite = () => held() ? held().walk : P.walk;
  // Combat state must not depend on whether a particular animation exists.
  const attacking = () => !!p.attack;
  const solidAt = (x, y) => {
    const xx = Math.round(x), yy = Math.round(y);
    return xx < 0 || yy < 0 || xx >= walls.w || yy >= walls.h || walls.grid[yy * walls.w + xx] === 1;
  };
  // Line of sight: sample the wall grid every 4px. A door leaf blocks it
  // too, so nobody sees through a shut door.
  const cross = (o, p2, q, r) => (p2.x - o.x) * (r.y - q.y) - (p2.y - o.y) * (r.x - q.x);
  const blocksSight = (a, b, d) => {
    const q = { x: d.x, y: d.y }, r = { x: d.x + lenX(DOOR.length, d.base + d.angle), y: d.y + lenY(DOOR.length, d.base + d.angle) };
    const den = cross(a, b, q, r);
    if (!den) return false;
    const t = ((q.x - a.x) * (r.y - q.y) - (q.y - a.y) * (r.x - q.x)) / den, u = ((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / den;
    return t > 0 && t < 1 && u >= 0 && u <= 1;
  };
  const sees = (a, b) => {
    const d = dist(a, b), n = Math.ceil(d / 4);
    for (let i = 1; i < n; i++) if (solidAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return !doors.some(dr => blocksSight(a, b, dr));
  };
  // An enemy sees the player only within ENEMY.sight (0x42d8e0).
  const spots = e => !p.dead && dist(e, p) <= ENEMY.sight && sees(e, p);
  const aimDeg = () => (-p.aim / RAD + 360) % 360;

  // scrKnockOut: the enemy becomes a body sliding away from what hit it.
  // An enemy's gun falls where it stood, if the player can use it; the ammo
  // left in it is a guess (a full load).
  function dropGun(e) {
    if (!e.gun || !arm[e.gun] || !looseSprite[e.gun]) return;
    weapons.push({ name: e.gun, x: e.x, y: e.y, angle: random(360), dir: random(360), speed: 2, ammo: GUNS[e.gun]?.ammo ?? 0, sprite: looseSprite[e.gun] });
    e.gun = null;
  }
  // The couple splits into the man and the woman; a hit meant for the couple
  // lands on the man.
  function split(c) {
    enemies.splice(enemies.indexOf(c), 1);
    for (const e of c.pair) { enemies.push(e); if (e.mafia) Object.assign(e, { alert: true, seen: { x: p.x, y: p.y }, wait: firstShot() }); }
    return c.pair.find(e => e.isEnemy) || c.pair[0];
  }
  function stepCouple(c) {
    c.frame += c.imageSpeed;
    if (c.frame >= frames(c.sprite)) { c.frame = 0; c.sprite = c.spr.idle = need(COUPLE.idle[Math.floor(random(COUPLE.idle.length))]); }
    if (!p.dead && dist(c, p) < COUPLE.near && sees(c, p)) split(c);
  }
  function knockOut(e, dir, sound) {
    if (e.couple) e = split(e);
    if (e.dodger && sound === SOUND.thrown) return evade(e);
    if (e.dodger && sound === SOUND.door) {
      Object.assign(e, { sprite: e.spr.stunned, frame: 0, hs: 0, vs: 0, path: null, sleep: false, alert: true });
      return;
    }
    if (e.dog || e.dodger || e.hiding) { sfx(sound); return shoot(e, dir, false, e.spr.deadBlunt); }
    if (e.fat) return;
    sfx(sound);
    enemies.splice(enemies.indexOf(e), 1);
    dropGun(e);
    const sprite = e.spr.getUp || e.spr.idle || e.sprite || e.spr.walk;
    kos.push({ obj: e.obj, isEnemy: e.isEnemy, x: e.x, y: e.y, dir, speed: random(KO.speedRand) + KO.speedMin, angle: dir, sprite, spr: e.spr,
      frame: Math.min(1, frames(sprite) - 1), imageSpeed: 0, alarm: Math.floor(random(KO.waitRand)) + KO.waitMin, box: e.box, gun: e.gun,
      fallbackPose: !e.spr.getUp });
    cam.shake = KO.shake;
  }
  // A dodger hit by a bullet or a thrown weapon starts its dodge, or holds it.
  function evade(e) {
    if (e.sprite !== e.spr.dodge) Object.assign(e, { sprite: e.spr.dodge, frame: 0, hs: 0, vs: 0, path: null });
    else if (e.frame > DODGER.hold) e.frame = DODGER.hold;
    e.sleep = false; e.alert = true;
  }
  function bulletHit(e, dir, shotgun) {
    if (e.couple) e = split(e);
    if (e.dodger) evade(e); else shoot(e, dir, shotgun);
  }
  // A bullet kills outright. The dead sprites hold several poses; picking
  // one at random is a guess.
  function shoot(e, dir, shotgun, sprite) {
    if (e.couple) e = split(e);
    if (e.fat && --e.hp > 0) return;
    const k = enemies.includes(e) ? enemies : kos;
    if (e.isEnemy) { killed(); award(e.fat ? POINTS.fat : k === kos ? POINTS.downed : POINTS.kill, e.x, e.y); }
    k.splice(k.indexOf(e), 1);
    dropGun(e);
    const s = sprite || (shotgun && e.spr.deadShotgun) || e.spr.deadShot;
    bleed(e.x, e.y, dir ?? e.angle, true);
    if (e.burst) dead.push({ x: e.x, y: e.y, angle: e.angle, sprite: s, frame: 0, imageSpeed: BURST.speed, burst: true });
    else if (e.fat) dead.push({ x: e.x, y: e.y, angle: e.angle, sprite: s, frame: 1, imageSpeed: 0 });
    else if (s) dead.push({ x: e.x, y: e.y, angle: dir, sprite: s, frame: Math.floor(random(frames(s))), imageSpeed: 0 });
    else if (e.spr.killStomp) dead.push({ x: e.x, y: e.y, angle: dir, sprite: e.spr.killStomp, frame: frames(e.spr.killStomp) - 1, imageSpeed: 0 });
  }
  function killPlayer(sprite, dir) {
    if (p.dead || p.exec) return;
    const s = sprite || P.deadShot;
    p.dead = { sprite: s, angle: dir, frame: s ? Math.floor(random(frames(s))) : 0 };
    bleed(p.x, p.y, dir, true);
    p.hs = p.vs = 0;
    env.status('Dead. Press R to restart the room.');
  }

  // Gun fire: pellets leave from the muzzle. With the muzzle in a wall the
  // shot hits whatever is right in front instead.
  function fire(o, deg, g, byPlayer, side = 0) {
    let mx = o.x + lenX(g.muzzle, deg), my = o.y + lenY(g.muzzle, deg);
    if (side) { mx += lenX(g.side, deg + side * 90); my += lenY(g.side, deg + side * 90); }
    cam.shake = Math.max(cam.shake, byPlayer ? g.shake : 0);
    sfx(g.sound);
    if (solidAt(mx, my)) {
      if (byPlayer) for (const e of [...enemies]) if (overlap({ x: (o.x + mx) / 2, y: (o.y + my) / 2 }, box, e, e.box)) bulletHit(e, deg, g.pellets > 1);
      return;
    }
    for (let i = 0; i < g.pellets; i++)
      bullets.push({ x: mx, y: my, dir: deg - g.spread + random(2 * g.spread), speed: g.speed + random(g.speedRand), byPlayer, shotgun: g.pellets > 1 });
  }
  // objBullet step: fly, die on walls or outside the room, kill what it hits.
  // The path is tested every 2px so fast rounds cannot skip a wall.
  function stepBullet(b) {
    const n = Math.ceil(b.speed / 2), dx = lenX(b.speed, b.dir) / n, dy = lenY(b.speed, b.dir) / n;
    for (let i = 0; i < n; i++) {
      b.x += dx; b.y += dy;
      if (b.x < -BULLET.margin || b.y < -BULLET.margin || b.x > room.w + BULLET.margin || b.y > room.h + BULLET.margin) return false;
      const screen = screens.find(s => !s.hit && overlap(b, ZERO, s, s.box));
      if (screen) { screen.hit = true; screen.sprite = screen.brk; screen.frame = 0; screen.speed = SCREENS.imageSpeed; sfx(SCREENS.sound); }
      if (b.x >= 0 && b.y >= 0 && b.x < room.w && b.y < room.h && solidAt(b.x, b.y)) return false;
      if (b.byPlayer) {
        const boss = bosses.find(q => q.kind === 'objColombianBoss' && overlap(b, ZERO, q, q.box));
        if (boss && hitSonBoss(boss, sonContext)) return false;
        const e = enemies.find(e => overlap(b, ZERO, e, e.box));
        if (e) { bulletHit(e, b.dir, b.shotgun); return false; }
      } else if (!p.dead && !p.exec && !(p.roll && p.roll.frame < fan.roll.invulnerable) && overlap(b, ZERO, p, box)) { killPlayer(P.deadShot, b.dir); return false; }
    }
    return true;
  }

  // scrThrow: the held weapon leaves along the aim.
  function throwWeapon() {
    sfx(SOUND.throw);
    weapons.push({ name: p.weapon, x: p.x, y: p.y, angle: aimDeg(), dir: aimDeg(), speed: WEAPON.throwSpeed, ammo: p.ammo, sprite: looseSprite[p.weapon], thrown: true });
    p.weapon = null;
    p.ammo = 0;
  }
  // scrPickupThrow / scrPickup.
  function pickupOrThrow() {
    const reach = scaleBox(box, WEAPON.pickupScale);
    const w = weapons.find(w => w.speed === 0 && overlap(p, reach, w, wbox));
    if (w) {
      if (p.weapon) throwWeapon();
      weapons.splice(weapons.indexOf(w), 1);
      sfx(SOUND.blades.test(w.name) ? SOUND.drawKnife : SOUND.pickup);
      const disarm = P.disarm?.[w.name];
      if (disarm) {
        p.sprite = disarm; p.attackFrame = 0;
        p.attack = { frames: frames(disarm), gun: true, imageSpeed: 0.5 };
        return;
      }
      p.weapon = w.name;
      p.ammo = w.ammo ?? 0;
    } else if (p.weapon) throwWeapon();
    if (!attacking()) p.sprite = walkSprite();
  }

  // scrSpaceAction / scrExecute: kill a knocked-out body.
  function execute() {
    const reach = scaleBox(box, EXEC.scale);
    const k = kos.find(k => overlap(p, reach, k, k.box));
    if (!k) return false;
    const e = k, blunt = held() && held().kill !== P.stomp;
    const body = (blunt ? e.spr.killBlunt : e.spr.killStomp) || e.spr.deadShot || e.sprite;
    const animation = (held() ? held().kill : P.stomp), kill = animation || P.punch || P.walk;
    const duration = animation ? frames(animation) : 6;
    kos.splice(kos.indexOf(k), 1);
    if (hint) hint.stage = 2;
    if (k.spr.exec) {
      const own = k.spr.exec, d = { x: k.x, y: k.y, angle: k.angle, sprite: own, frame: frames(own) - 1, imageSpeed: 0 };
      p.exec = { x: k.x, y: k.y, angle: k.angle, sprite: own, frame: 0, duration: frames(own), body: { ...d }, hit: Infinity, after: d };
      p.x = k.x; p.y = k.y; p.hs = p.vs = 0;
      sfx(SOUND.exec); sfx(SOUND.execThud);
      return true;
    }
    if (fan?.nonLethal) {
      // The body stays down where it lay, in its knocked-out pose.
      if (k.isEnemy) award(POINTS.exec, k.x, k.y);
      const d = { x: k.x, y: k.y, angle: k.angle + (k.fallbackPose ? 90 : 0), sprite: k.sprite, frame: k.frame, imageSpeed: 0 };
      dead.push(d);
      p.exec = { x: k.x, y: k.y, angle: k.angle + 180, sprite: kill, frame: 0, duration, body: { ...d }, hit: Infinity };
      sfx(SOUND.punch);
      p.x = k.x; p.y = k.y; p.hs = p.vs = 0;
      return true;
    }
    if (k.isEnemy) { killed(); award(POINTS.exec, k.x, k.y); }
    const d = { x: k.x, y: k.y, angle: k.angle, sprite: body, frame: 0, imageSpeed: EXEC.imageSpeed * frames(body) / duration };
    dead.push(d);
    bleed(k.x, k.y, k.angle, true);
    p.exec = { x: k.x, y: k.y, angle: k.angle + 180, sprite: kill, frame: 0, duration, body: d, hit: 0 };
    sfx(SOUND.exec); sfx(SOUND.execThud);
    p.x = k.x; p.y = k.y; p.hs = p.vs = 0;
    return true;
  }
  // Corey's roll: straight along the way he moves (or aims), bullets pass.
  function stepRoll() {
    const r = p.roll;
    moveAxis(sol, box, p, 'x', Math.cos(r.dir) * fan.roll.speed);
    moveAxis(sol, box, p, 'y', Math.sin(r.dir) * fan.roll.speed);
    p.dir = r.dir;
    r.frame += fan.roll.imageSpeed;
    if (r.frame >= frames(P.roll)) { p.roll = null; p.hs = Math.cos(r.dir) * MOVE.maxSpeed; p.vs = Math.sin(r.dir) * MOVE.maxSpeed; }
  }
  // Mark's arms: shoulders either side of the body, each aimed at the cursor,
  // or straight out to its side when spread. GameMaker degrees.
  function bearArms() {
    const a = aimDeg(), mx = mouse.x + cam.x, my = mouse.y + cam.y;
    return [-1, 1].map(side => {
      const x = p.x + lenX(fan.special.shoulder, a + side * 90), y = p.y + lenY(fan.special.shoulder, a + side * 90);
      return { side, x, y, deg: p.spread ? a + side * 90 : pointDir(x, y, mx, my) };
    });
  }
  function stepExec() {
    const x = p.exec;
    x.frame += EXEC.imageSpeed;
    x.body.frame = Math.min(x.body.frame + x.body.imageSpeed, frames(x.body.sprite) - 1);
    if (Math.floor(x.body.frame) > x.hit) { x.hit = Math.floor(x.body.frame); bleed(x.x, x.y, x.angle, false); }
    if (x.frame < x.duration) return;
    x.body.frame = frames(x.body.sprite) - 1;
    x.body.imageSpeed = 0;
    let px = x.x, py = x.y;
    if (p.weapon === 'Hammer') { px += lenX(EXEC.hammerShift, x.angle + 90); py += lenY(EXEC.hammerShift, x.angle + 90); }
    const at = nearestFree(sol, box, px, py);
    p.x = at.x; p.y = at.y;
    p.sprite = walkSprite();
    if (x.after) dead.push(x.after);
    p.exec = null;
  }

  // objWeapon step plus its enemy and wall collisions.
  function stepWeapon(w) {
    if (w.speed <= 0) return;
    const mx = moveAxis(walls, wbox, w, 'x', lenX(w.speed, w.dir)), my = moveAxis(walls, wbox, w, 'y', lenY(w.speed, w.dir));
    if (!mx && lenX(w.speed, w.dir)) { w.dir = (540 - w.dir) % 360; w.speed *= WEAPON.bounce; }
    if (!my && lenY(w.speed, w.dir)) { w.dir = (360 - w.dir) % 360; w.speed *= WEAPON.bounce; }
    for (const e of [...enemies])
      if (w.speed >= WEAPON.hitSpeed && overlap(w, wbox, e, e.box)) {
        if (fan?.lethalThrow && w.thrown) shoot(e, w.dir, false, e.spr.deadBlunt); else knockOut(e, w.dir, SOUND.thrown);
        w.speed *= WEAPON.hitDamp;
      }
    const hs = lenX(w.speed, w.dir), vs = lenY(w.speed, w.dir);
    w.angle += Math.sign(Math.abs(hs) > 0.001 ? hs : vs) * w.speed * WEAPON.spin;
    w.speed = Math.max(0, w.speed - WEAPON.friction);
  }

  function stepPlayer() {
    if (pressed.has('r') && env.restart) { pressed.clear(); running = false; env.restart(); return; }
    if (p.dead) { mouse.click = mouse.right = false; return; }
    if (p.exec) { stepExec(); mouse.click = mouse.right = false; return; }
    if (p.ride) { p.hs = p.vs = 0; mouse.click = mouse.right = false; return; }
    if (p.locked) { p.hs = p.vs = 0; mouse.click = mouse.right = false; pressed.clear(); return; }
    if (p.rollCool > 0) p.rollCool--;
    if (p.flash > 0) p.flash--;
    if (p.roll) { stepRoll(); mouse.click = mouse.right = false; return; }
    const ix = (keys.has('d') || keys.has('arrowright')) - (keys.has('a') || keys.has('arrowleft'));
    const iy = (keys.has('s') || keys.has('arrowdown')) - (keys.has('w') || keys.has('arrowup'));
    p.hs = ix ? approach(p.hs, ix * MOVE.maxSpeed, MOVE.accel) : approach(p.hs, 0, MOVE.friction);
    p.vs = iy ? approach(p.vs, iy * MOVE.maxSpeed, MOVE.accel) : approach(p.vs, 0, MOVE.friction);
    while (Math.abs(p.hs) + Math.abs(p.vs) > MOVE.maxSpeed + MOVE.diagSlack) { p.hs *= MOVE.diagScale; p.vs *= MOVE.diagScale; }
    p.hs = moveAxis(sol, box, p, 'x', p.hs, CORNER);
    p.vs = moveAxis(sol, box, p, 'y', p.vs, CORNER);
    if (p.hs || p.vs) { p.dir = Math.atan2(p.vs, p.hs); p.frame += MOVE.animSpeed; }

    if (p.cooldown > 0) p.cooldown--;
    if (mouse.right && !fan?.noPickup) {
      // Mark spreads his arms while the MP5s have rounds; empty, he drops them.
      if (p.weapon === 'Special' && p.ammo > 0) p.spread = !p.spread;
      else {
        if (p.weapon === 'Special') { p.weapon = null; p.spread = false; }
        pickupOrThrow();
      }
    }
    mouse.right = false;
    if (pressed.has(' ') && !attacking() && !execute() && fan?.roll && p.rollCool <= 0) {
      p.roll = { frame: 0, dir: p.hs || p.vs ? Math.atan2(p.vs, p.hs) : p.aim };
      p.rollCool = fan.roll.cooldown;
      return;
    }
    if (mouse.click && !(p.cooldown > 0) && !attacking() && !p.exec) {
      const a = held();
      if (a?.special) {
        // Mark fires one arm at a time, from its hand; the body keeps walking.
        if (p.ammo > 0) {
          p.ammo--;
          p.barrel = -p.barrel;
          p.cooldown = a.cooldown; p.flash = fan.special.flash;
          const s = bearArms().find(s => s.side === p.barrel);
          fire(s, s.deg, a, true);
        }
      } else if (a && a.gun) {
        // The double barrel fires only from its walk sprite; an empty gun does nothing.
        if (p.ammo > 0 && (a.side === undefined || p.sprite === a.walk)) {
          p.ammo--;
          p.barrel = -p.barrel;
          p.sprite = a.side !== undefined && p.barrel < 0 ? a.attack2 : a.attack;
          p.attackFrame = a.startFrame || 0; p.cooldown = a.cooldown;
          p.attack = { frames: frames(p.sprite), gun: true, imageSpeed: a.imageSpeed };
          fire(p, aimDeg(), a, true, a.side !== undefined ? p.barrel : 0);
          if (fan?.doubleFire) fire(p, aimDeg() + 3, a, true, a.side !== undefined ? -p.barrel : 0);
        }
      } else {
        const punch = P.punches[p.punch++ % (P.punches.length || 1)];
        p.sprite = a ? a.attack : punch || P.walk;
        p.attack = { frames: (a || punch) ? frames(p.sprite) : Math.ceil(MELEE.cooldown * MELEE.imageSpeed), gun: false, imageSpeed: MELEE.imageSpeed, hits: new Set() };
        p.attackFrame = a ? a.frame : MELEE.startFrame; p.cooldown = MELEE.cooldown;
        sfx(SOUND.swing[Math.floor(random(2))]);
      }
    }
    mouse.click = false;
    if (attacking()) {
      const reach = { x: p.x + MELEE.reach * Math.cos(p.aim), y: p.y + MELEE.reach * Math.sin(p.aim) };
      if (!p.attack.gun) for (const e of [...enemies]) {
        if (!(overlap(p, box, e, e.box) || overlap(reach, box, e, e.box))) continue;
        const dir = pointDir(p.x, p.y, e.x, e.y);
        // Tony's fists and the chainsaw kill: once per swing, so a fat one takes several.
        if (fan?.lethal && !held()) {
          if (p.attack.hits.has(e)) continue;
          p.attack.hits.add(e);
          sfx(SOUND.hit);
          shoot(e, dir, false, e.spr.deadBlunt);
        } else knockOut(e, dir, held() ? SOUND.hit : SOUND.punch);
      }
      p.attackFrame += p.attack.imageSpeed;
      if (p.attackFrame >= p.attack.frames) { p.attack = null; p.sprite = walkSprite(); p.attackFrame = 0; }
    }
  }

  // The mafia and gang: wander on alarm 0 until it sees the player, then chase and
  // shoot (or run in to hit, unarmed or with a melee weapon).
  function stepMafia(e) {
    const g = e.g;
    if (--e.check <= 0) {
      e.check = e.dog ? DOG.recheck : ENEMY.recheck;
      // The first shot waits 15 steps of sight (var 17, set to 15 at create).
      if (spots(e)) {
        if (!e.alert) { e.wait = firstShot(); if (e.dog) sfx(DOG.bark); }
        e.alert = true; e.seen = { x: p.x, y: p.y };
      }
    }
    let speed = 0;
    // GUESS: Victim2 stands idle until it notices the player (native fetched the bat as the player came in).
    if (e.gun === 'Unarmed' && !e.dog && !(e.calmUntilSeen && !e.alert) && unarmed(e)) {
      if (e.hs || e.vs) e.sprite = e.spr.walk;
      // 0xf4e710 moved it (stepUnarmed below).
    } else if (!e.alert) {
      if (!e.still && --e.alarm <= 0) {
        e.alarm = ENEMY.wanderMin + Math.floor(random(ENEMY.wanderRand));
        e.moveDir = random(360);
        const speed = Math.round(random(1));
        e.hs = lenX(speed, e.moveDir); e.vs = lenY(speed, e.moveDir);
        e.imageSpeed = speed * ENEMY.wanderAnim;
        if (!speed) e.frame = 0;
      }
      if (!free(walls, e.box, e.x + e.hs * ENEMY.ahead, e.y)) e.hs = -e.hs;
      if (!free(walls, e.box, e.x, e.y + e.vs * ENEMY.ahead)) e.vs = -e.vs;
    } else {
      const see = spots(e);
      if (see) e.seen = { x: p.x, y: p.y };
      const goal = e.seen, d = goal ? dist(e, goal) : 0, dir = goal ? pointDir(e.x, e.y, goal.x, goal.y) : e.angle;
      if (see && g) {
        // 0xdc68c0: close to 120px, brake, then hold and turn the aim.
        speed = Math.hypot(e.hs, e.vs);
        if (d > ENEMY.hold) {
          e.hs += lenX(ENEMY.accel, dir); e.vs += lenY(ENEMY.accel, dir);
          const s = Math.hypot(e.hs, e.vs);
          if (s > ENEMY.maxSpeed) { e.hs *= ENEMY.maxSpeed / s; e.vs *= ENEMY.maxSpeed / s; }
          e.angle = dir;
        } else if (speed > 0) {
          const s = Math.max(0, speed - ENEMY.accel);
          e.hs *= s / speed; e.vs *= s / speed;
        }
        if (d <= ENEMY.hold && !(e.hs || e.vs)) {
          if (d < ENEMY.near) {
            const bx = lenX(ENEMY.backOff, dir + 180), by = lenY(ENEMY.backOff, dir + 180);
            if (free(walls, e.box, e.x + bx, e.y)) e.x += bx;
            if (free(walls, e.box, e.x, e.y + by)) e.y += by;
          }
          e.angle = turnToward(e.angle, dir, options.easier ? EASY.turn : ENEMY.turn);
        }
        if (e.wait > 0) e.wait--;
        else if (e.cooldown > 0) e.cooldown--;
        else {
          e.cooldown = Math.round(g.cooldown * (options.easier ? EASY.cooldown : 1));
          if (e.spr.attack) { e.sprite = e.spr.attack; e.frame = 0; }
          fire(e, e.angle, g, false, g.side !== undefined ? 1 : 0);
        }
      } else {
        // Out of sight, the search state (var 31 = 3 in 0x11a9000) sets the
        // first-shot counter (var 17) back to 15, so a re-spotted gunner waits again.
        if (g && !see) e.wait = firstShot();
        // Unarmed and in sight: run straight in (0xf4e710). Otherwise, or when
        // a wall is in the way (seen through a gap), follow a path to the
        // player, made again every 20 steps.
        e.hs = e.vs = 0;
        const chase = (e.dog ? DOG.speed : ENEMY.chaseSpeed) * (options.easier ? EASY.chase : 1);
        if (see && d > 2 && free(walls, e.box, e.x + lenX(chase, dir), e.y + lenY(chase, dir))) {
          e.path = null;
          e.hs = lenX(chase, dir); e.vs = lenY(chase, dir);
          e.angle = dir;
        } else if (d > 2 && !p.dead) {
          if (!(--e.repath > 0)) { e.repath = PATH.every; e.path = pathTo(e, p.x, p.y); }
          followPath(e);
        }
        if (e.dog && see && d < DOG.kill) {
          if (e.spr.attack && e.sprite !== e.spr.attack) { e.sprite = e.spr.attack; e.frame = 0; }
          if (!p.dead && !p.exec) sfx(DOG.rip);
          killPlayer(P.deadBlunt, e.angle);
        } else if (!g && d < ENEMY.melee && !(e.cool > 0) && !e.swing && !(options.easier && e.wait > 0)) {
          e.swing = true; e.cool = Math.round(ENEMY.swing.cool * (options.easier ? EASY.swingCool : 1)); e.angle = dir;
          if (e.spr.attack) { e.sprite = e.spr.attack; e.frame = ENEMY.swing.start; }
          sfx(SOUND.swing[Math.floor(random(2))]);
        } else if (e.cool > 0) e.cool--;
        if (e.wait > 0) e.wait--;
      }
      if (e.hs || e.vs) e.moveDir = pointDir(0, 0, e.hs, e.vs);
      e.imageSpeed = (e.hs || e.vs) ? ENEMY.wanderAnim * Math.hypot(e.hs, e.vs) : 0;
      if (e.dog && e.spr.run) { e.sprite = e.spr.run; if (e.hs || e.vs) e.imageSpeed = Math.max(e.imageSpeed, DOG.runImage); }
    }
    // path_start moves along the path without collision checks, so a box
    // wider than the 16-px cells clips corners and ends up drawn inside
    // walls. Port choice: the path step slides on walls instead (a blocked
    // chaser asks for a new path), and only a body already in a wall moves
    // freely, to get out.
    if (e.path && !free(walls, e.box, e.x, e.y)) { e.x += e.hs; e.y += e.vs; }
    else if (e.path) {
      const mx = moveAxis(walls, e.box, e, 'x', e.hs, CORNER), my = moveAxis(walls, e.box, e, 'y', e.vs, CORNER);
      if (!mx && !my) e.repath = 0;
    } else {
      if (!moveAxis(walls, e.box, e, 'x', e.hs, CORNER) && e.alert) e.hs = 0;
      if (!moveAxis(walls, e.box, e, 'y', e.vs, CORNER) && e.alert) e.vs = 0;
    }
    if (!e.alert && (e.hs || e.vs)) e.angle = e.moveDir;
    if (e.hs || e.vs) e.legFrame += ENEMY.legsSpeed;
    if (e.sprite === e.spr.attack) {
      const n = frames(e.sprite);
      if (e.swing) melee(e);
      e.frame += g ? g.imageSpeed : ENEMY.swing.image;
      if (e.frame >= n) { e.sprite = e.spr.walk; e.frame = 0; e.swing = false; }
    } else if (e.swing) { melee(e); e.swing = false; }
    else e.frame += e.imageSpeed;
  }

  // 0xf4e710: an unarmed enemy fetches a weapon, else holds off. Returns false
  // when there is nothing to do (calm, no weapon), so the calm wander runs.
  function unarmed(e) {
    const U = ENEMY.unarmed;
    let w = null, best = Infinity;
    for (const q of weapons) {
      const d = dist(e, q);
      if (d < best && q.speed < U.slow && need(e.base + 'Walk' + q.name)) { best = d; w = q; }
    }
    e.hs = e.vs = 0;
    if (w) {
      const dir = pointDir(e.x, e.y, w.x, w.y);
      if (sees(e, w)) {
        e.path = null;
        e.hs = lenX(U.run, dir); e.vs = lenY(U.run, dir); e.angle = dir;
      } else {
        if (!(--e.repath > 0)) { e.repath = PATH.every; e.path = pathTo(e, w.x, w.y); }
        followPath(e);
      }
      e.imageSpeed = U.image;
      if (best < U.take) takeWeapon(e, w);
    } else if (!e.alert || p.dead) return false;
    else {
      e.path = null;
      const dir = pointDir(e.x, e.y, p.x, p.y);
      if (dist(e, p) >= U.near) { e.imageSpeed = 0; e.angle = turnToward(e.angle, dir, ENEMY.turn); }
      else {
        e.angle = dir;
        e.hs = lenX(U.creep, dir); e.vs = lenY(U.creep, dir);
        e.imageSpeed = ENEMY.wanderAnim * U.creep;
      }
    }
    if (e.hs || e.vs) e.moveDir = pointDir(0, 0, e.hs, e.vs);
    return true;
  }
  // 0xee4300: the enemy arms with the weapon (its Walk/Attack sprites).
  function takeWeapon(e, w) {
    const held = w.name;
    weapons.splice(weapons.indexOf(w), 1);
    sfx(SOUND.pickup);
    e.gun = held; e.g = ENEMY_GUNS[e.base.slice(3) + held] || ENEMY_GUNS[held];
    e.spr.walk = e.spr.idle = need(e.base + 'Walk' + held);
    e.spr.attack = need(e.base + 'Attack' + held) || need(e.base + 'Attack' + held + '1') || (held === 'Machete' && need(e.base + 'AttackMachette'));
    e.sprite = e.spr.walk; e.frame = 0; e.path = null;
    e.cooldown = 0; e.wait = firstShot();
  }

  // One step of a swing: the point 8px ahead, or the enemy's own spot, in the
  // player's mask kills a player who is not rolling.
  function melee(e) {
    if (p.dead || p.exec || p.roll) return;
    const at = { x: e.x + lenX(ENEMY.swing.ahead, e.angle), y: e.y + lenY(ENEMY.swing.ahead, e.angle) };
    if (!inBox(at, p, box) && !inBox(e, p, box)) return;
    e.swing = false;
    sfx(SOUND.hit);
    killPlayer(P.deadBlunt, e.angle);
  }

  // 0x42c900: the goal is the first free point around (tx, ty), else (tx, ty).
  function pathTo(e, tx, ty) {
    const a0 = random(360);
    for (const r of PATH.rings)
      for (let k = 0; k < PATH.angles; k++) {
        const x = tx + lenX(r, a0 + k * 360 / PATH.angles), y = ty + lenY(r, a0 + k * 360 / PATH.angles);
        if (cellFree(pg, x, y)) return gridPath(pg, e.x, e.y, x, y) || gridPath(pg, e.x, e.y, tx, ty);
      }
    return gridPath(pg, e.x, e.y, tx, ty);
  }
  function followPath(e) {
    const path = e.path;
    if (!path) return;
    while (path.length && dist(e, path[0]) <= (e.dog ? DOG.speed : PATH.speed)) path.shift();
    if (!path.length) { e.path = null; return; }
    const dir = pointDir(e.x, e.y, path[0].x, path[0].y), speed = e.dog ? DOG.speed : PATH.speed;
    e.hs = lenX(speed, dir); e.vs = lenY(speed, dir);
    e.angle = dir;
  }

  // On sight, an idle enemy is swapped for the alerted one it carries.
  function stepIdle(e) {
    e.frame += e.imageSpeed;
    if (e.wake > 0) { e.wake--; return; }
    e.wake = IDLE.every;
    if (!spots(e)) return;
    const n = Object.assign(e.idle, { x: e.x, y: e.y, angle: e.angle, alert: true, seen: { x: p.x, y: p.y }, wait: firstShot() });
    const left = IDLE.leave[e.kind];
    if (left && leaveSprite[e.kind]) dead.push({ x: e.x + left.dx, y: e.y + left.dy, angle: left.still ? 0 : e.angle, sprite: leaveSprite[e.kind], frame: 0, imageSpeed: 0 });
    enemies[enemies.indexOf(e)] = n;
  }

  // Dodge and stun animations, and the psycho's idle, before the gang AI.
  function stepDodger(e) {
    if (e.sprite === e.spr.dodge) {
      e.frame += e.frame < DODGER.hold ? DODGER.slow : DODGER.fast;
      if (e.frame >= DODGER.end) { e.sprite = e.spr.walk; e.frame = 0; }
      return;
    }
    if (e.sprite === e.spr.stunned) {
      e.frame += DODGER.stun;
      if (e.frame >= DODGER.stunEnd) { e.sprite = e.spr.walk; e.frame = 0; }
      return;
    }
    if (e.sleep) {
      e.frame += e.imageSpeed;
      if (--e.wake > 0) return;
      e.wake = DODGER.wake;
      if (!spots(e)) return;
      Object.assign(e, { sleep: false, alert: true, seen: { x: p.x, y: p.y }, sprite: e.spr.walk, frame: 0, imageSpeed: 0, angle: pointDir(e.x, e.y, p.x, p.y) });
    }
    stepMafia(e);
  }
  // Hiding: rise and fire bursts while the player is in sight, else duck.
  function stepHiding(e) {
    if (e.reloading > 0) {
      e.frame += HIDE.reload;
      if (--e.reloading <= 0 || (e.spr.reload && e.frame >= frames(e.spr.reload))) Object.assign(e, { reloading: 0, sprite: e.spr.idle, frame: HIDE.up, ammo: HIDE.ammo });
      return;
    }
    if (--e.check <= 0) { e.check = HIDE.every; e.alert = spots(e); }
    if (!e.alert) { e.frame = Math.max(0, e.frame - HIDE.rise); return; }
    e.angle = pointDir(e.x, e.y, p.x, p.y);
    if (e.frame < HIDE.up) { e.frame = Math.min(HIDE.up, e.frame + HIDE.rise); return; }
    if (--e.cooldown > 0) return;
    e.cooldown = Math.round(e.g.cooldown * (options.easier ? EASY.cooldown : 1));
    fire(e, e.angle, e.g, false);
    if (--e.ammo <= 0) Object.assign(e, { reloading: HIDE.reloadSteps, sprite: e.spr.reload || e.spr.idle, frame: e.spr.reload ? 0 : HIDE.up });
  }

  // Victim1, the factions, dogs, idle, fat, dodger and hiding enemies are
  // ported; others stand and idle.
  function stepEnemy(e) {
    if (e.couple) return stepCouple(e);
    if (e.idle) return stepIdle(e);
    if (e.dodger) return stepDodger(e);
    if (e.hiding) return stepHiding(e);
    if (e.fat && e.hp < FAT.hp && --e.bleed <= 0) { e.hp = 1; return shoot(e, e.angle); }
    if (e.mafia) return stepMafia(e);
    e.frame += e.imageSpeed;
    if (e.kind !== 'objVictim1') return;
    const d = dist(e, p);
    if (d < VICTIM1.alert) e.alert = true;
    if (!e.alert) return;
    if (d > VICTIM1.cower) {
      const [tx, ty] = VICTIM1.target, far = (q) => Math.hypot(q.x - tx, q.y - ty);
      const door = doors.reduce((a, b) => !a || far(b) < far(a) ? b : a, null);
      const goal = door ? { x: door.x, y: door.y + VICTIM1.targetDy } : { x: 2 * e.x - p.x, y: 2 * e.y - p.y };
      if (dist(e, goal) <= VICTIM1.speed) { e.sprite = e.spr.idle; e.imageSpeed = VICTIM1.idleSpeed; return; }
      const dir = pointDir(e.x, e.y, goal.x, goal.y);
      moveAxis(walls, e.box, e, 'x', lenX(VICTIM1.speed, dir), CORNER);
      moveAxis(walls, e.box, e, 'y', lenY(VICTIM1.speed, dir), CORNER);
      if (e.sprite !== e.spr.walk) e.frame = 0;
      e.sprite = e.spr.walk; e.imageSpeed = VICTIM1.walkSpeed; e.angle = dir;
    } else {
      e.sprite = e.spr.cower || e.spr.idle; e.imageSpeed = VICTIM1.cowerSpeed;
    }
  }

  // objNextroom step and collision: live once the floor is clear.
  const coupleRoom = !exits.length && !elevators.length && room.insts.some(i => G.objects.get(i.obj)?.name === COUPLE.obj);
  let cutWait = 0;
  let cleared = !enemies.some(e => e.isEnemy) && !bosses.length;
  // A room with no other way out (ROOM_END) that had a fight or a scripted object.
  const autoEnd = !exits.length && !elevators.length && !coupleRoom && !film && (!cleared || talks.length > 0 ||
    room.insts.some(i => ROOM_END.auto.includes(G.objects.get(i.obj)?.name)));
  let endWait = 0;
  function stepExits() {
    const clearFloor = !enemies.some(e => e.isEnemy) && !kos.length && !bosses.length;
    if (clearFloor && !cleared && exits.length) sfx(SOUND.cleared);
    cleared = clearFloor;
    for (const x of exits) {
      const on = overlap(p, box, x, x.box);
      if (x.off && !overlap(p, x.off, x, x.box)) x.off = false;
      x.live = clearFloor && !x.off;
      if (x.live && on && !p.dead && !p.exec) return leave(null, x);
    }
    for (const l of elevators) if (stepElevator(l, clearFloor)) return leave(l);
    if (coupleRoom && !enemies.length && !kos.length && !p.exec && !p.dead && ++cutWait > COUPLE.cut) return leave();
    if (film?.arrived && !talks.length && !env.cutscene && ++film.wait > FILM_SET.after) return leave();
    if (autoEnd && clearFloor && !talks.length && !env.cutscene && !vanWait && !p.dead && !p.exec && ++endWait > ROOM_END.wait) return leave();
  }
  // Returns true when the ride is over.
  function stepElevator(l, clearFloor) {
    const on = !p.dead && overlap(p, box, l, l.box);
    const open = () => { l.frame = Math.min(ELEVATOR.open, l.frame + ELEVATOR.door); };
    if (!clearFloor) {
      l.used = on;
      on ? open() : (l.frame = Math.max(0, l.frame - ELEVATOR.door));
      return false;
    }
    if (!on) { l.used = false; open(); return false; }
    if (l.used || p.exec) { open(); return false; }
    if (l.timer) return --l.timer === 0;
    p.ride = l;
    let moving = false;
    if (l.frame > 0) { l.frame = Math.max(0, l.frame - ELEVATOR.door); moving = true; }
    for (const a of ['x', 'y']) {
      if (l.to[a] + ELEVATOR.pull < p[a]) { p[a] -= ELEVATOR.pull; moving = true; }
      else if (l.to[a] - ELEVATOR.pull > p[a]) { p[a] += ELEVATOR.pull; moving = true; }
    }
    if (!moving) l.timer = ELEVATOR.wait;
    return false;
  }
  function leave(lift, exit) {
    handle.stop();
    handle.left = true;
    handle.via = exit ? `${exit.kind} ${exit.x},${exit.y}` : lift ? 'elevator' : 'end';
    const carried = { x: p.x, y: p.y, weapon: p.weapon, ammo: p.ammo, elevator: lift && { x: lift.x }, stats, character: pick.startsWith(pobj.name + ':') ? pick : pobj.name,
      exit: exit?.kind === 'objNextroom' && { x: exit.inst.x, y: exit.inst.y },
      level: { rooms: { ...carry?.level?.rooms, [room.name]: { dead, weapons: weapons.map(w => ({ ...w, inst: null, speed: 0 })) } } } };
    if (!env.next || !env.next(room, carried)) env.status(`${room.name} cleared: this is the last room in order.`);
  }

  // The body stops at walls; KnockedOut_step's own wall handling is not read yet.
  function stepKO(k) {
    if (k.speed > 0) {
      const mx = moveAxis(walls, k.box, k, 'x', lenX(k.speed, k.dir)), my = moveAxis(walls, k.box, k, 'y', lenY(k.speed, k.dir));
      k.speed = (mx || my) ? Math.max(0, k.speed - KO.friction) : 0;
    }
    if (k.alarm > 0) {
      if (--k.alarm > 0) return;
      k.imageSpeed = KO.getUpSpeed;
    }
    k.frame += k.imageSpeed;
    if (k.frame >= frames(k.sprite)) {
      kos.splice(kos.indexOf(k), 1);
      enemies.push(mkEnemy(k.obj, k.x, k.y, true, k.gun || 'Unarmed'));
    }
  }

  // Door geometry: points along the door from the hinge.
  // The wall test stops short of the free end, which rests against the frame.
  const doorPoints = (d, from = 0, to = DOOR.length) => {
    const pts = [];
    for (let t = from; t <= to; t += 2) pts.push({ x: d.x + lenX(t, d.base + d.angle), y: d.y + lenY(t, d.base + d.angle) });
    return pts;
  };
  const touches = (d, o, ob) => doorPoints(d).some(q =>
    q.x >= o.x + ob.l - 2 && q.x <= o.x + ob.r + 2 && q.y >= o.y + ob.t - 2 && q.y <= o.y + ob.b + 2);
  const hitsWall = (d) => doorPoints(d, 4, DOOR.length - 2).some(q => walls.grid[Math.round(q.y) * walls.w + Math.round(q.x)]);
  // A push turns the door so its free end moves away from whoever pushed.
  // The exe picks the sign from quadrant tests; this is the same intent.
  function pushDoor(d, o, byPlayer) {
    if (Math.abs(d.v) > DOOR.maxPush) return;
    // Only a door at rest makes the open sound: one leaning on a swinging
    // door re-pushes it every step (a port choice, the exe's check is not read).
    const still = !d.v;
    const a = (d.base + d.angle) * RAD, along = -(o.x - d.x) * Math.sin(a) - (o.y - d.y) * Math.cos(a);
    d.v = (along > 0 ? -1 : 1) * (d.h ? DOOR.pushH : DOOR.pushV);
    if (byPlayer && still) sfx(SOUND.doorOpen);
    d.byPlayer = byPlayer;
  }
  function stepDoor(d) {
    if (Math.abs(d.v) > 0) {
      d.angle += d.v;
      if (hitsWall(d)) { d.angle -= d.v; d.v *= DOOR.bounce; }
      if (d.byPlayer) for (const e of [...enemies]) if (touches(d, e, e.box)) knockOut(e, pointDir(d.x, d.y, e.x, e.y), SOUND.door);
    }
    if (d.angle < -DOOR.limit) { d.angle = -DOOR.limit; d.v = Math.abs(d.v); }
    if (d.angle > DOOR.limit) { d.angle = DOOR.limit; d.v = -Math.abs(d.v); }
    if (Math.abs(d.v) < DOOR.maxPush && d.angle > -DOOR.snap && d.angle < DOOR.snap) { d.v = 0; d.angle = 0; }
    if (d.v > DOOR.friction) d.v -= DOOR.friction; else if (d.v >= 0) d.v = 0; else d.v += DOOR.friction;
    // Collision events run after the step.
    if (touches(d, p, box)) pushDoor(d, p, true);
    else for (const e of enemies) if (touches(d, e, e.box)) { pushDoor(d, e, false); break; }
  }

  // objFatMafiaLSD's death: the die animation, then the burst at frame 7.
  function stepBurst(d) {
    d.frame = Math.min(d.frame + d.imageSpeed, frames(d.sprite) - 1);
    if (d.frame < BURST.at) return;
    Object.assign(d, { burst: false, sprite: BURST.body, frame: 0, imageSpeed: 0 });
    for (let i = 0; i < BURST.pieces; i++)
      pieces.push({ x: d.x + random(2 * BURST.spread) - BURST.spread, y: d.y + random(2 * BURST.spread) - BURST.spread,
        dir: random(360), angle: random(360), speed: BURST.speedMin + random(BURST.speedRand) });
    cam.shake = Math.max(cam.shake, BURST.shake);
  }

  const sonContext = {
    player: p, frames,
    place(x, y) { Object.assign(p, nearestFree(sol, box, x, y)); },
    melee: b => bossHit(b, 12), // GUESS: melee fallback reach.
    pages: (TALKS[room.id] || []).flat(),
    say(pages, done) {
      env.cutscene = conversation(G, pages, { drawFace, onEnd: done, fonts: talkFonts });
      if (!env.cutscene) done();
    },
    remove(b) { const i = bosses.indexOf(b); if (i >= 0) bosses.splice(i, 1); },
    die(b, sprite, speed, friction) {
      // GUESS: corpse is held in place; the original animates/flips the chair.
      bossDies(b, sprite, 0, friction);
    },
  };

  function stepBear(b) {
    b.frame += b.imageSpeed;
    if (b.state === 0) {
      if (p.x > BEAR.introX) p.locked = true;
      if (!p.locked) { b.frame %= frames(b.sprite); return; }
      if (p.y >= BEAR.stopY) { p.y -= BEAR.walkUp; p.dir = -Math.PI / 2; p.aim = p.dir; p.frame += BEAR.legSpeed; }
      if (b.wait > 0) { b.wait--; b.frame %= frames(b.sprite); return; }
      cam.shake = Math.max(cam.shake, b.frame * BEAR.shake);
      if (b.sprite === BEAR.spr.eat) Object.assign(b, { sprite: BEAR.spr.rise, x: b.x - BEAR.shift, frame: 0, imageSpeed: 0 });
      if (b.frame < BEAR.riseTo) { b.frame += BEAR.rise; return; }
      if (--b.hold > 0) return;
      Object.assign(b, { sprite: BEAR.spr.walk, state: 1, frame: 0 });
      p.locked = false;
      return;
    }
    if (p.dead) { b.hs *= 0.9; b.vs *= 0.9; }
    else {
      const run = dist(b, p) <= BEAR.near || b.sprite !== BEAR.spr.walk;
      if (run && b.sprite === BEAR.spr.walk) Object.assign(b, { sprite: BEAR.spr.run, frame: 1 });
      const m = run ? BEAR.run : BEAR.walk, dir = pointDir(b.x, b.y, p.x, p.y);
      b.hs += lenX(m.accel, dir); b.vs += lenY(m.accel, dir);
      const sp = Math.hypot(b.hs, b.vs);
      if (sp > m.max) { b.hs *= m.max / sp; b.vs *= m.max / sp; }
      b.imageSpeed = Math.min(sp, m.max) * m.anim;
      b.angle = pointDir(0, 0, b.hs, b.vs);
    }
    b.x += b.hs; b.y += b.vs;
    b.frame %= frames(b.sprite);
    if (p.dead) return;
    if (bossHit(b, BEAR.reach)) bossDies(b, BEAR.spr.dead, BEAR.body.speedMin + random(BEAR.body.speedRand), BEAR.body.friction);
    else if (overlap(b, b.box, p, box)) {
      killPlayer(BEAR.spr.kill, b.angle);
      Object.assign(p.dead, { frame: BEAR.killFrame, dir: b.angle, speed: BEAR.killSpeed });
    }
  }
  // Both bosses die to a melee swing whose point `reach` px behind the
  // player (toward the boss) is inside the player's mask.
  function bossHit(b, reach) {
    const back = -p.aim / RAD + 180, at = { x: b.x + lenX(reach, back), y: b.y + lenY(reach, back) };
    return attacking() && !p.attack.gun && inBox(at, p, box);
  }
  function bossDies(b, sprite, speed, friction) {
    bosses.splice(bosses.indexOf(b), 1);
    killed();
    dead.push({ x: b.x, y: b.y, angle: b.angle, sprite, frame: 0, imageSpeed: 0, dir: pointDir(p.x, p.y, b.x, b.y), speed, friction });
    cam.shake = Math.max(cam.shake, KO.shake);
  }

  function stepPrison(b) {
    const K = PRISON;
    if (b.intro) {
      if (p.x > K.introX) { p.locked = true; p.x -= K.walkLeft; p.dir = Math.PI; p.aim = p.dir; p.frame += K.legSpeed; b.angle = pointDir(b.x, b.y, p.x, p.y); return; }
      if (p.locked && --b.talk > 0) return;
      b.intro = false; p.locked = false;
    }
    if (p.dead) return;
    const toward = pointDir(b.x, b.y, p.x, p.y);
    if (b.state === 0) {
      if (b.wait > 0) { b.wait--; return; }
      b.angle = toward;
      if (b.speed < K.walk.max) b.speed += K.walk.accel;
      b.frame += b.speed * K.walk.anim; b.legFrame += b.speed * K.walk.legs;
      if (--b.timer <= 0) Object.assign(b, { state: 1, timer: K.chargeUp.time, frame: 0, speed: 0, sprite: K.spr.chargeUp });
    } else if (b.state === 1) {
      if (b.frame < K.chargeUp.to) b.frame += K.chargeUp.anim;
      b.angle = toward;
      if (--b.timer <= 0) Object.assign(b, { state: 2, timer: K.charge.time, frame: 0, sprite: K.spr.charge, speed: K.charge.speed });
    } else {
      b.angle = turnToward(b.angle, toward, K.charge.turn);
      b.frame += b.speed * K.charge.anim; b.legFrame += b.speed * K.charge.legs;
      if (--b.timer <= 0) Object.assign(b, { state: 0, speed: 0, wait: K.rest, timer: K.walk.time, sprite: K.spr.walk });
    }
    b.hs = lenX(b.speed, b.angle); b.vs = lenY(b.speed, b.angle);
    moveAxis(walls, b.box, b, 'x', b.hs); moveAxis(walls, b.box, b, 'y', b.vs);
    b.frame %= frames(b.sprite);
    if (bossHit(b, K.reach)) bossDies(b, K.spr.dead, K.body.speed, K.body.friction);
    else if (overlap(b, b.box, p, box)) {
      bosses.splice(bosses.indexOf(b), 1);
      const dir = pointDir(b.x, b.y, p.x, p.y);
      p.x = (p.x + b.x) / 2; p.y = (p.y + b.y) / 2;
      killPlayer(K.spr.kill, dir);
      Object.assign(p.dead, { frame: 0, imageSpeed: K.killSpeed });
    }
  }

  function step() {
    if (env.paused?.()) { keys.clear(); pressed.clear(); mouse.click = mouse.right = false; return; }
    // Keyboard stand-ins for the mouse buttons (see defaultBindings).
    if (pressed.has('f')) mouse.click = true;
    if (pressed.has('e')) mouse.right = true;
    if (pressed.has('q')) lockOn();
    // A cutscene (dialogue box) holds the room still and eats the input.
    stepTalk();
    if (card) stepCard();
    if (env.cutscene?.step({ pressed, mouse, player: p })) { pressed.clear(); mouse.click = mouse.right = false; moveCamera(CAMERA.ease); return; }
    if (film) stepFilm();
    else if (!p.dead) stats.steps++;
    // The cut holds the Pig still while the screen goes dark.
    if (!film && !(cutWait > 0)) stepPlayer();
    for (const b of [...bosses]) {
      if (b.kind === 'objColombianBoss' || b.kind === 'objBoss') stepSonBoss(b, sonContext);
      else (b.kind === 'objPrisonBoss' ? stepPrison : stepBear)(b);
    }
    if (p.dead?.imageSpeed) p.dead.frame = Math.min(p.dead.frame + p.dead.imageSpeed, frames(p.dead.sprite) - 1);
    for (const d of [...dead, p.dead]) if (d?.speed > 0) {
      d.x !== undefined ? (d.x += lenX(d.speed, d.dir), d.y += lenY(d.speed, d.dir)) : (p.x += lenX(d.speed, d.dir), p.y += lenY(d.speed, d.dir));
      d.speed = Math.max(0, d.speed - (d.friction ?? BEAR.killFriction));
    }
    for (const e of [...enemies]) stepEnemy(e);
    for (const k of [...kos]) stepKO(k);
    for (const d of doors) stepDoor(d);
    for (const w of weapons) stepWeapon(w);
    for (const b of [...bullets]) if (!stepBullet(b)) bullets.splice(bullets.indexOf(b), 1);
    for (const d of sliders) d.frame = (d.frame + SLIDING.imageSpeed) % frames(d.sprite);
    for (const s of screens) if (s.speed && (s.frame += s.speed) >= frames(s.brk)) {
      s.speed = 0;
      if (s.broken) { s.sprite = s.broken; s.frame = 0; } else s.frame = frames(s.brk) - 1;
    }
    for (const d of dead) if (d.burst) stepBurst(d);
    for (const q of [...splats]) if (!stepSplat(q)) splats.splice(splats.indexOf(q), 1);
    for (const q of pieces) if (q.speed > 0) {
      q.x += lenX(q.speed, q.dir); q.y += lenY(q.speed, q.dir);
      q.speed = Math.max(0, q.speed - BURST.friction);
    }
    stepCombo();
    for (const u of [...popups]) if (--u.t <= 0) popups.splice(popups.indexOf(u), 1); else u.y -= 0.3;
    if (shownScore < stats.score) shownScore = Math.min(stats.score, shownScore + Math.max(10, Math.ceil((stats.score - shownScore) / 10)));
    pressed.clear();
    stepExits();
    if (!running) return;
    // The shake's decay rate is a guess.
    cam.shake = Math.max(0, cam.shake - 0.2);
    moveCamera(CAMERA.ease);
    // A locked target holds the cursor on it.
    if (lock && !enemies.includes(lock)) lock = null;
    if (lock) { mouse.x = lock.x - cam.x; mouse.y = lock.y - cam.y; }
    p.aim = Math.atan2(mouse.y + cam.y - p.y, mouse.x + cam.x - p.x);
  }

  // Lock on to the on-screen enemy nearest the cursor; pressed again, let go.
  // The port's version of the native lock-on, for trackpad aiming.
  let lock = null;
  function lockOn() {
    if (lock) { lock = null; return; }
    let best = Infinity;
    for (const e of enemies) {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < 0 || sy < 0 || sx > VIEW_W || sy > VIEW_H) continue;
      const d = Math.hypot(sx - mouse.x, sy - mouse.y);
      if (d < best) { best = d; lock = e; }
    }
    if (lock && hint) hint.locked = true;
  }

  function stepFilm() {
    p.sceneHidden = true; p.hs = p.vs = 0;
    if (film.arrived) return;
    film.y += FILM_SET.speed; film.frame += FILM_SET.imageSpeed;
    if (film.y >= FILM_SET.stopY) { film.y = FILM_SET.stopY; film.arrived = true; film.frame = 0; talkClock = 0; }
  }
  function moveCamera(ease) {
    if (film) {
      const [fx, fy] = film.arrived ? FILM_SET.centre : [film.x, film.y];
      const tx = fx - VIEW_W / 2, ty = fy - VIEW_H / 2, k = film.arrived ? FILM_SET.ease : 1;
      cam.fx = (cam.fx ?? tx) + (tx - (cam.fx ?? tx)) * k; cam.fy = (cam.fy ?? ty) + (ty - (cam.fy ?? ty)) * k;
      cam.x = Math.round(cam.fx); cam.y = Math.round(cam.fy);
      return;
    }
    const spot = env.cutscene && !env.cutscene.done && TALK_CAMERA[room.name]?.[env.cutscene.face];
    if (spot) {
      const [tx, ty] = spot;
      cam.fx = (cam.fx ?? tx) + (tx - (cam.fx ?? tx)) * ease; cam.fy = (cam.fy ?? ty) + (ty - (cam.fy ?? ty)) * ease;
      cam.x = Math.round(cam.fx); cam.y = Math.round(cam.fy);
      return;
    }
    // Not clamped to the room: the native view follows the player past the
    // edges and shows the backdrop there.
    // The view leads toward the cursor by half its offset from the centre,
    // capped at 22 px (measured on the native Pilot).
    const ox = mouse.x - VIEW_W / 2, oy = mouse.y - VIEW_H / 2, len = Math.hypot(ox, oy);
    const k = len ? Math.min(len * CAMERA.lead, CAMERA.max) / len : 0;
    const tx = p.x + ox * k - VIEW_W / 2, ty = p.y + oy * k - VIEW_H / 2;
    // The eased position is kept apart so the view lands on whole pixels.
    cam.fx = (cam.fx ?? tx) + (tx - (cam.fx ?? tx)) * ease; cam.fy = (cam.fy ?? ty) + (ty - (cam.fy ?? ty)) * ease;
    cam.x = Math.round(cam.fx); cam.y = Math.round(cam.fy);
  }

  // angle is in canvas radians (clockwise).
  function sprite(name, frame, x, y, angle) {
    const a = name && art.get(name), img = a && imgs.get(a.hit.atlas);
    if (!img) return;
    const f = a.hit.frames[Math.floor(frame) % a.hit.frames.length];
    cx.save();
    cx.translate(Math.round(x - cam.x), Math.round(y - cam.y));
    cx.rotate(angle);
    cx.drawImage(img, f.x, f.y, f.w, f.h, -a.s.ox, -a.s.oy, f.w, f.h);
    cx.restore();
  }

  // A room-sized layer, drawn only where it overlaps the view (the camera can
  // sit past the room's edges).
  function blitLayer(img) {
    const pad = img.pad || 0, x0 = cam.x + pad, y0 = cam.y + pad;
    const sx = Math.max(0, x0), sy = Math.max(0, y0);
    const ex = Math.min(img.width, x0 + VIEW_W), ey = Math.min(img.height, y0 + VIEW_H);
    if (ex > sx && ey > sy) cx.drawImage(img, sx, sy, ex - sx, ey - sy, sx - x0, sy - y0, ex - sx, ey - sy);
  }
  function hint2() {
    const h = FLOOR2_HINT, name = e => G.objects.get(e.obj)?.name, left = [...enemies, ...kos];
    if (left.length && left.every(e => name(e) === h.finishObj)) return h.finish;
    const b = h.bedroom;
    if (p.x > b.l && p.x < b.r && p.y > b.t && p.y < b.b) return null;
    if (hint.locked) return h.shoot;
    if (!held()?.gun) return h.gun;
    if (hint.held == null) hint.held = frameClock;
    return (frameClock - hint.held) / NIGHT.hint.swap & 1 ? h.aim : h.lock;
  }
  function drawHint() {
    if (env.cutscene && !env.cutscene.done) return;
    const h = NIGHT.hint, f = hint.font;
    const atDoor = doors.some(d => Math.hypot(d.x - p.x, d.y - p.y) < h.near);
    // Native order: walk (door hint near a door), execute while someone is knocked out, then look around after the first execute.
    if (!hint.stage && kos.length) hint.stage = 1;
    // Holding a melee weapon beats all of that: throw, then swing, swapping every 2 seconds.
    const melee = held() && !held().gun;
    // (Upstairs, hint2 keeps this clock for the gun lines instead.)
    if (!floor2) { if (!melee) hint.held = null; else if (hint.held == null) hint.held = frameClock; }
    // The pick-up line names the hammer, so it shows near a loose hammer once no one is left knocked out.
    // GUESS: the 48px range (native showed it a little outside pickup reach).
    const nearPickup = weapons.some(w => w.name === h.pickupWeapon && w.speed === 0 && Math.hypot(w.x - p.x, w.y - p.y) < h.pickupNear);
    const clear = !enemies.some(e => e.isEnemy) && !kos.length;
    const id = floor2 ? hint2() : hint.talked ? h.after : clear ? h.clear
      : melee ? ((frameClock - hint.held) / h.swap & 1 ? h.swing : h.throw)
      : kos.length && hint.stage === 1 ? h.exec : nearPickup ? h.pickup
      : stats.kills - hint.kills >= 2 ? h.second
      : hint.stage === 2 ? h.look : atDoor && G.text[h.door] ? h.door : h.text;
    if (id == null || !G.text[id]) { hint.id = null; return; }
    const chars = [...G.text[id].replace(...h.key)];
    // native flashes the box red, with white text, for a moment whenever the hint changes
    // and pops the text up a little bigger, shrinking back over 0.3 seconds
    if (hint.id !== id) { hint.id = id; hint.flash = h.flash; hint.pop = h.pop; }
    const fl = hint.flash > 0 ? hint.flash-- / h.flash : 0;
    const sc = h.scale * (1 + (hint.pop > 0 ? hint.pop-- / h.pop : 0) * h.popScale);
    const w = chars.reduce((n, ch) => n + textWidth(f, ch) * sc + h.track, -h.track);
    const k = (1 - Math.cos(frameClock / 20)) / 2, col = `rgb(${h.a.map((v, i) => Math.round(v + (h.b[i] - v) * k))})`;
    const x0 = Math.round(VIEW_W / 2 - w / 2), y = h.top + Math.round((h.h - (f.base || 8) * h.scale) / 2);
    cx.save();
    cx.fillStyle = fl ? `rgb(${Math.round(191 * fl)},0,0)` : h.box; cx.fillRect(x0 - h.padX, h.top, Math.round(w) + h.padX * 2, h.h);
    for (const [colour, d] of [[h.shadow, 1], [fl ? '#fff' : col, 0]]) {
      let x = x0 + d;
      for (const ch of chars) { drawText(cx, f, ch, x, y + d, { colour, scale: sc }); x += textWidth(f, ch) * sc + h.track; }
    }
    cx.restore();
  }
  function drawRestart() {
    const R = RESTART, f = restartFont, text = String(G.text[R.text]).replace(R.key, 'R');
    const w = Math.round(textWidth(f, text) * R.scale), y = R.top + Math.round((R.h - (f.base || 8) * R.scale) / 2);
    const k = (1 - Math.cos(frameClock / R.period)) / 2, col = `rgb(${R.a.map((v, i) => Math.round(v + (R.b[i] - v) * k))})`;
    cx.save();
    cx.fillStyle = '#000'; cx.fillRect(R.x - R.padX, R.top, w + R.padX * 2, R.h);
    drawText(cx, f, text, R.x + 1, y + 1, { colour: R.shadow, scale: R.scale });
    drawText(cx, f, text, R.x, y, { colour: col, scale: R.scale });
    cx.restore();
  }
  function hud() {
    if (p.dead && restartFont && env.restart) drawRestart();
    if (night) { if (hint) drawHint(); return; }
    if (hint) drawHint();
    if (env.intro) return;
    cx.save();
    cx.font = 'bold 10px monospace';
    cx.textAlign = 'center';
    // Popups use the score font at half size, white over a black step, as native does.
    for (const u of popups) {
      cx.globalAlpha = Math.min(1, u.t / 20);
      const px = Math.round(u.x - cam.x), py = Math.round(u.y - cam.y);
      if (pointsFont) for (const [d, c] of [[1, '#000'], [0, '#fff']])
        drawText(cx, pointsFont, u.text, px + d, py - 6 + d, { align: 0.5, colour: c, scale: 0.5 });
      else for (const [d, c] of [[1, '#000'], [0, '#fff']]) { cx.fillStyle = c; cx.fillText(u.text, px + d, py + d); }
    }
    cx.globalAlpha = 1;
    cx.restore();
    // The score in fntPoints: the cyan face over a magenta step and a black one.
    // Native shows the score's zeros with the tall 'O' glyph; the font's own '0' is short.
    const t = String(shownScore).replace(/0/g, 'O') + 'PTS', P = SCORE_HUD;
    if (pointsFont) for (const [d, c] of [[2, '#000'], [1, P.shadow], [0, P.face]])
      if (typeof c === 'string') drawText(cx, pointsFont, t, P.x + d, P.y + d, { align: 1, colour: c, scale: P.scale });
      else cx.drawImage(scoreArt(t, c, d), 0, 0);
    if (comboFont && combo.n > 1 && combo.t > 0)
      for (const [d, c] of [[2, '#000'], [0, '#fff']]) drawText(cx, comboFont, combo.n + 'x', COMBO.x + d, COMBO.y + d, { align: 0, colour: c });
  }
  // A gradient-filled score line, drawn once per text into a view-sized canvas.
  const scoreCache = new Map();
  function scoreArt(t, [top, bottom], d) {
    const key = t + top + d;
    let c = scoreCache.get(key);
    if (c) return c;
    if (scoreCache.size > 32) scoreCache.clear();
    const P = SCORE_HUD, g = (c = new OffscreenCanvas(VIEW_W, VIEW_H)).getContext('2d');
    drawText(g, pointsFont, t, P.x + d, P.y + d, { align: 1, colour: '#fff', scale: P.scale });
    const grad = g.createLinearGradient(0, P.band[0] + d, 0, P.band[1] + d);
    grad.addColorStop(0, top); grad.addColorStop(1, bottom);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = grad; g.fillRect(0, 0, VIEW_W, VIEW_H);
    scoreCache.set(key, c);
    return c;
  }

  // The couple room's fade: black over everything, then a red glow with the
  // Pig drawn on it.
  function drawCut() {
    cx.save();
    cx.fillStyle = `rgba(5,0,1,${Math.min(1, cutWait / COUPLE.fade)})`;
    cx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = Math.min(1, Math.max(0, (cutWait - COUPLE.fade) / 30));
    if (g > 0) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y), r = cx.createRadialGradient(x, y, 0, x, y, COUPLE.glow);
      r.addColorStop(0, `rgba(170,10,20,${0.85 * g})`); r.addColorStop(1, 'rgba(170,10,20,0)');
      cx.fillStyle = r; cx.fillRect(0, 0, VIEW_W, VIEW_H);
      cx.globalAlpha = g;
      sprite(walkSprite(), 0, p.x, p.y, p.aim);
    }
    cx.restore();
  }
  let frameClock = 0, wash = null;
  function draw() {
    frameClock++;
    const c = room.colour;
    const shake = options.shake ? cam.shake : 0;
    const sx = Math.round((Math.random() * 2 - 1) * shake), sy = Math.round((Math.random() * 2 - 1) * shake);
    cx.save();
    cx.translate(sx, sy);
    if (night) {
      const g = cx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, `rgb(${NIGHT.top})`); g.addColorStop(1, `rgb(${NIGHT.bottom})`);
      cx.fillStyle = g;
    } else if (c === WASH.colour) {
      const k = (1 - Math.cos(frameClock * 2 * Math.PI / WASH.period)) / 2;
      wash = [0, 1].map(e => WASH.a[e].map((v, i) => Math.round(v + (WASH.b[e][i] - v) * k)));
      const g = cx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, `rgb(${wash[0]})`); g.addColorStop(1, `rgb(${wash[1]})`);
      cx.fillStyle = g;
    } else cx.fillStyle = `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
    cx.fillRect(-4, -4, VIEW_W + 8, VIEW_H + 8);
    if (c === WASH.colour && !night) {
      const mid = wash[0].map((v, i) => Math.round((v + wash[1][i]) / 2 * WASH.halo.k));
      const lights = [[VIEW_W / 2, VIEW_H / 2, WASH.halo.r, mid], [p.x - cam.x, p.y - cam.y, WASH.core.r, WASH.core.colour]];
      cx.save(); cx.globalCompositeOperation = 'lighter';
      for (const [x, y, r, colour] of lights) {
        const g = cx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgb(${colour})`); g.addColorStop(1, 'rgb(0,0,0)');
        cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      cx.restore();
    }
    blitLayer(under);
    blitLayer(gore);
    for (const q of splats) {
      const a = art.get(q.sprite);
      if (!a) continue;
      const f = a.hit.frames[Math.floor(q.frame) % a.hit.frames.length];
      cx.save(); cx.translate(Math.round(q.x - cam.x), Math.round(q.y - cam.y)); cx.rotate(-q.angle * RAD); cx.scale(q.scale, q.scale);
      cx.drawImage(imgs.get(a.hit.atlas), f.x, f.y, f.w, f.h, -a.s.ox, -a.s.oy, f.w, f.h);
      cx.restore();
    }
    for (const d of dead) sprite(d.sprite, d.frame, d.x, d.y, -d.angle * RAD);
    for (const q of pieces) sprite(BURST.piece, 0, q.x, q.y, -q.angle * RAD);
    for (const s of screens) sprite(s.sprite, s.frame, s.x, s.y, 0);
    for (const d of sliders) sprite(d.sprite, Math.floor(d.frame), d.x, d.y, 0);
    for (const l of elevators) sprite(l.sprite, Math.floor(l.frame), l.x, l.y, 0);
    for (const k of kos) sprite(k.sprite, k.frame, k.x, k.y, -(k.angle + (k.fallbackPose ? 90 : 0)) * RAD);
    for (const w of weapons) sprite(w.sprite, 0, w.x, w.y, -w.angle * RAD);
    for (const d of doors) sprite(d.sprite, 0, d.x, d.y, -d.angle * RAD);
    for (const e of enemies) {
      if (e.spr.legs) sprite(e.spr.legs, (e.hs || e.vs) ? e.legFrame : 0, e.x, e.y, -e.moveDir * RAD);
      sprite(e.sprite, e.frame, e.x, e.y, -e.angle * RAD);
    }
    for (const b of bosses) {
      if (b.kind === 'objPrisonBoss') sprite(PRISON.spr.legs, b.speed ? b.legFrame : 0, b.x, b.y, -b.angle * RAD);
      sprite(b.sprite, b.frame, b.x, b.y, -b.angle * RAD);
    }
    for (const x of exits) if (x.live) sprite(x.sprite, x.frame, x.x, x.y, 0);
    if (film) sprite(film.sprite, film.arrived ? 0 : film.frame, film.x, film.y, -270 * RAD);
    for (const b of bullets) sprite(bulletSprite, 0, b.x, b.y, -b.dir * RAD);
    if (held()?.gun) {
      // The ammo count in the wad's fntAmmo; its spot on screen is a guess.
      const t = `${held().label || p.weapon} ${p.ammo}`;
      if (ammoFont) for (const [d, c] of [[1, '#000'], [0, '#fff']]) drawText(cx, ammoFont, t, 8 - sx + d, VIEW_H - 24 - sy + d, { align: 0, colour: c });
      else { cx.font = 'bold 12px monospace'; cx.fillStyle = '#fff'; cx.fillText(t, 8 - sx, VIEW_H - 8 - sy); }
    }
    if (p.dead) {
      sprite(p.dead.sprite, p.dead.frame, p.x, p.y, -p.dead.angle * RAD);
      blitLayer(over); cx.restore(); hud(); return;
    }
    if (p.exec) { sprite(p.exec.sprite, p.exec.frame, p.x, p.y, -p.exec.angle * RAD); blitLayer(over); cx.restore(); hud(); return; }
    const moving = p.hs || p.vs;
    if (p.roll) sprite(P.roll, p.roll.frame, p.x, p.y, p.roll.dir);
    else if (!p.sceneHidden) {
      sprite(P.legs, moving ? p.frame : 0, p.x, p.y, p.dir);
      if (held()?.special) for (const s of bearArms()) sprite(P.arm, p.flash && s.side === p.barrel ? 1 : 0, s.x, s.y, -s.deg * RAD);
      sprite(p.sprite, attacking() ? p.attackFrame : moving ? p.frame : 0, p.x, p.y, p.aim);
    }
    blitLayer(over);
    if (night) {
      // Multiply the world down, then the glow on the player.
      cx.globalCompositeOperation = 'multiply'; cx.fillStyle = NIGHT.tint; cx.fillRect(-4, -4, VIEW_W + 8, VIEW_H + 8);
      const gx = Math.round(p.x - cam.x), gy = Math.round(p.y - cam.y), g = cx.createRadialGradient(gx, gy, 0, gx, gy, NIGHT.glow.r);
      g.addColorStop(0, `rgba(${NIGHT.glow.colour},${NIGHT.glow.a})`); g.addColorStop(1, `rgba(${NIGHT.glow.colour},0)`);
      cx.globalCompositeOperation = 'lighter'; cx.fillStyle = g; cx.fillRect(gx - NIGHT.glow.r, gy - NIGHT.glow.r, NIGHT.glow.r * 2, NIGHT.glow.r * 2);
      cx.globalCompositeOperation = 'source-over';
    }
    cx.restore();
    if (cutWait > 0) { drawCut(); return; }
    if (!film) hud();
    env.cutscene?.draw(cx, VIEW_W, VIEW_H);
    if (card) drawCard();
    if (cleared && exits.length + elevators.length && clearedArt) {
      const f = clearedArt.hit.frames[0];
      cx.drawImage(imgs.get(clearedArt.hit.atlas), f.x, f.y, f.w, f.h, Math.round((VIEW_W - f.w) / 2), VIEW_H - CLEARED.bottom, f.w, f.h);
    }
  }

  // requestAnimationFrame can stall in a hidden or embedded page, so a timer
  // runs the frame when it is late; whichever fires first wins.
  let last = performance.now(), acc = 0, running = true, tick = 0;
  const next = () => {
    const id = ++tick;
    requestAnimationFrame(now => id === tick && loop(now));
    setTimeout(() => id === tick && loop(performance.now()), 50);
  };
  const loop = (now) => {
    if (!running) return;
    acc = Math.min(acc + now - last, 250);
    last = now;
    while (running && acc >= STEP_MS) { step(); acc -= STEP_MS; }
    if (!running) return;
    draw();
    next();
  };
  moveCamera(1);
  if (env.autostart !== false) next();
  canvas.focus?.({ preventScroll: true });
  const keyLabel = name => options.bindings[name] === ' ' ? 'Space' : options.bindings[name].toUpperCase();
  env.status(`Playing ${room.name} as ${pobj.name}: use your movement keys or arrows, mouse to aim, left click (or ${keyLabel('attack')}) to attack, right click (or ${keyLabel('grab')}) to pick up or throw, ${keyLabel('lock')} to lock on. Change keys in Settings. Esc or Stop to leave.`);

  // Handle for tests and for stopping.
  const handle = {
    room: room.name, stats, cam, splats, gore, player: p, keys, pressed, mouse, solids: sol, box, enemies, bosses, kos, dead, doors, weapons, bullets, exits, elevators, talks, talkers, step, draw, leave,
    left: false, talking: () => !!env.cutscene && !env.cutscene.done,
    get lock() { return lock; },
    get hint() { return hint?.id; },
    diagnostics() {
      return {
        room: room.name, character: pobj.name, running, paused: !!env.paused?.(),
        player: { x: p.x, y: p.y, sprite: p.sprite, weapon: p.weapon, ammo: p.ammo, attack: p.attack, attackFrame: p.attackFrame, cooldown: p.cooldown, executing: !!p.exec, dead: !!p.dead, roll: p.roll && { ...p.roll }, spread: p.spread },
        input: { keys: [...keys], pressed: [...pressed], mouse: { ...mouse } },
        playerAnimations: { ...P },
        frameCounts: Object.fromEntries([...art].map(([name, value]) => [name, value.hit.frames.length])),
        roomObjects: [...new Set(room.insts.map(instance => instance.obj))].map(id => {
          const object = G.objects.get(id), parents = [];
          for (let parent = G.objects.get(object?.parent), depth = 0; parent && depth < 64; parent = G.objects.get(parent.parent), depth++) parents.push(parent.name);
          return { id, name: object?.name, sprite: G.sprites.get(object?.sprite)?.name, parents };
        }),
        roomInstances: room.insts.map(instance => ({ id: instance.id, obj: instance.obj, x: instance.x, y: instance.y })),
        targets: enemies.map(e => ({ kind: e.kind, obj: e.obj, x: e.x, y: e.y, sprite: e.sprite, animations: { ...e.spr }, isEnemy: e.isEnemy })),
        downed: kos.map(k => ({ obj: k.obj, x: k.x, y: k.y, sprite: k.sprite, alarm: k.alarm, fallbackPose: k.fallbackPose })),
        counts: { enemies: enemies.length, downed: kos.length, dead: dead.length, bosses: bosses.length },
        stats: { ...stats },
      };
    },
    stop() {
      running = false;
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', clearInput);
      globalThis.document?.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mousedown', onMouse);
      globalThis.removeEventListener?.('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', noMenu);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
  return handle;
}
