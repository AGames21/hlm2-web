import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, mouse } from './helpers/game-fixture.mjs';
import { BEAR, PRISON } from '../web/game.js';

test('A thrown weapon knocks a target down and leaves the player unarmed', async t => {
  const { game, canvas } = await fixture({ weapons: true, carry: { x: 240, y: 135, weapon: 'Bat', ammo: 0 } });
  t.after(() => game.stop()); game.enemies[0].x = game.player.x + 24;
  mouse(canvas, 2); for (let i = 0; i < 5; i++) game.step();
  assert.equal(game.player.weapon, null); assert.equal(game.kos.length, 1);
});

test('A dog dies to one melee hit', async t => {
  const { game, canvas } = await fixture({ kind: 'objDogPatrol', prefix: 'sprDog' }); t.after(() => game.stop());
  mouse(canvas); game.step();
  assert.equal(game.enemies.length, 0); assert.equal(game.kos.length, 0); assert.equal(game.stats.kills, 1);
});

test('A dodger evades a bullet but can be killed by melee', async t => {
  const { game, canvas } = await fixture({ kind: 'objGangDodger', prefix: 'sprGangDodger', configure: ({ addSprite }) => {
    for (const name of ['sprGangDodgerAttack', 'sprGangDodgerDodge', 'sprGangDodgerDead']) addSprite(name, 16);
  } }); t.after(() => game.stop());
  const enemy = game.enemies[0]; enemy.alarm = enemy.check = 1000;
  game.bullets.push({ x: enemy.x - 2, y: enemy.y, dir: 0, speed: 2, byPlayer: true }); game.step();
  assert.equal(game.enemies.length, 1); assert.equal(enemy.sprite, 'sprGangDodgerDodge');
  mouse(canvas); game.step(); assert.equal(game.enemies.length, 0); assert.equal(game.stats.kills, 1);
});

test('A fat enemy survives one bullet and eventually bleeds out', async t => {
  const { game } = await fixture({ kind: 'objEGangFat', prefix: 'sprEGangFat', configure: ({ addSprite }) => addSprite('sprEGangFatDie') }); t.after(() => game.stop());
  const enemy = game.enemies[0]; enemy.alarm = enemy.check = 1000;
  game.bullets.push({ x: enemy.x - 2, y: enemy.y, dir: 0, speed: 2, byPlayer: true }); game.step();
  assert.equal(enemy.hp, 4); assert.equal(game.enemies.length, 1);
  for (let i = 0; i < 102; i++) game.step();
  assert.equal(game.enemies.length, 0); assert.equal(game.stats.kills, 1);
});

test('A hiding gunner fires, can kill the player, and permits restart after death', async t => {
  const { game, env } = await fixture({ kind: 'objColombianHiding', configure: ({ addSprite }) => {
    addSprite('sprColombianHiding'); addSprite('sprColombianHidingReload');
  } }); t.after(() => game.stop());
  Object.assign(game.enemies[0], { x: game.player.x + 100, check: 0, frame: 4, cooldown: 0 });
  game.step(); assert.equal(game.enemies[0].ammo, 23); assert(game.bullets.some(b => !b.byPlayer));
  // Gun spread may legitimately miss. Fix this shot's trajectory so this
  // scenario verifies damage/restart instead of depending on a random hit.
  for (const bullet of game.bullets) {
    bullet.dir = -Math.atan2(game.player.y - bullet.y, game.player.x - bullet.x) * 180 / Math.PI;
  }
  for (let i = 0; i < 20; i++) game.step();
  assert(game.player.dead);
  let restarted = false; env.restart = () => { restarted = true; };
  game.pressed.add('r'); game.step(); assert(restarted);
});

