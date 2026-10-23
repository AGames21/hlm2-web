// Level viewer: loads the user's own data wad, decodes the room tables and
// draws a room's tiles and object sprites the way GameMaker would (higher
// depth first).
import { Wad } from './agar.js';
import * as T from './tables.js';
import { play, musicFor } from './game.js';
import { Audio, RemoteFile } from './audio.js';
import { scoreScreen } from './score.js';
import { frontEnd, card, maskMenu, abortMenu, STORY, progress, options } from './menu.js';
import { YouTubePlayer, youtubeTrack } from './youtube.js';
import { SOUNDTRACK, SOUNDTRACK_MIX, SceneSoundtrack, trackLabel, trackSearch } from './soundtrack.js';
import { drawRoomItems } from './render.js';
import { setupFullscreen, fittedSize } from './fullscreen.js';
import { setupSettings } from './settings.js';

const $ = id => document.getElementById(id);
// Zoom 0 means fit to the window: draw at 1x and let CSS scale the canvas.
const zoomNow = () => options.zoom || 1;
const DATA_WAD = 'hlm2_data_desktop.wad';
const MUSIC_WAD = 'hlm2_music_desktop.wad';
// Objects the game draws with blend modes or only as controllers (lighting
// masks like objPiglight1, the effector cursor); hidden unless asked for.
const OVERLAY = /light\d*$|^objEffector$/i;

// --- IndexedDB: keep the picked wad so it only has to be chosen once.
function idb() {
  return new Promise((ok, bad) => {
    const req = indexedDB.open('hlm2-web', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => ok(req.result);
    req.onerror = () => bad(req.error);
  });
}
async function store(key, blob) {
  const db = await idb();
  return new Promise((ok, bad) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = ok;
    tx.onerror = () => bad(tx.error);
  });
}
async function load(key) {
  const db = await idb();
  return new Promise((ok, bad) => {
    const req = db.transaction('files').objectStore('files').get(key);
    req.onsuccess = () => ok(req.result || null);
    req.onerror = () => bad(req.error);
  });
}

// --- Game data.
let G = null;
let audio = null;
const getAudio = () => {
  if (!audio) { audio = new Audio(); audio.onMusicCue = cue => soundtrack.request(cue); }
  return audio;
};
const youtube = new YouTubePlayer($('youtube-slot'), message => { $('youtube-status').textContent = message; });
let sceneLinks = {};
try {
  const saved = JSON.parse(localStorage.getItem('hlm2-youtube-scenes'));
  for (const [cue, url] of Object.entries(saved || {})) {
    if (!Object.hasOwn(SOUNDTRACK, cue)) continue;
    try { youtubeTrack(url); sceneLinks[cue] = url; } catch {}
  }
} catch {}
const soundtrack = new SceneSoundtrack({ player: youtube, sources: sceneLinks, onChange: syncSoundtrack });
for (const cue of Object.keys(SOUNDTRACK)) $('youtube-cue').add(new Option(trackLabel(cue), cue));
$('youtube-cue').value = 'Detection';
try { if (localStorage.getItem('hlm2-youtube-follow') === 'true') soundtrack.mode = 'scene'; } catch {}
function syncSoundtrack() {
  const cue = soundtrack.cue;
  $('youtube-current').textContent = `Scene music: ${trackLabel(cue)}`;
  $('youtube-follow').checked = soundtrack.mode === 'scene';
  try { localStorage.setItem('hlm2-youtube-follow', String(soundtrack.mode === 'scene')); } catch {}
  $('youtube-close').hidden = soundtrack.mode === 'local';
  $('youtube-open').hidden = !youtube.key;
  if (youtube.url) $('youtube-open').href = youtube.url;
  if (cue && Object.hasOwn(SOUNDTRACK, cue)) {
    $('youtube-find').href = trackSearch(cue);
    if (!$('youtube-controls').contains(document.activeElement)) $('youtube-cue').value = cue;
  }
  if (soundtrack.mode === 'scene' && !soundtrack.sources[cue]) {
    $('youtube-status').textContent = cue
      ? `No YouTube link saved for ${trackLabel(cue)}. Find this track and save its video link below to follow this scene automatically.`
      : 'This scene has no music cue.';
  }
}
syncSoundtrack();

