import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBindings, gameKey, normalizeSettings, validKey } from '../web/settings.js';

test('Older music and censor settings migrate without losing their choices', () => {
  const settings = normalizeSettings({ music: false, censor: true });
  assert.equal(settings.music, false);
  assert.equal(settings.censor, true);
  assert.equal(settings.effectsVolume, 100);
  assert.deepEqual(settings.bindings, defaultBindings);
});

test('Invalid saved values cannot break volume, scaling, or keyboard controls', () => {
  const settings = normalizeSettings({ musicVolume: -20, effectsVolume: 200, zoom: 9, shake: 'off', bindings: { up: 'Escape' } });
  assert.equal(settings.musicVolume, 0);
  assert.equal(settings.effectsVolume, 100);
  assert.equal(settings.zoom, 0);
  assert.equal(settings.shake, true);
  assert.deepEqual(settings.bindings, defaultBindings);
  assert.deepEqual(normalizeSettings(null), normalizeSettings());
});

test('Rebound keys trigger the correct simulation actions and keep arrow movement', () => {
  const bindings = { up: 'i', down: 'k', left: 'j', right: 'l', execute: 'e', restart: 't' };
  assert.deepEqual(normalizeSettings({ bindings }).bindings, bindings);
  for (const [key, action] of [['I', 'w'], ['k', 's'], ['j', 'a'], ['l', 'd'], ['e', ' '], ['t', 'r'], ['ArrowUp', 'w']]) assert.equal(gameKey(key, bindings), action);
  assert.equal(gameKey('w', bindings), null);
  assert.equal(gameKey('Escape', bindings), null);
  assert.equal(validKey('Escape'), false);
});

test('Conflicting saved key bindings fall back to usable defaults', () => {
  const bindings = { ...defaultBindings, up: 's' };
  assert.deepEqual(normalizeSettings({ bindings }).bindings, defaultBindings);
});
