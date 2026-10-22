// Level viewer: loads the user's own data wad, decodes the room tables and
// draws a room's tiles and object sprites the way GameMaker would (higher
// depth first).
import { Wad } from './agar.js';
import * as T from './tables.js';
import { play, musicFor } from './game.js';
import { Audio, RemoteFile } from './audio.js';
import { scoreScreen } from './score.js';
import { frontEnd, card, abortMenu, STORY, progress, options } from './menu.js';

const $ = id => document.getElementById(id);
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

async function openGame(blob) {
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
    frames: new Map(), images: new Map(), audio: new Audio(wad, T.sounds(snd)),
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
    status(`Indexing atlases ${Math.min(i + 64, metas.length)}/${metas.length}`);
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

async function drawRoom(room) {
  const { items, imgs, missing, lvl } = await roomItems(room, $('hidden').checked);

  const zoom = +$('zoom').value;
  const cv = $('canvas');
  cv.width = room.w;
  cv.height = room.h;
  cv.style.width = room.w * zoom + 'px';
  cv.style.height = room.h * zoom + 'px';
  const cx = cv.getContext('2d');
  const c = room.colour;
  cx.fillStyle = `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;
  cx.fillRect(0, 0, room.w, room.h);
  for (const i of items) cx.drawImage(imgs.get(i.atlas), i.sx, i.sy, i.w, i.h, i.dx, i.dy, i.w, i.h);
  cv.hidden = false;
  $('intro').hidden = true;
  status(`${room.name}: ${room.w}x${room.h}, ${room.tiles.length} tiles, ${room.insts.length} instances, atlas ${lvl || 'none'}` +
    (missing ? `, ${missing} without art` : ''));
}

// --- Play mode.
let game = null;

function stopPlay() {
  menuToken++;
  abortMenu();
  if (!game) return;
  game.stop();
  game = window.game = null;
  $('play').textContent = 'Play';
}

// carry: what the player brings from the floor before (position, weapon, ammo).
async function startPlay(name = $('room').value, carry = null, track) {
  stopPlay();
  const room = G.rooms.list.find(r => r.name === name);
  if (!room) return;
  const { items, imgs, levelAtlas } = await roomItems(room, false);
  const frames = name => findFrames(name, levelAtlas);
  // The player's sprites often live in shared atlases the room doesn't use.
  const load = async atlas => { if (!imgs.has(atlas)) imgs.set(atlas, await image(atlas)); };
  const env = { G, room, items, imgs, frames, load, canvas: $('canvas'), zoom: +$('zoom').value, status, carry,
    restart: () => startPlay(room.name, carry, track), next: nextFloor };
  $('canvas').hidden = false;
  $('intro').hidden = true;
  game = window.game = await play(env);
  G.audio.playMusic(!options.music ? null : track !== undefined ? track : musicFor(G.rooms, room));
  $('play').textContent = 'Stop';
}

// The floors of one level share a name up to their Floor/Part number, e.g.
// rmFansLevel1Floor1 and rmFansLevel1Floor2. This grouping is a guess from
// the names: the game itself ends a level when the player gets back to the car.
const levelOf = name => {
  const n = name.replace(/Hard$/, ''), m = n.replace(/((Floor|Part|Downstairs)\d+[A-Z]?)+$/, '');
  return m !== n ? m : n.replace(/\d+[A-Z]?$/, '');
};
const isHard = name => /Hard$/.test(name);

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
  scoreScreen(G, $('canvas'), levelOf(room.name).replace(/^rm/, '').toUpperCase(), carry.stats).then(() => {
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
  const r = await frontEnd(G, $('canvas'), +$('zoom').value);
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
  const zoom = +$('zoom').value, cv = $('canvas');
  status(`${s.scene}: ${s.title}`);
  if (s.act) await card(G, cv, zoom, s, 'act');
  if (token !== menuToken) return;
  await card(G, cv, zoom, s, s.film ? 'film' : 'scene');
  if (token !== menuToken) return;
  const room = s.intro && G.rooms.list.find(r => r.name === s.intro);
  if (room) {
    story = { i, intro: true };
    await startPlay(room.name, null, s.introTrack);
    status(`${s.scene} ${s.title}: ${room.name}. Walk out, or press Enter to go to the level. Esc for the menu.`);
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
  scoreScreen(G, $('canvas'), s.title, carry?.stats || { kills: 0, steps: 0 }).then(() => {
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
  stopPlay();
  const room = G.rooms.list.find(r => r.name === $('room').value);
  if (!room) return;
  history.replaceState(null, '', '#' + encodeURIComponent(room.name));
  try {
    await drawRoom(room);
  } catch (e) {
    status('Draw failed: ' + e.message);
    console.error(e);
  }
}

async function start(blob) {
  status('Reading wad index...');
  G = window.G = await openGame(blob);
  fillRooms();
  if (!location.hash || location.hash === '#menu') showMenu();
  else await showSelected();
}

// The music wad is optional; without it the game plays with effects only.
async function setMusic(blob) {
  G.audio.music = await Wad.open(blob);
}

$('pick').onchange = async e => {
  const files = [...e.target.files];
  const data = files.find(f => f.name !== MUSIC_WAD), music = files.find(f => f.name === MUSIC_WAD);
  try {
    if (data) {
      await start(data);
      await store(DATA_WAD, data);
    }
    if (music && G) {
      await setMusic(music);
      await store(MUSIC_WAD, music);
      status('Music loaded.');
    }
  } catch (err) {
    status('Could not read that file: ' + err.message);
    console.error(err);
  }
};
$('play').onclick = () => G && (story = null, game ? (G.audio.playMusic(null), showSelected()) : startPlay().catch(e => { status('Play failed: ' + e.message); console.error(e); }));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && game) story ? showMenu() : showSelected();
  if (e.key === 'Enter' && game && story?.intro) { e.preventDefault(); startLevel(); }
});
$('menu').onclick = () => G && showMenu();
$('filter').oninput = () => G && fillRooms();
$('room').onchange = showSelected;
$('zoom').onchange = () => (game ? startPlay(game.room) : showSelected());
$('hidden').onchange = showSelected;

// Startup: a wad saved earlier in this browser, else one served next to the
// page by a private server (see server.js), else wait for the user to pick.
(async () => {
  try {
    let blob = await load(DATA_WAD);
    if (!blob) {
      const res = await fetch('game/' + DATA_WAD).catch(() => null);
      if (res && res.ok) {
        status('Downloading game data from this server...');
        blob = await res.blob();
        await store(DATA_WAD, blob);
      }
    }
    if (!blob) return;
    await start(blob);
    const music = await load(MUSIC_WAD) || await RemoteFile.open('game/' + MUSIC_WAD).catch(() => null);
    if (music) await setMusic(music);
  } catch (e) {
    status('Startup failed: ' + e.message);
    console.error(e);
  }
})();
