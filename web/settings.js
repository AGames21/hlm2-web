// attack, grab and lock let a trackpad player fight from the keyboard: many
// trackpads ignore taps while keys are held.
export const defaultBindings = { up: 'w', down: 's', left: 'a', right: 'd', execute: ' ', restart: 'r', attack: 'f', grab: 'e', lock: 'q' };
const spareKeys = 'fqegzxcvtyuiophjklbnm1234567890';
export const defaultSettings = { music: true, musicVolume: 70, effectsVolume: 100, shake: true, zoom: 0, censor: false };
const storageKey = 'hlm2-web-options';

export function normalizeSettings(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const out = { ...defaultSettings, bindings: { ...defaultBindings } };
  for (const name of ['music', 'shake', 'censor']) if (typeof input[name] === 'boolean') out[name] = input[name];
  for (const name of ['musicVolume', 'effectsVolume']) if (Number.isFinite(input[name])) out[name] = Math.max(0, Math.min(100, input[name]));
  // 0 fits the game to the window.
  if ([0, 1, 2, 3, 4].includes(input.zoom)) out.zoom = input.zoom;
  // Saves from before an action existed keep their keys; the new action takes
  // its default, or the first spare key when that one is already in use.
  const saved = input.bindings && typeof input.bindings === 'object' ? input.bindings : null;
  const kept = saved && Object.keys(defaultBindings).filter(name => name in saved);
  if (kept?.length && kept.every(name => validKey(saved[name])) && new Set(kept.map(name => saved[name])).size === kept.length) {
    const taken = new Set(kept.map(name => saved[name]));
    for (const name of kept) out.bindings[name] = saved[name];
    const clash = Object.keys(defaultBindings).filter(name => !kept.includes(name) && taken.has(defaultBindings[name]));
    for (const name of Object.keys(defaultBindings)) if (!kept.includes(name) && !clash.includes(name)) taken.add(defaultBindings[name]);
    for (const name of clash) { const key = [...spareKeys].find(k => !taken.has(k)); out.bindings[name] = key; taken.add(key); }
  }
  return out;
}
export function validKey(key) { return typeof key === 'string' && /^[a-z0-9 ]$/.test(key); }
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
export const options = normalizeSettings(saved);
options.save = () => {
  try { localStorage.setItem(storageKey, JSON.stringify(options)); } catch {}
  globalThis.dispatchEvent?.(new Event('settingschange'));
};

// Keep the simulation's action keys stable while allowing physical keys to change.
export function gameKey(key, bindings = options.bindings) {
  const lower = key.toLowerCase();
  const arrow = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' }[lower];
  if (arrow) return arrow;
  const action = Object.keys(defaultBindings).find(name => bindings[name] === lower);
  return action ? defaultBindings[action] : null;
}

export function setupSettings(dialog, onChange, toggleFullscreen, onClose = () => {}) {
  const $ = id => document.getElementById(id);
  let binding = null;
  const labels = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', execute: 'Execute', restart: 'Restart room', attack: 'Attack', grab: 'Pick up / throw', lock: 'Lock on' };
  const keyName = key => key === ' ' ? 'SPACE' : key.toUpperCase();
  function drawBindings() {
    $('key-bindings').replaceChildren(...Object.entries(labels).map(([name, label]) => {
      const row = document.createElement('div'), button = document.createElement('button'), text = document.createElement('span');
      row.className = 'binding-row'; text.textContent = label;
      button.dataset.action = name;
      button.type = 'button'; button.textContent = binding === name ? 'PRESS A KEY…' : keyName(options.bindings[name]);
      button.setAttribute('aria-label', label + ': ' + button.textContent);
      button.onclick = () => { binding = name; drawBindings(); dialog.querySelector(`[data-action="${name}"]`).focus(); $('settings-message').textContent = 'Press a letter, number, or Space. Escape cancels.'; };
      row.append(text, button); return row;
    }));
  }
  function sync() {
    $('setting-music').checked = options.music;
    $('setting-music-volume').value = options.musicVolume;
    $('setting-effects-volume').value = options.effectsVolume;
    $('setting-zoom').value = options.zoom;
    $('setting-shake').checked = options.shake;
    $('settings-fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    drawBindings();
  }
  function changed() { options.save(); onChange(); sync(); }
  for (const [id, name, boolean] of [['setting-music', 'music', true], ['setting-music-volume', 'musicVolume'], ['setting-effects-volume', 'effectsVolume'], ['setting-zoom', 'zoom'], ['setting-shake', 'shake', true]]) {
    $(id).oninput = e => { options[name] = boolean ? e.target.checked : +e.target.value; changed(); };
  }
  for (const button of dialog.querySelectorAll('[data-tab]')) button.onclick = () => {
    binding = null;
    for (const tab of dialog.querySelectorAll('[data-tab]')) tab.setAttribute('aria-pressed', String(tab === button));
    for (const panel of dialog.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== button.dataset.tab;
    $('settings-message').textContent = ''; drawBindings();
  };
  document.addEventListener('keydown', e => {
    if (!dialog.open || !binding) return;
    e.preventDefault(); e.stopPropagation();
    const key = e.key.toLowerCase();
    if (key === 'escape') { binding = null; $('settings-message').textContent = ''; drawBindings(); return; }
    if (!validKey(key) || e.ctrlKey || e.metaKey || e.altKey) { $('settings-message').textContent = 'Choose a letter, number, or Space.'; return; }
    if (Object.entries(options.bindings).some(([name, value]) => name !== binding && value === key)) { $('settings-message').textContent = 'That key is already assigned.'; return; }
    const action = binding;
    options.bindings[action] = key; binding = null; $('settings-message').textContent = 'Controls saved.'; changed();
    dialog.querySelector(`[data-action="${action}"]`).focus();
  }, true);
  $('settings-reset-controls').onclick = () => { options.bindings = { ...defaultBindings }; binding = null; changed(); };
  const close = () => { dialog.close(); onClose(); };
  $('settings-close').onclick = close;
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dialog.addEventListener('close', () => { binding = null; onClose(); });
  $('settings-fullscreen').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', sync);
  globalThis.addEventListener('settingschange', sync);
  sync();
  return () => { binding = null; $('settings-message').textContent = ''; sync(); if (!dialog.open) dialog.showModal(); };
}
