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
export const GUNS = {
  '9mm': { ammo: 15, imageSpeed: 0.5, cooldown: 14, shake: 6, pellets: 1, spread: 6, speed: 12, speedRand: 4, muzzle: 26, sound: 'snd9mm' },
  Shotgun: { ammo: 6, imageSpeed: 0.5, cooldown: 30, shake: 6, pellets: 8, spread: 6, speed: 12, speedRand: 4, muzzle: 26, sound: 'sndShotgun' },
  DoubleBarrel: { ammo: 2, imageSpeed: 0.35, startFrame: 1, cooldown: 12, shake: 4, pellets: 12, spread: 8, speed: 10, speedRand: 2, muzzle: 24, side: 6, sound: 'sndDoubleBarrel' },
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
// Unarmed, it runs at 2.5 and hits within 22 (the chaser 0xf4e710).
// The gang (objEGang*) runs the same step (0x74d0b0) and draw; only the
// creates differ. objEGangRandom (0x74cfc0) and objEGangStatic (0x74e190) swap
// a 9mm or Uzi for choose(Uzi, Shotgun, 9mm); objEGangMeleeRandom (0x74b580)
// always takes choose(Knife, Chain, Pipe, Bat). The Idle* gang and mafia
// (create 0x748610, step 0x7488c0) are not read: they stand still here.
// Still guesses: how sight is tested (line of sight, any range), the first-shot
// delay, and the search after losing the player (straight at the last spot,
// no pathfinding).
// Sounds (sound_play 0x12c97c0 takes the sound's GML global; ids from the
// registration run, names and volumes from hlm2_sounds.bin). Guns carry
// their own in GUNS/ENEMY_GUNS (0x1116c70 player, 0xee5fa0 enemy branches).
// scrPigAttack plays choose(sndSwing1, sndSwing2) as any melee swing starts;
// scrCombat plays sndPunch for a fist and sndHit for a weapon; a thrown
// weapon hitting plays sndWeaponHit (0xc7fae0) and a door sndDoorHit.
// Which sndHit/sndPunch branch of scrCombat matches which weapon is not fully
// read, and execution sounds are not ported.
export const SOUND = { swing: ['sndSwing1', 'sndSwing2'], punch: 'sndPunch', hit: 'sndHit', thrown: 'sndWeaponHit',
  door: 'sndDoorHit', doorOpen: 'sndDoorOpen', pickup: 'sndPickUpWeapon', throw: 'sndThrow', cleared: 'sndFloorCleared' };
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
  chaseSpeed: 2.5, melee: 22, legsSpeed: 0.2,
  guns: ['M16', 'Shotgun', 'DoubleBarrel', 'Kalashnikov'] };
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
} };
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
export const DOG = { recheck: 10, speed: 4, kill: 22, imageSpeed: 0.1, runImage: 0.3 };
// Exits: objNextroom (124, step 0x939c70, player collision 0x937ad0, room
// start 0x939700). An exit is live while no objEnemy and no objKnockedOut is
// left; then it shows its arrow and touching it goes to the next room in the
// room order. The player keeps their position, weapon and ammo (floors are
// drawn aligned), and the exit they arrive on stays off until they leave it.
// objNextroom's own sprite is sprMask; its draw (0x9387f0) shows sprArrow,
// one frame per direction (from vars 32/36). Here the direction is taken from
// the nearest room edge, which is a guess.
export const EXIT = { objects: ['objNextroom'] };
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
export const EXEC = { scale: 2, imageSpeed: 0.25, hammerShift: 4 };


function inherits(G, o, name) {
  for (let k = 0; o && k < 64; k++, o = G.objects.get(o.parent)) if (o.name === name) return true;
  return false;
}

// Rasterise every solid instance's mask into one room-sized grid.
export function buildSolids(G, room, kinds = ['objSolid']) {
  const grid = new Uint8Array(room.w * room.h);
  const put = (x, y) => { if (x >= 0 && y >= 0 && x < room.w && y < room.h) grid[y * room.w + x] = 1; };
  for (const inst of room.insts) {
    const o = G.objects.get(inst.obj);
    if (!kinds.some(k => inherits(G, o, k))) continue;
    const s = G.sprites.get(o.mask >= 0 ? o.mask : o.sprite);
    if (!s) continue;
    const x0 = inst.x - s.ox, y0 = inst.y - s.oy;
    const m = G.masks.get(s.id);
    if (m) {
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++)
          if (m.bits[y * m.stride + (x >> 3)] & (0x80 >> (x & 7))) put(x0 + x, y0 + y);
    } else {
      for (let y = s.bbox.t; y <= s.bbox.b; y++)
        for (let x = s.bbox.l; x <= s.bbox.r; x++) put(x0 + x, y0 + y);
    }
  }
  return { w: room.w, h: room.h, grid };
}

