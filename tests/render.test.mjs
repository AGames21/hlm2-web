import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRoomItems } from '../web/render.js';
import { fittedSize } from '../web/fullscreen.js';

test('Floors remain in a room without a player spawn', () => {
  const tile = { atlas: 'floor', sx: 2, sy: 3, w: 16, h: 16, dx: 32, dy: 48, depth: 100 };
  const furniture = { ...tile, atlas: 'chair', inst: {}, depth: 0 };
  const enemy = { ...tile, inst: {}, depth: 0 };
  const calls = [], images = new Map([['floor', 'floor image'], ['chair', 'chair image']]);
  // A room without a player puts an undefined spawn in this set.
  const moving = new Set([undefined, enemy.inst]);
  drawRoomItems({ drawImage: (...args) => calls.push(args) }, [tile, furniture, enemy], images, () => true, moving);
  assert.deepEqual(calls, [
    ['floor image', 2, 3, 16, 16, 32, 48, 16, 16],
    ['chair image', 2, 3, 16, 16, 32, 48, 16, 16],
  ]);
});

test('Rendering retains the depth split and excludes only moving instances', () => {
  const player = {}, items = [
    { atlas: 'floor', depth: 100 }, { atlas: 'player', depth: 0, inst: player }, { atlas: 'roof', depth: -100 },
  ];
  const calls = [], cx = { drawImage: image => calls.push(image) };
  const images = new Map(items.map(item => [item.atlas, item.atlas]));
  drawRoomItems(cx, items, images, i => i.depth >= 0, new Set([player]));
  assert.deepEqual(calls, ['floor']);
  calls.length = 0;
  drawRoomItems(cx, items, images, i => i.depth < 0, new Set([player]));
  assert.deepEqual(calls, ['roof']);
});

test('Fullscreen enlarges a 480x270 canvas to the largest undistorted size', () => {
  assert.deepEqual(fittedSize(480, 270, 1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(fittedSize(480, 270, 1440, 900), { width: 1440, height: 810 });
  assert.deepEqual(fittedSize(480, 270, 900, 1440), { width: 900, height: 506.25 });
  assert.deepEqual(fittedSize(480, 270, 320, 180), { width: 320, height: 180 });
});