async function openGame(blob, progress = status) {
  const wad = await Wad.open(blob);
  const gl = name => wad.bytes('GL/' + name);
  const [spr, obj, bgs, rms, lvl, msk, snd] = await Promise.all([
    gl('hlm2_sprites.bin'), gl('hlm2_objects.bin'), gl('hlm2_backgrounds.bin'),
    gl('hlm2_rooms.bin'), gl('hlm2_level_atlases.bin'), gl('hlm2_collision_masks.bin'),
    gl('hlm2_sounds.bin'),
  ]);
  const game = {
    wad, sprites: T.sprites(spr), objects: T.objects(obj), backgrounds: T.backgrounds(bgs),
    rooms: T.rooms(rms), levelAtlas: T.levelAtlases(lvl), masks: T.collisionMasks(msk),
    frames: new Map(), images: new Map(),
    sounds: T.sounds(snd),
    // Optional: without the text file, talk scenes and date cards are skipped.
    text: await wad.bytes('Assets/hlm2_localization.bin').then(b => T.localization(b), () => []),
  };
  // Index every atlas frame by sprite name: name -> [{atlas, frames}].
  const metas = wad.names('Atlases/').filter(n => n.endsWith('.meta'));
  for (let i = 0; i < metas.length; i += 64) {
    await Promise.all(metas.slice(i, i + 64).map(async m => {
      const atlas = m.slice(0, -5) + '.png';
      for (const [name, frames] of T.meta(await wad.bytes(m))) {
        if (!game.frames.has(name)) game.frames.set(name, []);
        game.frames.get(name).push({ atlas, frames });
      }
    }));
    progress(`Indexing atlases ${Math.min(i + 64, metas.length)}/${metas.length}`);
  }
  return game;
}

// Prefer the room's own level atlas, then a shared atlas, then anything.
function findFrames(name, levelAtlas) {
  const hits = G.frames.get(name);
  if (!hits) return null;
  return hits.find(h => h.atlas === levelAtlas)
    || hits.find(h => !h.atlas.startsWith('Atlases/Levels/'))
    || hits[0];
}

function image(path) {
  if (!G.images.has(path)) G.images.set(path, createImageBitmap(G.wad.slice(path)));
  return G.images.get(path);
}

// --- Rendering.
// Everything a room draws, as atlas blits sorted by depth, plus the atlases.
async function roomItems(room, showHidden) {
  const lvl = G.levelAtlas(room.id);
  const levelAtlas = lvl ? `Atlases/Levels/${lvl}.png` : null;
  const items = [];
  let missing = 0;

  for (const t of room.tiles) {
    const bg = G.backgrounds.get(t.bg);
    const hit = bg && findFrames('Backgrounds/' + bg.name, levelAtlas);
    if (!hit) { missing++; continue; }
    const f = hit.frames[0];
    items.push({ depth: t.depth, atlas: hit.atlas, sx: f.x + t.sx, sy: f.y + t.sy, w: t.w, h: t.h, dx: t.x, dy: t.y });
  }
  for (const inst of room.insts) {
    const o = G.objects.get(inst.obj);
    if (!o || ((!o.visible || OVERLAY.test(o.name)) && !showHidden)) continue;
    const s = G.sprites.get(o.sprite);
    if (!s) continue;
    const hit = findFrames(s.name, levelAtlas);
    if (!hit) { missing++; continue; }
    const f = hit.frames[0];
    items.push({ inst, depth: o.depth, atlas: hit.atlas, sx: f.x, sy: f.y, w: f.w, h: f.h, dx: inst.x - s.ox, dy: inst.y - s.oy });
  }
  items.sort((a, b) => b.depth - a.depth);

  const imgs = new Map();
  await Promise.all([...new Set(items.map(i => i.atlas))].map(async a => imgs.set(a, await image(a))));
  return { items, imgs, missing, lvl, levelAtlas };
}