// The mp_grid: a cell is blocked when any solid pixel falls in it.
function buildPathGrid(G, room) {
  const px = buildSolids(G, room, PATH.objects), c = PATH.cell;
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

// place_free for the player's box at (x, y). The room edge blocks too, until
// the exits (objEditorNextRoom and friends) are handled.
function free(sol, box, x, y) {
  const l = Math.round(x) + box.l, t = Math.round(y) + box.t;
  const r = l + box.r - box.l, b = t + box.b - box.t;
  if (l < 0 || t < 0 || r >= sol.w || b >= sol.h) return false;
  for (let yy = t; yy <= b; yy++)
    for (let xx = l; xx <= r; xx++)
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
function moveAxis(sol, box, p, axis, v) {
  const at = (d) => axis === 'x' ? free(sol, box, p.x + d, p.y) : free(sol, box, p.x, p.y + d);
  if (at(v)) { p[axis] += v; return v; }
  const s = Math.sign(v);
  let moved = 0;
  while (Math.abs(moved + s) <= Math.abs(v) && at(moved + s)) moved += s;
  p[axis] += moved;
  return 0;
}

export function findPlayer(G, room) {
  return room.insts.find(i => inherits(G, G.objects.get(i.obj), 'objPlayer') && G.objects.get(i.obj).sprite >= 0);
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

// A mask's box relative to the sprite origin.
function maskBox(G, o) {
  const s = G.sprites.get(o.mask >= 0 ? o.mask : o.sprite);
  return { l: s.bbox.l - s.ox, r: s.bbox.r - s.ox, t: s.bbox.t - s.oy, b: s.bbox.b - s.oy };
}
const scaleBox = (b, k) => ({ l: b.l * k, r: b.r * k, t: b.t * k, b: b.b * k });
const ZERO = { l: 0, r: 0, t: 0, b: 0 };
function overlap(a, ab, b, bb) {
  const ax = Math.round(a.x), ay = Math.round(a.y), bx = Math.round(b.x), by = Math.round(b.y);
  return ax + ab.l <= bx + bb.r && bx + bb.l <= ax + ab.r && ay + ab.t <= by + bb.b && by + bb.t <= ay + ab.b;
}

// env: { G, room, items, imgs, frames(name) -> {atlas, frames}, load(atlas), canvas, zoom, status }
export async function play(env) {
  const { G, room, items, imgs, canvas, zoom } = env;
  const sfx = name => G.audio?.play(name);
  const spawn = findPlayer(G, room);
  const pobj = spawn ? G.objects.get(spawn.obj) : G.objects.list.find(o => o.name === 'objPigButcher');
  const sprByName = new Map(G.sprites.list.map(s => [s.name, s]));
  const art = new Map();
  const need = (name) => {
    const s = sprByName.get(name), hit = s && env.frames(name);
    if (hit) art.set(name, { s, hit });
    return hit ? name : null;
  };
  const walkName = G.sprites.get(pobj.sprite).name, pre = walkName.replace(/Walk\w*$/, '');
  const P = {
    walk: need(walkName),
    legs: need(pre + 'Legs'),
    punch: need(pre + 'AttackPunch'),
    stomp: need(pre + 'KillStomp'),
  };
  // Per weapon: walk, attack and execution sprites, if the character has them.
  const arm = {};
  for (const [name, a] of Object.entries(ARMS)) {
    const walk = need(pre + 'Walk' + name), attack = need(pre + 'Attack' + name);
    if (walk && attack) arm[name] = { ...a, walk, attack, kill: need(pre + 'Kill' + name) || P.stomp };
  }
  for (const [name, g] of Object.entries(GUNS)) {
    const walk = need(pre + 'Walk' + name);
    const attack = need(pre + 'Attack' + name) || need(pre + 'Attack' + name + '1');
    if (walk && attack) arm[name] = { ...g, gun: true, walk, attack, attack2: need(pre + 'Attack' + name + '2') || attack, kill: P.stomp };
  }
  P.deadShot = need(pre + 'DeadShot');
  P.deadBlunt = need(pre + 'DeadBlunt') || P.deadShot;
  const bulletSprite = need('sprBullet'), clearedArt = art.get(need(CLEARED.sprite)), leaveSprite = Object.fromEntries(Object.entries(IDLE.leave).map(([k, v]) => [k, need(v.sprite)]));
  const box = maskBox(G, pobj);
  const sol = buildSolids(G, room);
  const pg = buildPathGrid(G, room);

  // Enemies: objEnemy / objVictim instances, their sprites named after the
  // idle one. Victim1 has no mask (its sprite's turns with it), so every
  // enemy uses the player's sprMask box for now.
  // Mafia and gang sprites are named after the held weapon (sprEMafiaWalkM16),
  // with no idle; `gun` carries the weapon over a knockout. Idle variants
  // (sprEGangIdlePipe) take the base from before Idle.
  const mkEnemy = (obj, x, y, walking, gun) => {
    const o = G.objects.get(obj), sname = G.sprites.get(o.sprite).name, base = sname.replace(/(Idle\w*|Walk\w*)$/, '');
    const e = { obj, kind: o.name, isEnemy: inherits(G, o, 'objEnemy'), x, y, box, angle: 0, alert: false, frame: 0, imageSpeed: VICTIM1.idleSpeed,
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
    const fat = FAT.kinds[o.name];
    const armed = (fat || FACTION.test(o.name)) && (fat ? 'Unarmed' : (sname.match(/Walk(\w+)$/) || [])[1]);
    if (fat) {
      Object.assign(e, { fat: true, hp: FAT.hp, bleed: FAT.bleed });
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
  const isEnemy = (o) => o && o.sprite >= 0 && (inherits(G, o, 'objEnemy') || inherits(G, o, 'objVictim'));
  const enemies = room.insts.filter(i => isEnemy(G.objects.get(i.obj))).map(i => Object.assign(mkEnemy(i.obj, i.x, i.y), { inst: i }));
  const kos = [], dead = [], bullets = [];

  // Loose weapons: objWeapon children the player can hold.
  const wbox = maskBox(G, { mask: sprByName.get('sprWeaponMask')?.id ?? -1, sprite: -1 });
  const weapons = room.insts.filter(i => {
    const o = G.objects.get(i.obj);
    return o && inherits(G, o, 'objWeapon') && arm[o.name.slice(3)];
  }).map(i => {
    const name = G.objects.get(i.obj).name.slice(3);
    return { inst: i, name, x: i.x, y: i.y, angle: 0, speed: 0, dir: 0, ammo: GUNS[name]?.ammo ?? 0,
      sprite: need(G.sprites.get(G.objects.get(i.obj).sprite).name) };
  });
  const looseSprite = Object.fromEntries(weapons.map(w => [w.name, w.sprite]));
  for (const name of Object.keys(arm)) looseSprite[name] ??= need('spr' + name);

  // Doors: the create event moves V doors 4px right; H doors are taken to
  // move 4px down (their create 0x6e8180 is not read yet).
  const doors = room.insts.filter(i => /^objEditorDoor[VH]$/.test(G.objects.get(i.obj)?.name)).map(i => {
    const h = G.objects.get(i.obj).name.endsWith('H');
    return { inst: i, h, x: i.x + (h ? 0 : 4), y: i.y + (h ? 4 : 0), base: h ? 0 : 270, angle: 0, v: 0, byPlayer: false,
      sprite: need(G.sprites.get(G.objects.get(i.obj).sprite).name) };
  });

  const arrow = need('sprArrow');
  const exits = room.insts.filter(i => EXIT.objects.includes(G.objects.get(i.obj)?.name) && G.objects.get(i.obj).sprite >= 0).map(i => {
    const o = G.objects.get(i.obj);
    const edges = [room.w - i.x, i.y, i.x, room.h - i.y];
    return { inst: i, kind: o.name, x: i.x, y: i.y, box: maskBox(G, o), off: false, live: false,
      sprite: o.name === 'objNextroom' ? arrow : need(G.sprites.get(o.sprite).name), frame: edges.indexOf(Math.min(...edges)) };
  });

  const elevators = room.insts.filter(i => G.objects.get(i.obj)?.name === ELEVATOR.object).map(i => {
    const o = G.objects.get(i.obj), mask = G.sprites.list.find(s => s.name === ELEVATOR.mask);
    return { inst: i, x: i.x, y: i.y, box: maskBox(G, { mask: mask.id, sprite: o.sprite }), frame: 0, used: false, timer: 0,
      sprite: need(G.sprites.get(o.sprite).name),
      to: { x: i.x + lenX(ELEVATOR.reach, ELEVATOR.angle), y: i.y + lenY(ELEVATOR.reach, ELEVATOR.angle) } };
  });

  await Promise.all([...art.values()].map(a => env.load(a.hit.atlas)));

  // Pre-render the room into the layers under and over the player, leaving
  // out everything that moves.
  const dynamic = new Set([spawn, ...enemies.map(e => e.inst), ...doors.map(d => d.inst), ...weapons.map(w => w.inst), ...exits.map(x => x.inst), ...elevators.map(l => l.inst)]);
  const layer = (keep) => {
    const c = new OffscreenCanvas(room.w, room.h), cx = c.getContext('2d');
    for (const i of items) if (keep(i) && !dynamic.has(i.inst)) cx.drawImage(imgs.get(i.atlas), i.sx, i.sy, i.w, i.h, i.dx, i.dy, i.w, i.h);
    return c;
  };
  const under = layer(i => i.depth >= pobj.depth), over = layer(i => i.depth < pobj.depth);

  // Most rooms have no player instance; then start near the centre, clear of enemies.
  // Coming up from the floor before, the player stays where they were.
  const carry = env.carry;
  // The level's tally so far: kills and steps, from the floors before.
  const stats = { kills: 0, steps: 0, ...carry?.stats };
  const clear = (x, y) => carry || spawn || enemies.every(e => Math.hypot(e.x - x, e.y - y) > 64);
  const lift = carry?.elevator && elevators.reduce((a, l) => !a || Math.abs(l.x - carry.elevator.x) < Math.abs(a.x - carry.elevator.x) ? l : a, null);
  if (lift) { carry.x = lift.to.x; carry.y = lift.to.y; }
  const at = carry ? nearestFree(sol, box, carry.x, carry.y)
    : nearestFree(sol, box, spawn ? spawn.x : room.w >> 1, spawn ? spawn.y : room.h >> 1, clear);
  const p = { x: at.x, y: at.y, hs: 0, vs: 0, aim: 0, dir: 0, frame: 0, sprite: P.walk, attackFrame: 0, cooldown: 0, weapon: null, exec: null,
    ammo: 0, barrel: -1, dead: null };
  if (carry && arm[carry.weapon]) { p.weapon = carry.weapon; p.ammo = carry.ammo; p.sprite = arm[carry.weapon].walk; }
  // The exit the player arrives on stays off until they step off it.
  for (const x of exits) x.off = overlap(p, box, x, x.box);
  for (const l of elevators) l.used = overlap(p, box, l, l.box);
  const keys = new Set(), pressed = new Set();
  const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, click: false, right: false };
  const cam = { x: 0, y: 0, shake: 0 };
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', ' ', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) pressed.add(k);
    e.type === 'keydown' ? keys.add(k) : keys.delete(k);
  };
  const onMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * VIEW_W / r.width;
    mouse.y = (e.clientY - r.top) * VIEW_H / r.height;
    if (e.type === 'mousedown' && e.button === 0) mouse.click = true;
    if (e.type === 'mousedown' && e.button === 2) mouse.right = true;
  };
  const noMenu = (e) => e.preventDefault();
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  canvas.addEventListener('mousemove', onMouse);
  canvas.addEventListener('mousedown', onMouse);
  canvas.addEventListener('contextmenu', noMenu);

  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = VIEW_W * zoom + 'px';
  canvas.style.height = VIEW_H * zoom + 'px';
  const cx = canvas.getContext('2d');

  const frames = (name) => art.get(name).hit.frames.length;
  const held = () => p.weapon && arm[p.weapon];
  const walkSprite = () => held() ? held().walk : P.walk;
  const attacking = () => p.sprite === P.punch || (held() && (p.sprite === held().attack || p.sprite === held().attack2));
  const solidAt = (x, y) => {
    const xx = Math.round(x), yy = Math.round(y);
    return xx < 0 || yy < 0 || xx >= sol.w || yy >= sol.h || sol.grid[yy * sol.w + xx] === 1;
  };
  // Line of sight: sample the wall grid every 4px.
  const sees = (a, b) => {
    const d = dist(a, b), n = Math.ceil(d / 4);
    for (let i = 1; i < n; i++) if (solidAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return true;
  };
  const aimDeg = () => (-p.aim / RAD + 360) % 360;

  // scrKnockOut: the enemy becomes a body sliding away from what hit it.
  // An enemy's gun falls where it stood, if the player can use it; the ammo
  // left in it is a guess (a full load).
  function dropGun(e) {
    if (!e.gun || !arm[e.gun] || !looseSprite[e.gun]) return;
    weapons.push({ name: e.gun, x: e.x, y: e.y, angle: random(360), dir: random(360), speed: 2, ammo: GUNS[e.gun]?.ammo ?? 0, sprite: looseSprite[e.gun] });
    e.gun = null;
  }
  function knockOut(e, dir, sound) {
    if (e.dodger && sound === SOUND.thrown) return evade(e);
    if (e.dodger && sound === SOUND.door) {
      Object.assign(e, { sprite: e.spr.stunned, frame: 0, hs: 0, vs: 0, path: null, sleep: false, alert: true });
      return;
    }
    if (e.dog || e.dodger || e.hiding) { sfx(sound); return shoot(e, dir, false, e.spr.deadBlunt); }
    if (!e.spr.getUp || e.fat) return;
    sfx(sound);
    enemies.splice(enemies.indexOf(e), 1);
    dropGun(e);
    kos.push({ obj: e.obj, x: e.x, y: e.y, dir, speed: random(KO.speedRand) + KO.speedMin, angle: dir, sprite: e.spr.getUp, spr: e.spr,
      frame: 1, imageSpeed: 0, alarm: Math.floor(random(KO.waitRand)) + KO.waitMin, box: e.box, gun: e.gun });
    cam.shake = KO.shake;
  }
  // A dodger hit by a bullet or a thrown weapon starts its dodge, or holds it.
  function evade(e) {
    if (e.sprite !== e.spr.dodge) Object.assign(e, { sprite: e.spr.dodge, frame: 0, hs: 0, vs: 0, path: null });
    else if (e.frame > DODGER.hold) e.frame = DODGER.hold;
    e.sleep = false; e.alert = true;
  }
  function bulletHit(e, dir, shotgun) {
    if (e.dodger) evade(e); else shoot(e, dir, shotgun);
  }
  // A bullet kills outright. The dead sprites hold several poses; picking
  // one at random is a guess.
  function shoot(e, dir, shotgun, sprite) {
    if (e.fat && --e.hp > 0) return;
    if (e.isEnemy) stats.kills++;
    const k = enemies.includes(e) ? enemies : kos;
    k.splice(k.indexOf(e), 1);
    dropGun(e);
    const s = sprite || (shotgun && e.spr.deadShotgun) || e.spr.deadShot;
    if (e.fat) dead.push({ x: e.x, y: e.y, angle: e.angle, sprite: s, frame: 1, imageSpeed: 0 });
    else if (s) dead.push({ x: e.x, y: e.y, angle: dir, sprite: s, frame: Math.floor(random(frames(s))), imageSpeed: 0 });
    else if (e.spr.killStomp) dead.push({ x: e.x, y: e.y, angle: dir, sprite: e.spr.killStomp, frame: frames(e.spr.killStomp) - 1, imageSpeed: 0 });
  }
  function killPlayer(sprite, dir) {
    if (p.dead || p.exec) return;
    const s = sprite || P.deadShot;
    p.dead = { sprite: s, angle: dir, frame: s ? Math.floor(random(frames(s))) : 0 };
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
      if (b.x >= 0 && b.y >= 0 && b.x < room.w && b.y < room.h && solidAt(b.x, b.y)) return false;
      if (b.byPlayer) {
        const e = enemies.find(e => overlap(b, ZERO, e, e.box));
        if (e) { bulletHit(e, b.dir, b.shotgun); return false; }
      } else if (!p.dead && !p.exec && overlap(b, ZERO, p, box)) { killPlayer(P.deadShot, b.dir); return false; }
    }
    return true;
  }

  // scrThrow: the held weapon leaves along the aim.
  function throwWeapon() {
    sfx(SOUND.throw);
    weapons.push({ name: p.weapon, x: p.x, y: p.y, angle: aimDeg(), dir: aimDeg(), speed: WEAPON.throwSpeed, ammo: p.ammo, sprite: looseSprite[p.weapon] });
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
      sfx(SOUND.pickup);
      p.weapon = w.name;
      p.ammo = w.ammo ?? 0;
    } else if (p.weapon) throwWeapon();
    if (!attacking()) p.sprite = walkSprite();
  }

  // scrSpaceAction / scrExecute: kill a knocked-out body.
  function execute() {
    const reach = scaleBox(box, EXEC.scale);
    const k = kos.find(k => overlap(p, reach, k, k.box));
    if (!k) return;
    const e = k, blunt = held() && held().kill !== P.stomp;
    const body = blunt ? e.spr.killBlunt : e.spr.killStomp, kill = held() ? held().kill : P.stomp;
    if (!body || !kill) return;
    kos.splice(kos.indexOf(k), 1);
    if (k.isEnemy) stats.kills++;
    const d = { x: k.x, y: k.y, angle: k.angle, sprite: body, frame: 0, imageSpeed: EXEC.imageSpeed * frames(body) / frames(kill) };
    dead.push(d);
    p.exec = { x: k.x, y: k.y, angle: k.angle + 180, sprite: kill, frame: 0, body: d };
    p.x = k.x; p.y = k.y; p.hs = p.vs = 0;
  }
  function stepExec() {
    const x = p.exec;
    x.frame += EXEC.imageSpeed;
    x.body.frame = Math.min(x.body.frame + x.body.imageSpeed, frames(x.body.sprite) - 1);
    if (x.frame < frames(x.sprite)) return;
    x.body.frame = frames(x.body.sprite) - 1;
    x.body.imageSpeed = 0;
    let px = x.x, py = x.y;
    if (p.weapon === 'Hammer') { px += lenX(EXEC.hammerShift, x.angle + 90); py += lenY(EXEC.hammerShift, x.angle + 90); }
    const at = nearestFree(sol, box, px, py);
    p.x = at.x; p.y = at.y;
    p.sprite = walkSprite();
    p.exec = null;
  }

  // objWeapon step plus its enemy and wall collisions.
  function stepWeapon(w) {
    if (w.speed <= 0) return;
    const mx = moveAxis(sol, wbox, w, 'x', lenX(w.speed, w.dir)), my = moveAxis(sol, wbox, w, 'y', lenY(w.speed, w.dir));
    if (!mx && lenX(w.speed, w.dir)) { w.dir = (540 - w.dir) % 360; w.speed *= WEAPON.bounce; }
    if (!my && lenY(w.speed, w.dir)) { w.dir = (360 - w.dir) % 360; w.speed *= WEAPON.bounce; }
    for (const e of [...enemies])
      if (w.speed >= WEAPON.hitSpeed && overlap(w, wbox, e, e.box)) { knockOut(e, w.dir, SOUND.thrown); w.speed *= WEAPON.hitDamp; }
    const hs = lenX(w.speed, w.dir), vs = lenY(w.speed, w.dir);
    w.angle += Math.sign(Math.abs(hs) > 0.001 ? hs : vs) * w.speed * WEAPON.spin;
    w.speed = Math.max(0, w.speed - WEAPON.friction);
  }

  function stepPlayer() {
    if (pressed.has('r') && env.restart) { pressed.clear(); running = false; env.restart(); return; }
    if (p.dead) { mouse.click = mouse.right = false; return; }
    if (p.exec) { stepExec(); mouse.click = mouse.right = false; return; }
    if (p.ride) { p.hs = p.vs = 0; mouse.click = mouse.right = false; return; }
    const ix = (keys.has('d') || keys.has('arrowright')) - (keys.has('a') || keys.has('arrowleft'));
    const iy = (keys.has('s') || keys.has('arrowdown')) - (keys.has('w') || keys.has('arrowup'));
    p.hs = ix ? approach(p.hs, ix * MOVE.maxSpeed, MOVE.accel) : approach(p.hs, 0, MOVE.friction);
    p.vs = iy ? approach(p.vs, iy * MOVE.maxSpeed, MOVE.accel) : approach(p.vs, 0, MOVE.friction);
    while (Math.abs(p.hs) + Math.abs(p.vs) > MOVE.maxSpeed + MOVE.diagSlack) { p.hs *= MOVE.diagScale; p.vs *= MOVE.diagScale; }
    p.hs = moveAxis(sol, box, p, 'x', p.hs);
    p.vs = moveAxis(sol, box, p, 'y', p.vs);
    if (p.hs || p.vs) { p.dir = Math.atan2(p.vs, p.hs); p.frame += MOVE.animSpeed; }

    if (p.cooldown > 0) p.cooldown--;
    if (mouse.right) pickupOrThrow();
    mouse.right = false;
    if (pressed.has(' ') && !attacking()) execute();
    if (mouse.click && !(p.cooldown > 0) && !attacking() && !p.exec) {
      const a = held();
      if (a && a.gun) {
        // The double barrel fires only from its walk sprite; an empty gun does nothing.
        if (p.ammo > 0 && (a.side === undefined || p.sprite === a.walk)) {
          p.ammo--;
          p.barrel = -p.barrel;
          p.sprite = a.side !== undefined && p.barrel < 0 ? a.attack2 : a.attack;
          p.attackFrame = a.startFrame || 0; p.cooldown = a.cooldown;
          fire(p, aimDeg(), a, true, a.side !== undefined ? p.barrel : 0);
        }
      } else if (a || P.punch) {
        p.sprite = a ? a.attack : P.punch; p.attackFrame = a ? a.frame : MELEE.startFrame; p.cooldown = MELEE.cooldown;
        sfx(SOUND.swing[Math.floor(random(2))]);
      }
    }
    mouse.click = false;
    if (attacking()) {
      const reach = { x: p.x + MELEE.reach * Math.cos(p.aim), y: p.y + MELEE.reach * Math.sin(p.aim) };
      if (!held()?.gun) for (const e of [...enemies])
        if (overlap(p, box, e, e.box) || overlap(reach, box, e, e.box)) knockOut(e, pointDir(p.x, p.y, e.x, e.y), held() ? SOUND.hit : SOUND.punch);
      p.attackFrame += held()?.gun ? held().imageSpeed : MELEE.imageSpeed;
      if (p.attackFrame >= frames(p.sprite)) { p.sprite = walkSprite(); p.attackFrame = 0; }
    }
  }

  // The mafia and gang: wander on alarm 0 until it sees the player, then chase and
  // shoot (or run in to hit, unarmed or with a melee weapon).
  function stepMafia(e) {
    const g = e.g;
    if (--e.check <= 0) {
      e.check = e.dog ? DOG.recheck : ENEMY.recheck;
      // The first shot waits one re-check (a guess at the reaction time).
      if (!p.dead && sees(e, p)) {
        if (!e.alert) e.wait = ENEMY.recheck;
        e.alert = true; e.seen = { x: p.x, y: p.y };
      }
    }
    let speed = 0;
    if (!e.alert) {
      if (!e.still && --e.alarm <= 0) {
        e.alarm = ENEMY.wanderMin + Math.floor(random(ENEMY.wanderRand));
        e.moveDir = random(360);
        const speed = Math.round(random(1));
        e.hs = lenX(speed, e.moveDir); e.vs = lenY(speed, e.moveDir);
        e.imageSpeed = speed * ENEMY.wanderAnim;
        if (!speed) e.frame = 0;
      }
      if (!free(sol, e.box, e.x + e.hs * ENEMY.ahead, e.y)) e.hs = -e.hs;
      if (!free(sol, e.box, e.x, e.y + e.vs * ENEMY.ahead)) e.vs = -e.vs;
    } else {
      const see = !p.dead && sees(e, p);
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
            if (free(sol, e.box, e.x + bx, e.y)) e.x += bx;
            if (free(sol, e.box, e.x, e.y + by)) e.y += by;
          }
          e.angle = turnToward(e.angle, dir, ENEMY.turn);
        }
        if (e.wait > 0) e.wait--;
        else if (e.cooldown > 0) e.cooldown--;
        else {
          e.cooldown = g.cooldown;
          if (e.spr.attack) { e.sprite = e.spr.attack; e.frame = 0; }
          fire(e, e.angle, g, false, g.side !== undefined ? 1 : 0);
        }
      } else {
        // Unarmed and in sight: run straight in (0xf4e710). Otherwise, or when
        // a wall is in the way (seen through a gap), follow a path to the
        // player, made again every 20 steps.
        e.hs = e.vs = 0;
        const chase = e.dog ? DOG.speed : ENEMY.chaseSpeed;
        if (see && d > 2 && free(sol, e.box, e.x + lenX(chase, dir), e.y + lenY(chase, dir))) {
          e.path = null;
          e.hs = lenX(chase, dir); e.vs = lenY(chase, dir);
          e.angle = dir;
        } else if (d > 2 && !p.dead) {
          if (!(--e.repath > 0)) { e.repath = PATH.every; e.path = pathTo(e, p.x, p.y); }
          followPath(e);
        }
        if (!g && see && d < (e.dog ? DOG.kill : ENEMY.melee)) killPlayer(P.deadBlunt, e.angle);
      }
      if (e.hs || e.vs) e.moveDir = pointDir(0, 0, e.hs, e.vs);
      e.imageSpeed = (e.hs || e.vs) ? ENEMY.wanderAnim * Math.hypot(e.hs, e.vs) : 0;
      if (e.dog && e.spr.run) { e.sprite = e.spr.run; if (e.hs || e.vs) e.imageSpeed = Math.max(e.imageSpeed, DOG.runImage); }
    }
    // path_start moves along the path without collision checks, so a box
    // wider than the 16-px cells can clip a corner.
    if (e.path) { e.x += e.hs; e.y += e.vs; }
    else {
      if (!moveAxis(sol, e.box, e, 'x', e.hs) && e.alert) e.hs = 0;
      if (!moveAxis(sol, e.box, e, 'y', e.vs) && e.alert) e.vs = 0;
    }
    if (!e.alert && (e.hs || e.vs)) e.angle = e.moveDir;
    if (e.hs || e.vs) e.legFrame += ENEMY.legsSpeed;
    if (e.sprite === e.spr.attack) {
      e.frame += g ? g.imageSpeed : MELEE.imageSpeed;
      if (e.frame >= frames(e.sprite)) { e.sprite = e.spr.walk; e.frame = 0; }
    } else e.frame += e.imageSpeed;
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
    if (p.dead || !sees(e, p)) return;
    const n = Object.assign(e.idle, { x: e.x, y: e.y, angle: e.angle, alert: true, seen: { x: p.x, y: p.y }, wait: ENEMY.recheck });
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
      if (p.dead || !sees(e, p)) return;
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
    if (--e.check <= 0) { e.check = HIDE.every; e.alert = !p.dead && sees(e, p); }
    if (!e.alert) { e.frame = Math.max(0, e.frame - HIDE.rise); return; }
    e.angle = pointDir(e.x, e.y, p.x, p.y);
    if (e.frame < HIDE.up) { e.frame = Math.min(HIDE.up, e.frame + HIDE.rise); return; }
    if (--e.cooldown > 0) return;
    e.cooldown = e.g.cooldown;
    fire(e, e.angle, e.g, false);
    if (--e.ammo <= 0) Object.assign(e, { reloading: HIDE.reloadSteps, sprite: e.spr.reload || e.spr.idle, frame: e.spr.reload ? 0 : HIDE.up });
  }

  // Victim1, the factions, dogs, idle, fat, dodger and hiding enemies are
  // ported; others stand and idle.
  function stepEnemy(e) {
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
      moveAxis(sol, e.box, e, 'x', lenX(VICTIM1.speed, dir));
      moveAxis(sol, e.box, e, 'y', lenY(VICTIM1.speed, dir));
      if (e.sprite !== e.spr.walk) e.frame = 0;
      e.sprite = e.spr.walk; e.imageSpeed = VICTIM1.walkSpeed; e.angle = dir;
    } else {
      e.sprite = e.spr.cower || e.spr.idle; e.imageSpeed = VICTIM1.cowerSpeed;
    }
  }

  // objNextroom step and collision: live once the floor is clear.
  let cleared = !enemies.some(e => e.isEnemy);
  function stepExits() {
    const clearFloor = !enemies.some(e => e.isEnemy) && !kos.length;
    if (clearFloor && !cleared && exits.length) sfx(SOUND.cleared);
    cleared = clearFloor;
    for (const x of exits) {
      const on = overlap(p, box, x, x.box);
      if (x.off && !on) x.off = false;
      x.live = clearFloor && !x.off;
      if (x.live && on && !p.dead && !p.exec) return leave();
    }
    for (const l of elevators) if (stepElevator(l, clearFloor)) return leave(l);
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
  function leave(lift) {
    handle.stop();
    const carried = { x: p.x, y: p.y, weapon: p.weapon, ammo: p.ammo, elevator: lift && { x: lift.x }, stats };
    if (!env.next || !env.next(room, carried)) env.status(`${room.name} cleared: this is the last room in order.`);
  }

  // The body stops at walls; KnockedOut_step's own wall handling is not read yet.
  function stepKO(k) {
    if (k.speed > 0) {
      const mx = moveAxis(sol, k.box, k, 'x', lenX(k.speed, k.dir)), my = moveAxis(sol, k.box, k, 'y', lenY(k.speed, k.dir));
      k.speed = (mx || my) ? Math.max(0, k.speed - KO.friction) : 0;
    }
    if (k.alarm > 0 && --k.alarm === 0) k.imageSpeed = KO.getUpSpeed;
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
  const hitsWall = (d) => doorPoints(d, 4, DOOR.length - 2).some(q => sol.grid[Math.round(q.y) * sol.w + Math.round(q.x)]);
  // A push turns the door so its free end moves away from whoever pushed.
  // The exe picks the sign from quadrant tests; this is the same intent.
  function pushDoor(d, o, byPlayer) {
    if (Math.abs(d.v) > DOOR.maxPush) return;
    const a = (d.base + d.angle) * RAD, along = -(o.x - d.x) * Math.sin(a) - (o.y - d.y) * Math.cos(a);
    d.v = (along > 0 ? -1 : 1) * (d.h ? DOOR.pushH : DOOR.pushV);
    if (byPlayer) sfx(SOUND.doorOpen);
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

  function step() {
    if (!p.dead) stats.steps++;
    stepPlayer();
    for (const e of [...enemies]) stepEnemy(e);
    for (const k of [...kos]) stepKO(k);
    for (const d of doors) stepDoor(d);
    for (const w of weapons) stepWeapon(w);
    for (const b of [...bullets]) if (!stepBullet(b)) bullets.splice(bullets.indexOf(b), 1);
    pressed.clear();
    stepExits();
    if (!running) return;
    // The shake's decay rate is a guess.
    cam.shake = Math.max(0, cam.shake - 0.2);
    cam.x = Math.max(0, Math.min(room.w - VIEW_W, p.x - VIEW_W / 2));
    cam.y = Math.max(0, Math.min(room.h - VIEW_H, p.y - VIEW_H / 2));
    p.aim = Math.atan2(mouse.y + cam.y - p.y, mouse.x + cam.x - p.x);
  }

  // angle is in canvas radians (clockwise).
  function sprite(name, frame, x, y, angle) {
    const a = name && art.get(name);
    if (!a) return;
    const f = a.hit.frames[Math.floor(frame) % a.hit.frames.length];
    cx.save();
    cx.translate(Math.round(x - cam.x), Math.round(y - cam.y));
    cx.rotate(angle);
    cx.drawImage(imgs.get(a.hit.atlas), f.x, f.y, f.w, f.h, -a.s.ox, -a.s.oy, f.w, f.h);
    cx.restore();
  }

  function draw() {
    const c = room.colour;
    const sx = Math.round((Math.random() * 2 - 1) * cam.shake), sy = Math.round((Math.random() * 2 - 1) * cam.shake);
    cx.save();
    cx.translate(sx, sy);
    cx.fillStyle = `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
    cx.fillRect(-4, -4, VIEW_W + 8, VIEW_H + 8);
    cx.drawImage(under, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    for (const d of dead) sprite(d.sprite, d.frame, d.x, d.y, -d.angle * RAD);
    for (const l of elevators) sprite(l.sprite, Math.floor(l.frame), l.x, l.y, 0);
    for (const k of kos) sprite(k.sprite, k.frame, k.x, k.y, -k.angle * RAD);
    for (const w of weapons) sprite(w.sprite, 0, w.x, w.y, -w.angle * RAD);
    for (const d of doors) sprite(d.sprite, 0, d.x, d.y, -d.angle * RAD);
    for (const e of enemies) {
      if (e.spr.legs) sprite(e.spr.legs, (e.hs || e.vs) ? e.legFrame : 0, e.x, e.y, -e.moveDir * RAD);
      sprite(e.sprite, e.frame, e.x, e.y, -e.angle * RAD);
    }
    for (const x of exits) if (x.live) sprite(x.sprite, x.frame, x.x, x.y, 0);
    for (const b of bullets) sprite(bulletSprite, 0, b.x, b.y, -b.dir * RAD);
    if (held()?.gun) {
      cx.font = 'bold 12px monospace';
      cx.fillStyle = '#fff';
      cx.fillText(`${p.weapon} ${p.ammo}`, 8 - sx, VIEW_H - 8 - sy);
    }
    if (p.dead) {
      sprite(p.dead.sprite, p.dead.frame, p.x, p.y, -p.dead.angle * RAD);
      cx.drawImage(over, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H); cx.restore(); return;
    }
    if (p.exec) { sprite(p.exec.sprite, p.exec.frame, p.x, p.y, -p.exec.angle * RAD); cx.drawImage(over, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H); cx.restore(); return; }
    const moving = p.hs || p.vs;
    sprite(P.legs, moving ? p.frame : 0, p.x, p.y, p.dir);
    sprite(p.sprite, attacking() ? p.attackFrame : moving ? p.frame : 0, p.x, p.y, p.aim);
    cx.drawImage(over, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    cx.restore();
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
  next();
  env.status(`Playing ${room.name} as ${pobj.name}: WASD to move, mouse to aim, click to attack or shoot, right click to pick up or throw a weapon, Space to execute a downed enemy, R to restart. Esc or Stop to leave.`);

  // Handle for tests and for stopping.
  const handle = {
    room: room.name, stats, player: p, keys, pressed, mouse, solids: sol, box, enemies, kos, dead, doors, weapons, bullets, exits, elevators, step, draw, leave,
    stop() {
      running = false;
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mousedown', onMouse);
      canvas.removeEventListener('contextmenu', noMenu);
    },
  };
  return handle;
}
