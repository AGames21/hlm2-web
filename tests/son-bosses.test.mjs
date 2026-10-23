import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/game-fixture.mjs';
import { COLOMBIAN, LSD, stepSonBoss } from '../web/bosses.js';

async function scene(kind, roomName) {
  return fixture({ roomName, configure: ({ objects, room, addSprite }) => {
    room.w = 968; room.h = 744; room.insts = [];
    const son = addSprite('sprSonWalkUnarmed');
    for (const n of ['sprSonLegs', 'sprSonAttackPunch', 'sprSonKillStomp', ...Object.values(COLOMBIAN.spr)]) addSprite(n);
    objects.push({ id: 4, name: 'objSon', sprite: son, parent: 0, mask: son, depth: 0 });
    const sprite = kind === 'objBoss' ? -1 : addSprite('sprColombianBoss');
    objects.push({ id: 5, name: kind, sprite, parent: kind === 'objBoss' ? -100 : 2, mask: sprite, depth: 0 });
    room.insts.push({ id: 12, obj: 5, x: 480, y: 136 });
    if (kind === 'objBoss') {
      objects.push({ id: 6, name: 'objSonTakeLSD', sprite: addSprite('sprSonTakeLSD', 3), parent: 0, mask: -1, depth: 0 });
      room.insts.push({ id: 13, obj: 6, x: LSD.enter.x, y: LSD.enter.y });
    }
  } });
}

test('Colombian is a single boss, selects Son, and waits for approach', async t => {
  const { game } = await scene('objColombianBoss', 'rmSonMansionFloor4'); t.after(() => game.stop());
  assert.equal(game.diagnostics().character, 'objSon'); assert.equal(game.bosses.length, 1); assert.equal(game.enemies.length, 0);
  game.step(); assert.equal(game.bosses[0].state, 0); assert(!game.player.locked);
  Object.assign(game.player, { x: 480, y: 430 }); game.step();
  assert(game.player.locked); assert.equal(game.bosses[0].state, 1);
});

test('Colombian script unlocks and a bullet completes the encounter once', async t => {
  const { game } = await scene('objColombianBoss', 'rmSonMansionFloor4'); t.after(() => game.stop());
  Object.assign(game.player, { x: 480, y: 430 });
  for (let i = 0; i < 600; i++) game.step();
  const boss = game.bosses[0]; assert.equal(boss.state, 8); assert(!game.player.locked);
  game.bullets.push({ x: boss.x - 2, y: boss.y, dir: 0, speed: 2, byPlayer: true }); game.step();
  assert.equal(game.bosses.length, 0); assert.equal(game.stats.kills, 1); assert.equal(game.dead[0].sprite, COLOMBIAN.spr.dead);
  game.step(); assert.equal(game.stats.kills, 1);
});

test('A bullet before the approach cannot complete the Colombian scene', async t => {
  const { game } = await scene('objColombianBoss', 'rmSonMansionFloor4'); t.after(() => game.stop());
  const boss = game.bosses[0]; game.bullets.push({ x: boss.x - 2, y: boss.y, dir: 0, speed: 2, byPlayer: true }); game.step();
  assert.equal(game.bosses.length, 1); assert.equal(game.stats.kills, 0);
});

test('LSD marker runs the Son pose then releases control without inventing a kill', async t => {
  const { game } = await scene('objBoss', 'rmLSDIntro'); t.after(() => game.stop());
  assert.equal(game.diagnostics().character, 'objSon'); game.step(); assert(game.player.locked);
  for (let i = 0; i < 150; i++) game.step();
  assert.equal(game.bosses.length, 0); assert(!game.player.locked); assert.equal(game.stats.kills, 0);
});

test('Colombian dialogue stages wait for their callbacks and the decoded delays', () => {
  const p = { x: 480, y: 232, frame: 0 }, b = { kind: 'objColombianBoss', state: 1, frame: 0, wait: COLOMBIAN.wait };
  let finish; const calls = [], c = { player: p, frames: () => 4, pages: Array.from({ length: 10 }, (_, n) => n), say(pages, done) { calls.push(pages); finish = done; }, melee: () => false };
  stepSonBoss(b, c); assert.equal(b.state, 2); assert.deepEqual(calls[0], [0,1,2,3,4,5,6]);
  for (let i = 0; i < 300; i++) stepSonBoss(b, c); assert.equal(calls.length, 1);
  finish(); for (let i = 0; i < COLOMBIAN.wait; i++) stepSonBoss(b, c); assert.deepEqual(calls[1], [7]);
  finish(); for (let i = 0; i < COLOMBIAN.wait; i++) stepSonBoss(b, c); assert.deepEqual(calls[2], [8,9]);
  finish(); assert.equal(b.state, 8); assert(!p.locked);
});

test('An inert objBoss marker outside LSD does not replace the player', async t => {
  const { game } = await scene('objBoss', 'rmTutorialFloor1'); t.after(() => game.stop());
  assert.equal(game.diagnostics().character, 'objSonTakeLSD'); assert.equal(game.bosses.length, 0);
});
