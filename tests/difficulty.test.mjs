import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/game-fixture.mjs';
import { options } from '../web/settings.js';

async function encounter(easier, weapon, run) {
  const previous = options.easier;
  options.easier = easier;
  let game;
  try {
    ({ game } = await fixture({ kind: 'objEMafiaStatic', configure: ({ objects, addSprite }) => {
      objects[3].sprite = addSprite('sprEMafiaWalk' + weapon);
    } }));
    Object.assign(game.enemies[0], { x: game.player.x + 100, y: game.player.y, angle: 180, check: 1 });
    return run(game);
  } finally {
    game?.stop();
    options.easier = previous;
  }
}

test('Easier mode gives more reaction time before a gunner actually fires', async t => {
  const shotTime = async easier => encounter(easier, '9mm', game => {
    for (let step = 1; step < 120; step++) {
      game.step();
      if (game.bullets.some(b => !b.byPlayer)) return step;
    }
    assert.fail('Gunner never fired');
  });
  const normal = await shotTime(false), easy = await shotTime(true);
  t.diagnostic(`First shot: normal ${normal} steps, easier ${easy} steps`);
  assert(normal > 0 && normal < 30);
  assert(easy >= normal + 20, `Normal fired at ${normal}, easier at ${easy}`);
});

test('Easier mode slows a melee chase without disabling pursuit', async t => {
  const travel = async easier => encounter(easier, 'Bat', game => {
    const enemy = game.enemies[0], start = enemy.x;
    for (let step = 0; step < 10; step++) game.step();
    return start - enemy.x;
  });
  const normal = await travel(false), easy = await travel(true);
  t.diagnostic(`Ten-step chase: normal ${normal} pixels, easier ${easy} pixels`);
  assert(normal > 0 && easy > 0);
  assert(easy < normal * 0.85, `Normal moved ${normal}, easier moved ${easy}`);
});
