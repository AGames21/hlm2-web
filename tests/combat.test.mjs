import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, mouse } from './helpers/game-fixture.mjs';

test('Pig punches knock down an enemy through the actual mouse input handler', async t => {
  const { game, canvas } = await fixture(); t.after(() => game.stop());
  mouse(canvas); game.step();
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kos.length, 1);
});

test('A missing get-up animation must not make a target invulnerable', async t => {
  const { game, canvas } = await fixture({ getUp: false }); t.after(() => game.stop());
  mouse(canvas); game.step();
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kos.length, 1);
});

test('One-frame knockout artwork must not wake a target immediately', async t => {
  const { game, canvas } = await fixture({ getUpFrames: 1 }); t.after(() => game.stop());
  mouse(canvas); game.step();
  assert.equal(game.kos.length, 1);
  for (let i = 0; i < 60; i++) game.step();
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kos.length, 1);
});

test('Missing execution artwork must not prevent finishing a downed enemy', async t => {
  const { game, canvas } = await fixture({ execution: false }); t.after(() => game.stop());
  mouse(canvas); game.step();
  const body = game.kos[0];
  Object.assign(body, { x: game.player.x, y: game.player.y, speed: 0 });
  // Let the punch finish before pressing the execution key.
  for (let i = 0; i < 25; i++) game.step();
  game.pressed.add(' '); game.step();
  assert.equal(game.kos.length, 0);
  assert.equal(game.stats.kills, 1);
  assert.equal(game.dead.length, 1);
  for (let i = 0; i < 60; i++) game.step();
  assert.equal(game.player.exec, null);
});

test('Combat still resolves when a punch animation is unavailable', async t => {
  const { game, canvas } = await fixture({ punch: false }); t.after(() => game.stop());
  mouse(canvas); game.step();
  assert.equal(game.kos.length, 1);
});

test('Floor handoff removes old input handlers and enables second-floor combat', async t => {
  let second, handoff;
  const first = await fixture({ roomName: 'rmTutorialFloor1', next: (room, carry) => {
    handoff = fixture({ canvas: first.canvas, carry }).then(result => { second = result; }); return true;
  } });
  t.after(() => { first.game.stop(); second?.game.stop(); });
  first.game.leave(); await handoff;
  mouse(second.canvas); second.game.step();
  assert.equal(second.game.kos.length, 1);
  assert.equal(first.game.mouse.click, false, 'old floor must no longer receive mouse input');
  assert.equal(second.game.room, 'rmTutorialFloor2');
});

test('A non-Fans character keeps its identity and art on a floor without a player spawn', async t => {
  const configure = ({ objects, addSprite }) => {
    objects[1].name = 'objNicke';
    objects[1].sprite = addSprite('sprNickeWalkUnarmed');
  };
  let carry;
  const first = await fixture({ roomName: 'rmTutorialFloor1', configure, next: (_, value) => { carry = value; return true; } });
  t.after(() => first.game.stop());
  first.game.leave();
  assert.equal(carry.character, 'objNicke');
  const second = await fixture({ carry, configure });
  t.after(() => second.game.stop());
  assert.equal(second.game.diagnostics().character, 'objNicke');
  assert.equal(second.game.player.sprite, 'sprNickeWalkUnarmed');
});

test('Weapon pickup and melee hits still work with explicit attack state', async t => {
  const { game, canvas } = await fixture({ weapons: true }); t.after(() => game.stop());
  game.weapons.push({ name: 'Bat', x: game.player.x, y: game.player.y, speed: 0, ammo: 0, sprite: 'sprBat' });
  mouse(canvas, 2); game.step();
  assert.equal(game.player.weapon, 'Bat');
  assert.equal(game.weapons.length, 0);
  mouse(canvas); game.step();
  assert.equal(game.kos.length, 1);
  assert.equal(game.player.attack.gun, false);
});

test('Gunfire spends ammo, damages targets, and finishes its attack', async t => {
  const { game, canvas } = await fixture({ weapons: true, carry: { x: 240, y: 135, weapon: '9mm', ammo: 2 } }); t.after(() => game.stop());
  game.enemies[0].x = game.player.x + 50;
  mouse(canvas); game.step();
  assert.equal(game.player.ammo, 1);
  assert.equal(game.player.attack.gun, true);
  for (let i = 0; i < 25; i++) game.step();
  assert.equal(game.stats.kills, 1);
  assert.equal(game.player.attack, null);
});

test('Short-animation knockouts eventually recover after their timer expires', async t => {
  const { game, canvas } = await fixture({ getUpFrames: 1 }); t.after(() => game.stop());
  mouse(canvas); game.step();
  const remaining = game.kos[0].alarm;
  for (let i = 0; i < remaining + 10; i++) game.step();
  assert.equal(game.kos.length, 0);
  assert.equal(game.enemies.length, 1);
});