async function drawRoom(room, request = menuToken) {
  const { items, imgs, missing, lvl } = await roomItems(room, $('hidden').checked);
  if (request !== menuToken) return;

  const zoom = zoomNow();
  const cv = $('canvas');
  cv.width = room.w;
  cv.height = room.h;
  cv.style.width = room.w * zoom + 'px';
  cv.style.height = room.h * zoom + 'px';
  const cx = cv.getContext('2d');
  const c = room.colour;
  cx.fillStyle = `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
  cx.fillRect(0, 0, room.w, room.h);
  drawRoomItems(cx, items, imgs);
  cv.hidden = false;
  $('intro').hidden = true;
  status(`${room.name}: ${room.w}x${room.h}, ${room.tiles.length} tiles, ${room.insts.length} instances, atlas ${lvl || 'none'}` +
    (missing ? `, ${missing} without art` : ''));
}

// --- Play mode.
let game = null, scoreController = null;

function stopPlay() {
  scoreController?.abort();
  scoreController = null;
  menuToken++;
  abortMenu();
  if (!game) return;
  game.stop();
  game = window.game = null;
  $('play').textContent = 'Play';
}

// carry: what the player brings from the floor before (position, weapon, ammo).
// character: the Fans' mask, picked on a room with objMaskMenu and kept on a restart.
async function startPlay(name = $('room').value, carry = null, track, character = carry?.character) {
  stopPlay();
  const request = menuToken;
  const room = G.rooms.list.find(r => r.name === name);
  if (!room) return false;
  const { items, imgs, levelAtlas } = await roomItems(room, false);
  if (request !== menuToken) return false;
  if (!character && room.insts.some(i => G.objects.get(i.obj)?.name === 'objMaskMenu')) {
    character = await maskMenu(G, $('canvas'), zoomNow());
    if (request !== menuToken || typeof character !== 'string') {
      if (character === null) status('No mask picked.');
      return false;
    }
  }
  const frames = name => findFrames(name, levelAtlas);
  // The player's sprites often live in shared atlases the room doesn't use.
  const load = async atlas => { if (!imgs.has(atlas)) imgs.set(atlas, await image(atlas)); };
  const env = { G, room, items, imgs, frames, load, canvas: $('canvas'), zoom: zoomNow(), carry, character,
    status: message => { if (request === menuToken) status(message); },
    cancelled: () => request !== menuToken,
    paused: () => $('settings-dialog').open,
    restart: () => startPlay(room.name, carry, track, character), next: nextFloor,
    // The story's intro room hands over to the level once its talk is over.
    talkDone: () => { if (story?.intro && request === menuToken) setTimeout(() => request === menuToken && story.intro && startLevel(), 600); } };
  $('canvas').hidden = false;
  $('intro').hidden = true;
  const started = await play(env);
  if (!started) return false;
  if (request !== menuToken) { started.stop(); return false; }
  game = window.game = started;
  G.audio.playMusic(track !== undefined ? track : musicFor(G.rooms, room));
  $('play').textContent = 'Stop';
  return true;
}

// The floors of one level share a name up to their Floor/Part number, e.g.
// rmFansLevel1Floor1 and rmFansLevel1Floor2. This grouping is a guess from
// the names: the game itself ends a level when the player gets back to the car.
const levelOf = name => {
  const n = name.replace(/Hard$/, ''), m = n.replace(/((Floor|Part|Downstairs)\d+[A-Z]?)+$/, '');
  return m !== n ? m : n.replace(/\d+[A-Z]?$/, '');
};
const isHard = name => /Hard$/.test(name);

async function showScore(level, stats) {
  scoreController?.abort();
  const controller = new AbortController();
  scoreController = controller;
  const continued = await scoreScreen(G, $('canvas'), level, stats, {
    signal: controller.signal, paused: () => $('settings-dialog').open,
  });
  if (scoreController === controller) scoreController = null;
  return continued;
}

// An exit was taken: play the next room in the game's room order
// (room_goto_next). The Hard copies and test rooms that sit in the order are
// skipped unless the run is in Hard. At the end of a level the score screen
// shows first, and the next level starts fresh. Returns false when there is
// no room after this one.
function nextFloor(room, carry) {
  if (story) return storyNext(room, carry);
  const order = G.rooms.order;
  let next = null;
  for (let i = order.indexOf(room.id) + 1; i > 0 && i < order.length && !next; i++) {
    const r = G.rooms.list.find(r => r.id === order[i]);
    if (r && !/Test$/.test(r.name) && (isHard(room.name) || !isHard(r.name))) next = r;
  }
  const sameLevel = next && levelOf(next.name) === levelOf(room.name);
  const go = () => {
    if (!next) return;
    history.replaceState(null, '', '#' + encodeURIComponent(next.name));
    if ([...$('room').options].some(o => o.value === next.name)) $('room').value = next.name;
    startPlay(next.name, sameLevel ? carry : null).catch(e => { status('Play failed: ' + e.message); console.error(e); });
  };
  if (sameLevel) { go(); return true; }
  if (!carry?.stats?.kills) { go(); return !!next; }
  status(`${levelOf(room.name).replace(/^rm/, '')} cleared. Click or press a key to go on.`);
  showScore(levelOf(room.name).replace(/^rm/, '').toUpperCase(), carry.stats).then(continued => {
    if (!continued) return;
    if (next) go(); else status('That was the last room in order.');
  });
  return true;
}

// --- Story mode: the scenes in order, each with its act card, scene card,
// intro room (skip with Enter) and level, then the score screen.
let story = null, menuToken = 0;

async function showMenu() {
  stopPlay();
  story = null;
  const token = menuToken;
  $('intro').hidden = true;
  history.replaceState(null, '', '#menu');
  status('Arrows and Enter, or the mouse. Esc goes back.');
  let r;
  try { r = await frontEnd(G, $('canvas'), zoomNow(), openSettings); }
  catch (error) { status('Menu failed to load: ' + error.message); console.error(error); return; }
  if (token !== menuToken) return;
  if (r.action === 'viewer') {
    history.replaceState(null, '', '#rmTutorialFloor1');
    fillRooms();
    showSelected();
  } else runScene(r.scene);
}

async function runScene(i) {
  const s = STORY[i];
  if (!s) { showMenu(); return; }
  stopPlay();
  const token = menuToken;
  story = { i, intro: false };
  progress.reach(i);
  const zoom = zoomNow(), cv = $('canvas');
  status(`${s.scene}: ${s.title}`);
  if (s.act) await card(G, cv, zoom, s, 'act');
  if (token !== menuToken) return;
  await card(G, cv, zoom, s, s.film ? 'film' : 'scene');
  if (token !== menuToken) return;
  const room = s.intro && G.rooms.list.find(r => r.name === s.intro);
  if (room) {
    story = { i, intro: true };
    if (await startPlay(room.name, null, s.introTrack)) {
      status(`${s.scene} ${s.title}: Space or click moves the talk on; Enter skips to the level; Esc returns to the menu.`);
    }
  } else startLevel();
}

function startLevel() {
  const s = STORY[story.i];
  story.intro = false;
  startPlay(s.level, null, s.track).catch(e => { status('Play failed: ' + e.message); console.error(e); });
}

function storyNext(room, carry) {
  if (story.intro) { startLevel(); return true; }
  const order = G.rooms.order;
  let next = null;
  for (let i = order.indexOf(room.id) + 1; i > 0 && i < order.length && !next; i++) {
    const r = G.rooms.list.find(r => r.id === order[i]);
    if (r && !/Test$/.test(r.name) && !isHard(r.name)) next = r;
  }
  if (next && levelOf(next.name) === levelOf(room.name)) {
    startPlay(next.name, carry, undefined).catch(e => { status('Play failed: ' + e.message); console.error(e); });
    return true;
  }
  const s = STORY[story.i], i = story.i;
  status(`${s.title} cleared. Click or press a key to go on.`);
  showScore(s.title, carry?.stats || { kills: 0, steps: 0 }).then(continued => {
    if (!continued) return;
    progress.reach(i + 1);
    runScene(i + 1);
  });
  return true;
}

// --- UI.
function status(s) { $('status').textContent = s; }

function fillRooms() {
  const q = $('filter').value.toLowerCase();
  const sel = $('room');
  const cur = sel.value || decodeURIComponent(location.hash.slice(1));
  sel.innerHTML = '';
  for (const r of G.rooms.list) {
    if (q && !r.name.toLowerCase().includes(q)) continue;
    sel.add(new Option(`${r.name} (${r.tiles.length})`, r.name));
  }
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  sel.disabled = false;
}

async function showSelected() {
  if (!G) return;
  stopPlay();
  const request = menuToken;
  const room = G.rooms.list.find(r => r.name === $('room').value);
  if (!room) return;
  history.replaceState(null, '', '#' + encodeURIComponent(room.name));
  try {
    await drawRoom(room, request);
  } catch (e) {
    if (request === menuToken) status('Draw failed: ' + e.message);
    console.error(e);
  }
}

async function start(blob) {
  status('Reading wad index...');
  stopPlay();
  const request = menuToken;
  getAudio().playMusic(null);
  const loaded = await openGame(blob, message => { if (request === menuToken) status(message); });
  if (request !== menuToken) return false;
  loaded.audio = getAudio();
  loaded.audio.wad = loaded.wad;
  loaded.audio.table = loaded.sounds;
  for (const key of loaded.audio.buffers.keys()) if (!key.startsWith('Music/')) loaded.audio.buffers.delete(key);
  G = window.G = loaded;
  // Test hook: start a story scene by index.
  window.runScene = runScene;
  $('menu').disabled = $('play').disabled = false;
  fillRooms();
  if (!location.hash || location.hash === '#menu') showMenu();
  else await showSelected();
  return true;
}

// Music is independent of the game data and can be used as a standalone player.
async function setMusic(blob) {
  const wad = await Wad.open(blob);
  const names = wad.names('Music/').filter(n => n.endsWith('.ogg')).sort();
  if (!names.length) throw new Error('No OGG music tracks in this WAD');
  const a = getAudio(), requested = a.requestedMusic;
  await a.playMusic(null);
  a.music = wad;
  for (const key of a.buffers.keys()) if (key.startsWith('Music/')) a.buffers.delete(key);
  $('music-track').length = 1;
  for (const name of names) {
    const track = name.slice(6, -4);
    $('music-track').add(new Option(track, track));
  }
  $('music-track').value = names[0].slice(6, -4);
  $('music-status').textContent = `${names.length} music tracks loaded.`;
  if (requested) await a.playMusic(requested);
}

async function loadFiles(files) {
  const data = files.find(f => f.name.toLowerCase() === DATA_WAD), music = files.find(f => f.name.toLowerCase() === MUSIC_WAD);
  try {
    if (!data && !music) throw new Error(`Choose ${DATA_WAD} or ${MUSIC_WAD}`);
    if (music) {
      await setMusic(music);
      await store(MUSIC_WAD, music).catch(() => { $('music-status').textContent += ' Browser storage unavailable; reload the file next visit.'; });
    }
    if (data) {
      if (await start(data)) await store(DATA_WAD, data).catch(() => status('Game loaded; browser storage unavailable.'));
    }
  } catch (err) {
    status('Could not read that file: ' + err.message);
    console.error(err);
  }
}
$('pick').onchange = async e => {
  await loadFiles([...e.target.files]);
  e.target.value = '';
};
// Drag the wads anywhere onto the page.
let drags = 0;
const dragsFiles = e => e.dataTransfer?.types.includes('Files');
addEventListener('dragenter', e => { if (dragsFiles(e)) { drags++; $('drop').hidden = false; } });
addEventListener('dragleave', e => { if (dragsFiles(e) && --drags <= 0) { drags = 0; $('drop').hidden = true; } });
addEventListener('dragover', e => { if (dragsFiles(e)) e.preventDefault(); });
addEventListener('drop', e => {
  if (!dragsFiles(e)) return;
  e.preventDefault();
  drags = 0; $('drop').hidden = true;
  loadFiles([...e.dataTransfer.files]);
});
$('music-play').onclick = async () => {
  const button = $('music-play');
  button.disabled = true;
  try {
    closeYouTube();
    options.music = true; options.save();
    const a = getAudio();
    await a.ctx.resume();
    const stop = !!a.track;
    if (await a.playMusic(stop ? null : $('music-track').value) === false) throw new Error('Could not decode music');
    $('music-status').textContent = stop ? 'Music stopped.' : `Playing: ${$('music-track').selectedOptions[0].textContent}`;
  } catch (e) { $('music-status').textContent = 'Music failed: ' + e.message; }
  finally { button.disabled = false; syncMusicButton(); }
};
function syncMusicButton() {
  const playing = !!audio?.track;
  $('music-play').textContent = playing ? 'Stop music' : 'Play music';
  $('music-play').setAttribute('aria-pressed', String(playing));
}
// Game menus also change tracks, so keep the standalone controls in sync.
setInterval(syncMusicButton, 250);
$('music-track').onchange = async () => {
  if (!audio?.track) return;
  try {
    await audio.ctx.resume();
    if (await audio.playMusic($('music-track').value) === false) throw new Error('Could not decode music');
    $('music-status').textContent = `Playing: ${$('music-track').selectedOptions[0].textContent}`;
  } catch (e) { $('music-status').textContent = 'Music failed: ' + e.message; }
};
$('music-volume').oninput = e => { options.musicVolume = +e.target.value; options.save(); };
function closeYouTube() {
  soundtrack.stop();
  if (audio) audio.externalMusic = false;
  $('youtube-status').textContent = 'Play the game soundtrack, or save video links for automatic scene music. No music WAD needed.';
}
$('youtube-close').onclick = () => { closeYouTube(); if (game) $('canvas').focus({ preventScroll: true }); };
$('youtube-mix').onclick = () => {
  const a = getAudio(); a.stopLocalMusic();
  options.music = true; options.save();
  soundtrack.manual(SOUNDTRACK_MIX);
};
$('youtube-follow').onchange = e => {
  const a = getAudio(); a.stopLocalMusic();
  if (e.target.checked) {
    options.music = true; options.save();
    soundtrack.enable(G ? a.requestedMusic : a.requestedMusic || 'Detection');
  } else closeYouTube();
};
$('youtube-cue').onchange = () => {
  $('youtube-find').href = trackSearch($('youtube-cue').value);
};
$('youtube-form').onsubmit = e => {
  e.preventDefault();
  try {
    const url = $('youtube-url').value.trim(), track = youtubeTrack(url);
    if ($('youtube-save-scene').checked) {
      if (!track.videoId && !new URL(url).searchParams.has('index')) throw new Error('For scene music, choose a single video or a playlist link with its track index.');
      const cue = $('youtube-cue').value;
      sceneLinks[cue] = url;
      soundtrack.assign(cue, url);
      try { localStorage.setItem('hlm2-youtube-scenes', JSON.stringify(sceneLinks)); }
      catch { $('youtube-status').textContent = 'Link works for this visit; browser storage is unavailable.'; }
      const a = getAudio(); a.stopLocalMusic();
      options.music = true; options.save();
      soundtrack.enable(G ? a.requestedMusic : a.requestedMusic || cue);
      if (soundtrack.cue !== cue) $('youtube-status').textContent = `Saved ${trackLabel(cue)}. It will play when that scene starts.`;
    } else {
      const a = getAudio(); a.stopLocalMusic();
      options.music = true; options.save();
      soundtrack.manual(url);
    }
    syncMusicButton();
  } catch (e) { $('youtube-status').textContent = e.message; }
};
setupFullscreen($('canvas'), $('view'), $('fullscreen'), $('fullscreen-exit'), status);
const applySettings = () => {
  $('music-volume').value = options.musicVolume;
  youtube.setVolume(options.musicVolume, options.music);
  $('zoom').value = options.zoom;
  const cv = $('canvas');
  cv.style.width = cv.width * zoomNow() + 'px';
  cv.style.height = cv.height * zoomNow() + 'px';
  fit();
};
// Fit mode scales the canvas to the free space under the header.
function fit() {
  const view = $('view'), cv = $('canvas');
  view.classList.toggle('fit', options.zoom === 0);
  if (options.zoom !== 0) return;
  const yt = $('youtube-controls');
  const size = fittedSize(cv.width, cv.height, view.clientWidth - 32, view.clientHeight - 32 - (yt.hidden ? 0 : yt.offsetHeight));
  cv.style.setProperty('--fit-width', size.width + 'px');
  cv.style.setProperty('--fit-height', size.height + 'px');
}
new ResizeObserver(fit).observe($('view'));
new MutationObserver(fit).observe($('canvas'), { attributes: true, attributeFilter: ['width', 'height', 'hidden'] });
// Rarely used panels stay folded away; the choice is remembered.
function panelToggle(button, panels, key) {
  const set = open => {
    for (const p of panels) $(p).hidden = !open;
    $(button).setAttribute('aria-pressed', String(open));
    try { localStorage.setItem(key, open ? '1' : ''); } catch {}
    fit();
  };
  let open = false;
  try { open = localStorage.getItem(key) === '1'; } catch {}
  set(open);
  $(button).onclick = () => set($(button).getAttribute('aria-pressed') !== 'true');
}
panelToggle('toggle-music', ['music-controls', 'youtube-controls'], 'hlm2-panel-music');
panelToggle('toggle-tools', ['tools'], 'hlm2-panel-tools');
const focusGame = () => { if (!$('canvas').hidden) $('canvas').focus({ preventScroll: true }); };
const openSettings = setupSettings($('settings-dialog'), applySettings, () => $('fullscreen').click(), focusGame);
$('settings-report').onclick = () => {
  const report = { version: 'combat-state-2026-10-22', date: new Date().toISOString(), game: game?.diagnostics() || null,
    selectedRoom: $('room').value, story: story && { ...story }, gameDataLoaded: !!G };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'hlm2-bug-report.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('settings-message').textContent = 'Bug report saved. It contains room and combat state, with no WAD files.';
};
$('settings').onclick = $('fullscreen-settings').onclick = openSettings;
addEventListener('settingschange', applySettings);
applySettings();
$('play').onclick = () => G && (story = null, game ? (G.audio.playMusic(null), showSelected()) : startPlay().catch(e => { status('Play failed: ' + e.message); console.error(e); }));
addEventListener('keydown', e => {
  if ($('settings-dialog').open) return;
  if (e.target.closest?.('input, select, textarea, button') || e.target.isContentEditable) return;
  if (e.key === 'Escape' && game) story ? showMenu() : showSelected();
  if (e.key === 'Enter' && game && story?.intro) { e.preventDefault(); startLevel(); }
});
$('menu').onclick = () => G && showMenu();
$('filter').oninput = () => G && fillRooms();
$('room').onchange = showSelected;
$('zoom').onchange = e => { options.zoom = +e.target.value; options.save(); applySettings(); };
$('hidden').onchange = showSelected;

// Startup: a wad saved earlier in this browser, else one served next to the
// page by a private server (see server.js), else wait for the user to pick.
(async () => {
  // Restore music even when there is no data WAD. Storage failure must not
  // prevent trying the supported private-server route.
  try {
    const music = await load(MUSIC_WAD).catch(() => null) || await RemoteFile.open('game/' + MUSIC_WAD).catch(() => null);
    if (music) await setMusic(music);
  } catch (e) { $('music-status').textContent = 'Could not restore music: ' + e.message; }
  try {
    let blob = await load(DATA_WAD).catch(() => null);
    if (!blob) {
      const res = await fetch('game/' + DATA_WAD).catch(() => null);
      if (res && res.ok) {
        status('Downloading game data from this server...');
        blob = await res.blob();
        await store(DATA_WAD, blob).catch(() => {});
      }
    }
    if (!blob) return;
    await start(blob);
  } catch (e) {
    status('Startup failed: ' + e.message);
    console.error(e);
  }
})();
