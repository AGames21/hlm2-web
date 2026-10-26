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
  const bindings = { up: 'i', down: 'k', left: 'j', right: 'l', execute: 'e', restart: 't', attack: 'f', grab: 'g', lock: 'q' };
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

test('Saves from before the trackpad keys gain them without clashes', () => {
  const old = { up: 'i', down: 'k', left: 'j', right: 'l', execute: 'e', restart: 't' };
  const b = normalizeSettings({ bindings: old }).bindings;
  for (const name of Object.keys(old)) assert.equal(b[name], old[name]);
  assert.equal(b.attack, 'f'); assert.equal(b.lock, 'q');
  assert.notEqual(b.grab, 'e');
  assert.equal(new Set(Object.values(b)).size, Object.keys(defaultBindings).length);
  assert.equal(gameKey('f', b), 'f');
  assert.equal(gameKey('Q', defaultBindings), 'q');
});

test('Easier enemies is on by default and a saved choice is kept', () => {
  assert.equal(normalizeSettings({}).easier, true);
  assert.equal(normalizeSettings({ easier: false }).easier, false);
});