test('An alerted enemy navigates around solid geometry without entering it', async t => {
  const { game } = await fixture({ kind: 'objEMafiaStatic', configure: ({ objects, room, addSprite }) => {
    objects[3].sprite = addSprite('sprEMafiaWalkUnarmed');
    objects.push({ id: 4, name: 'objSolid', parent: -1, sprite: 1, mask: 1, depth: 0 });
    for (let y = 4; y < 164; y += 8) room.insts.push({ id: 100 + y, obj: 4, x: 292, y });
  } }); t.after(() => game.stop());
  Object.assign(game.enemies[0], { x: 340, y: 135, alert: true, seen: { x: 240, y: 135 }, wait: 0, check: 1000 });
  Object.assign(game.player, { x: 240, y: 135 });
  let foundPath = false;
  for (let i = 0; i < 80; i++) {
    game.step(); const enemy = game.enemies[0]; foundPath ||= !!enemy.path;
    assert(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
    assert.notEqual(game.solids.grid[Math.round(enemy.y) * game.solids.w + Math.round(enemy.x)], 1);
  }
  assert(foundPath);
});

test('A player-pushed door swings, knocks a target down, and remains bounded', async t => {
  const { game } = await fixture({ configure: ({ objects, room, addSprite }) => {
    objects.push({ id: 4, name: 'objEditorDoorH', parent: -1, sprite: addSprite('sprDoor'), mask: 1, depth: 0 });
    room.insts.push({ id: 20, obj: 4, x: 240, y: 135 });
  } }); t.after(() => game.stop());
  Object.assign(game.player, { x: 240, y: 135 }); Object.assign(game.enemies[0], { x: 256, y: 139 });
  for (let i = 0; i < 3; i++) game.step();
  assert(game.doors[0].byPlayer); assert.notEqual(game.doors[0].angle, 0); assert.equal(game.kos.length, 1);
  for (let i = 0; i < 100; i++) { game.step(); assert(Math.abs(game.doors[0].angle) <= 135); }
});

test('A cleared elevator completes its ride and carries its arrival information', async t => {
  let carried;
  const { game } = await fixture({ next: (room, carry) => { carried = carry; return true; }, configure: ({ objects, room, sprites, addSprite }) => {
    const mask = addSprite('sprElevatorFloor'); Object.assign(sprites[mask], { w: 96, h: 96, ox: 48, oy: 48, bbox: { l: 0, r: 95, t: 0, b: 95 } });
    objects.push({ id: 4, name: 'objElevator', parent: -1, sprite: addSprite('sprElevator'), mask, depth: 0 });
    room.insts.push({ id: 20, obj: 4, x: 100, y: 100 });
  } }); t.after(() => game.stop());
  game.enemies.length = 0; Object.assign(game.player, { x: 100, y: 100 });
  for (let i = 0; i < 100 && !carried; i++) game.step();
  assert(carried); assert.equal(carried.elevator.x, 100);
  assert(Math.abs(carried.x - 125.46) < 3 && Math.abs(carried.y - 125.46) < 3);
});

for (const [kind, config] of [['objBearBoss', BEAR], ['objPrisonBoss', PRISON]]) {
  test(`${kind} finishes its intro and can be defeated by melee`, async t => {
    const { game, canvas } = await fixture({ kind, configure: ({ objects, addSprite }) => {
      objects[3].parent = -1;
      for (const name of Object.values(config.spr)) addSprite(name, 32);
    } }); t.after(() => game.stop());
    const boss = game.bosses[0]; let sawLock = false;
    for (let i = 0; i < 600; i++) {
      game.step(); sawLock ||= !!game.player.locked;
      if (kind === 'objBearBoss' ? boss.state === 1 : !boss.intro) break;
    }
    assert(sawLock); assert.equal(game.player.locked, false);
    Object.assign(boss, { x: game.player.x + config.reach, y: game.player.y, state: kind === 'objBearBoss' ? 1 : 0, wait: 0, speed: 0, hs: 0, vs: 0, sprite: config.spr.walk });
    game.player.aim = 0; mouse(canvas); game.step();
    assert.equal(game.bosses.length, 0); assert.equal(game.stats.kills, 1);
  });
}
