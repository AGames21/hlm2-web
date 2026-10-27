// Front end: the boot logos, the content notice, the title screen, the scene
// list and the act/scene cards, drawn with the game's own sprites and fonts.
// Sources: objDevolverAbstraction (rmDevolver), objSplash (rmDennaton),
// objCensorship (rmCensorship), objTitleScreen (rmTitle: create 0xc10390,
// draw 0xc11910, step 0xc15db0) and the scene setter 0x11c5bf0. The wave and
// colour formulas are the decoded ones; positions the decode did not pin down
// are placed by eye and say so.
import { loadFont, drawText, textWidth, clock } from './score.js';
import { options } from './settings.js';
export { options } from './settings.js';

export const W = 480, H = 256;

// The story, from the scene setter 0x11c5bf0. Each scene starts in its intro
// room (the cutscene before the level; null where the setter has none) and
// then its level. act: the act card shown before the scene. Tracks are
// Music/<name>.ogg: intro is the cutscene track, level the level track.
export const STORY = [
  { scene: 'PROLOGUE', title: 'MIDNIGHT ANIMAL', intro: null, level: 'rmTutorialFloor1', introTrack: null, track: 'Detection', film: true, score: false },
  { scene: '1ST SCENE', title: 'DOWN UNDER', act: ['First Act', 'EXPOSITION'], intro: 'rmFansHeadQuarters', level: 'rmFansLevel1Floor1', introTrack: 'Blizzard', track: 'voyager' },
  { scene: '2ND SCENE', title: 'HOMICIDE', intro: 'rmDiner', level: 'rmMallFloor1', introTrack: 'Disturbance', track: 'Technoir' },
  { scene: '3RD SCENE', title: 'HARD NEWS', intro: 'rmCobraApartment1', level: 'rmNewsPaperFloor1', introTrack: 'MiamiJam', track: 'Divide' },
  { scene: '4TH SCENE', title: 'FINAL CUT', intro: 'rmTalkShow', level: 'rmPoliceStationFloor1', introTrack: null, track: 'Videodrome' },
  { scene: '5TH SCENE', title: 'FIRST TRIAL', act: ['Second Act', 'RISING'], intro: 'rmCourt', level: 'rmCasinoFloor1', introTrack: 'Interlude', track: 'NewWave' },
  { scene: '6TH SCENE', title: 'MOVING UP', intro: 'rmFansHeadQuarters2', level: 'rmFansLevel3Floor1', introTrack: 'Blizzard', track: 'evil' },
  { scene: '7TH SCENE', title: 'NO MERCY', intro: 'rmCrimeScene3Floor2', level: 'rmHenchmanLevel1Floor1', introTrack: 'Hideout', track: 'Remorse' },
  { scene: '8TH SCENE', title: 'EXECUTION', intro: null, level: 'rmFansLevel2Floor1', introTrack: null, track: 'Sexualizer' },
  { scene: '9TH SCENE', title: 'AMBUSH', act: ['Third Act', 'CLIMAX'], intro: 'rmTikiBar', level: 'rmJungle1', introTrack: 'Java', track: 'Delay' },
  { scene: '10TH SCENE', title: 'INTO THE PIT', intro: 'rmFansHeadQuarters3', level: 'rmSewersEntrance', introTrack: 'Blizzard', track: 'voyager' },
  { scene: '11TH SCENE', title: 'DEAD AHEAD', intro: 'rmSwanApartment', level: 'rmBoatDock', introTrack: 'Interlude', track: 'Bloodline' },
  { scene: '12TH SCENE', title: 'DEATH WISH', intro: 'rmFansHeadQuarters5', level: 'rmFansLevel5Floor1', introTrack: 'HollywoodHeights', track: 'RollerMobster' },
  { scene: '13TH SCENE', title: 'SUBWAY', act: ['Fourth Act', 'FALLING'], intro: 'rmWriterHome1', level: 'rmSubwayPlatform', introTrack: 'Around', track: 'Run' },
  { scene: '14TH SCENE', title: 'STRONGHOLD', intro: 'rmOceanSide', level: 'rmDayJungle1', introTrack: 'Rust', track: 'HotlineTheme' },
  { scene: '15TH SCENE', title: 'WITHDRAWAL', intro: 'rmCobraApartment2', level: 'rmMethLabFloor1', introTrack: 'MiamiJam', track: 'Quixotic' },
  { scene: '16TH SCENE', title: 'CASUALTIES', intro: 'rmCamp3Day', level: 'rmPowerPlant1', introTrack: 'Interlude', track: 'WayHome' },
  { scene: '17TH SCENE', title: 'FIRST BLOOD', act: ['Fifth Act', 'INTERMISSION'], intro: 'rmWriterHome2', level: 'rmRatLevel1Floor1', introTrack: 'Around', track: 'Dubmood' },
  { scene: '18TH SCENE', title: 'DEMOLITION', intro: null, level: 'rmRatLevel2Floor1', introTrack: null, track: 'NARC' },
  { scene: '19TH SCENE', title: 'HOUSE CALL', intro: 'rmRatHome3Floor1', level: 'rmRatLevel3Floor1', introTrack: 'Around', track: 'Rumble' },
  { scene: '20TH SCENE', title: 'RELEASE', intro: 'rmWriterHome3', level: 'rmPrisonFloor1A', introTrack: 'Around', track: 'Interlude' },
  { scene: '21ST SCENE', title: 'SEIZURE', act: ['Sixth Act', 'CATASTROPHE'], intro: 'rmSonHideout2', level: 'rmStripClubEntrance', introTrack: 'MsMinnie', track: 'BurningCoals' },
  { scene: '22ND SCENE', title: 'BLOODMONEY', intro: 'rmSonHideout3', level: 'rmBankEntrance', introTrack: 'Hideout', track: 'Interlude' },
  { scene: '23RD SCENE', title: 'CAUGHT', intro: 'rmCopApartment3Floor2Part2', level: 'rmNightmarePoliceOffice', introTrack: 'Interlude', track: 'SlumLord' },
  { scene: '24TH SCENE', title: 'TAKE OVER', intro: null, level: 'rmSonMansionFloor1', introTrack: 'MsMinnie', track: 'FutureClub' },
  { scene: '25TH SCENE', title: 'APOCALYPSE', intro: null, level: 'rmLSDIntro', introTrack: null, track: 'Interlude' },
  { scene: 'BONUS SCENE', title: 'THE ABYSS', intro: 'rmCopyFlash', level: 'rm50Blessings1', introTrack: 'GuidedMeditation', track: 'AbyssIntro' },
];

// Scenes finished in this browser: the highest index reached.
const SAVE = 'hlm2-web-progress';
export const progress = {
  get() { try { return +localStorage.getItem(SAVE) || 0; } catch { return 0; } },
  reach(i) { try { if (i > this.get()) localStorage.setItem(SAVE, i); } catch {} },
};
// Best score and time per scene, for the chapter select's panel.
const RECORDS = 'hlm2-web-records';
export const records = {
  all() { try { return JSON.parse(localStorage.getItem(RECORDS)) || {}; } catch { return {}; } },
  get(i) { return this.all()[i]; },
  put(i, { score = 0, steps = 0 } = {}) {
    const all = this.all(), old = all[i];
    all[i] = { score: Math.max(score, old?.score ?? 0), steps: old && old.steps < steps ? old.steps : steps };
    try { localStorage.setItem(RECORDS, JSON.stringify(all)); } catch {}
  },
};

// GameMaker colours (BGR in the exe, here as [r, g, b]).
const C = {
  black: [0, 0, 0], white: [255, 255, 255], lime: [0, 255, 0], yellow: [255, 255, 0],
  aqua: [0, 255, 255], teal: [0, 128, 128], maroon: [128, 0, 0], fuchsia: [255, 0, 255],
};
const merge = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const wave = (k, t, ph = 0) => 0.5 * Math.sin(k * t + ph) + 0.5;

// --- Sprites from the atlases.
function art(G, name) {
  const hits = G.frames.get(name);
  if (!hits) return null;
  const hit = hits.find(h => !h.atlas.startsWith('Atlases/Levels/')) || hits[0];
  if (!G.images.has(hit.atlas)) G.images.set(hit.atlas, createImageBitmap(G.wad.slice(hit.atlas)));
  return { frames: hit.frames, img: G.images.get(hit.atlas) };
}
async function sprites(G, names) {
  const out = {};
  await Promise.all(names.map(async n => {
    try {
      const a = art(G, n);
      if (a) out[n] = { frames: a.frames, img: await a.img };
    } catch (error) { console.warn('Menu art unavailable:', n, error.message); }
  }));
  return out;
}
// Frame i of a sprite at (x, y), its top left unless centred.
function blit(cx, s, i, x, y, { scale = 1, centre = false } = {}) {
  if (!s) return;
  const f = s.frames[Math.floor(i) % s.frames.length], w = f.w * scale, h = f.h * scale;
  cx.drawImage(s.img, f.x, f.y, f.w, f.h, centre ? x - w / 2 : x, centre ? y - h / 2 : y, w, h);
}
function tile(cx, s, alpha, ox = 0, oy = 0) {
  if (!s) return;
  const f = s.frames[0];
  cx.globalAlpha = alpha;
  for (let y = -oy % f.h - f.h; y < H; y += f.h)
    for (let x = -ox % f.w - f.w; x < W; x += f.w) cx.drawImage(s.img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
  cx.globalAlpha = 1;
}

// --- Input shared by the screens: arrows, Enter/Space, Escape, mouse.
function input(canvas) {
  const q = [];
  const key = e => {
    if (document.querySelector('#settings-dialog[open]')) return;
    if (e.target.closest?.('input, select, textarea, button') || e.target.isContentEditable) return;
    if (e.repeat && !/Arrow/.test(e.key)) return;
    const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
      Enter: 'ok', ' ': 'ok', Escape: 'back', Backspace: 'back' }[e.key];
    if (k) { q.push({ k }); e.preventDefault(); }
  };
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  };
  const down = e => { if (e.button === 0) q.push({ k: 'click', ...pos(e) }); else if (e.button === 2) q.push({ k: 'back' }); };
  const move = e => q.push({ k: 'move', ...pos(e) });
  const menu = e => e.preventDefault();
  addEventListener('keydown', key);
  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('contextmenu', menu);
  return {
    take: () => q.splice(0),
    off() {
      removeEventListener('keydown', key);
      canvas.removeEventListener('mousedown', down);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('contextmenu', menu);
    },
  };
}

// Bumped to end whatever screen is running (the page moved on to a room).
let epoch = 0;
export const abortMenu = () => epoch++;

// Runs frame(t, events) at 60 steps a second until it returns a value.
function loop(canvas, frame) {
  const io = input(canvas), mine = epoch;
  return new Promise(done => {
    let t = 0, last = performance.now(), acc = 0, stopped = false, id = 0;
    // As in game.js: a timer stands in when requestAnimationFrame stalls.
    const next = () => {
      const mine = ++id;
      requestAnimationFrame(now => mine === id && tick(now));
      setTimeout(() => mine === id && tick(performance.now()), 50);
    };
    const tick = now => {
      if (stopped) return;
      if (mine !== epoch) { stopped = true; io.off(); done({ action: 'aborted' }); return; }
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        const r = frame(t++, io.take());
        if (r !== undefined) { stopped = true; io.off(); done(r); return; }
      }
      next();
    };
    next();
  });
}

function setup(canvas, zoom) {
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = W * zoom + 'px';
  canvas.style.height = H * zoom + 'px';
  canvas.hidden = false;
  canvas.focus?.({ preventScroll: true });
  const cx = canvas.getContext('2d');
  cx.imageSmoothingEnabled = false;
  return cx;
}

const skip = ev => ev.some(e => e.k === 'ok' || e.k === 'click' || e.k === 'back');

// --- rmDevolver: three logos on white, 240 steps for the first and 180 for
// the others (alarm 0), with sprNoise over them.
async function logos(G, cx, canvas) {
  const s = await sprites(G, ['sprDevolver', 'sprAbstraction', 'sprSpikeChunsoft', 'sprNoise']);
  const seq = [['sprDevolver', 240], ['sprAbstraction', 180], ['sprSpikeChunsoft', 180]];
  let i = 0, start = 0;
  return loop(canvas, (t, ev) => {
    if (skip(ev)) return true;
    const [name, len] = seq[i];
    if (t - start >= len) { i++; start = t; if (i >= seq.length) return true; }
    const sp = s[seq[i][0]], k = t - start, n = seq[i][1];
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, W, H);
    if (sp) {
      const f = sp.frames[0], scale = Math.min(0.9 * W / f.w, 0.6 * H / f.h, 1);
      cx.globalAlpha = Math.min(1, k / 30, (n - k) / 30);
      blit(cx, sp, 0, W / 2, H / 2, { scale, centre: true });
    }
    tile(cx, s.sprNoise, 0.08, (t * 37) % 160, (t * 53) % 160);
    cx.globalAlpha = 1;
  });
}

// --- rmDennaton (240x128, drawn here at 2x): the wave washes in, the
// title flashes up and "GAMES" types on. Frame timings are by eye.
async function dennaton(G, cx, canvas) {
  const s = await sprites(G, ['splSplashShift', 'splWaveComing', 'splDennatonFlash', 'splDennatonTitle', 'splGames', 'splDennatonPieces', 'sprNoise']);
  return loop(canvas, (t, ev) => {
    if (skip(ev) || t > 330) return true;
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H);
    cx.save();
    cx.scale(2, 2);
    if (t < 80) blit(cx, s.splWaveComing, t / 6, 0, 24);
    else if (t < 140) blit(cx, s.splSplashShift, (t - 80) / 3, 0, 24);
    else {
      blit(cx, s.splDennatonPieces, 0, 0, 34);
      if (t < 190) blit(cx, s.splDennatonFlash, (t - 140) / 6, 0, 34);
      blit(cx, s.splDennatonTitle, Math.min(16, (t - 140) / 3), 56, 100);
      if (t > 200) blit(cx, s.splGames, Math.min(38, (t - 200) / 2), 104, 106);
    }
    cx.restore();
    cx.globalAlpha = Math.min(1, (330 - t) / 30);
    cx.globalCompositeOperation = 'destination-in';
    cx.fillRect(0, 0, W, H);
    cx.globalCompositeOperation = 'source-over';
    tile(cx, s.sprNoise, 0.06, (t * 41) % 160, (t * 29) % 160);
  });
}

// --- rmCensorship: the notice (strings 2940-2944), YES/NO with left/right.
async function notice(G, cx, canvas) {
  const [title, details, yesno] = await Promise.all(['fntCensorshipTitle', 'fntCensorshipDetails', 'fntCensorshipYesNo'].map(n => loadFont(G, n)));
  G.audio.playMusic('Detection');
  let sel = options.censor ? 0 : 1;
  const lines = ['This game contains scenes', 'that allude to sexual violence.', '', 'Would you like to skip those scenes?'];
  return loop(canvas, (t, ev) => {
    for (const e of ev) {
      if (e.k === 'left' || e.k === 'right') { sel = 1 - sel; G.audio.play?.('sndMenuMove'); }
      if (e.k === 'move' || e.k === 'click') { if (e.y > 190 && e.y < 230) sel = e.x < W / 2 ? 0 : 1; }
      if (e.k === 'ok' || (e.k === 'click' && e.y > 190 && e.y < 230)) {
        options.censor = sel === 0;
        options.save();
        return true;
      }
    }
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H);
    drawText(cx, title, 'NOTICE', W / 2, 24, { align: 0.5, colour: '#fff' });
    lines.forEach((l, i) => drawText(cx, details, l, W / 2, 100 + i * 16, { align: 0.5, colour: '#ccc' }));
    ['YES', 'NO'].forEach((l, i) => {
      const on = i === sel, x = W / 2 + (i ? 60 : -60);
      drawText(cx, yesno, l, x + (on ? 2 : 0), 196 + (on ? 2 : 0), { align: 0.5, colour: '#000' });
      drawText(cx, yesno, l, x, 196 + (on ? Math.sin(t / 8) * 2 : 0), { align: 0.5, colour: on ? css(merge(C.fuchsia, C.aqua, wave(0.1, t))) : '#555' });
    });
  });
}

// --- rmTitle. Background: the palm and house scene scrolling under the
// four-colour tint of draw 0xc11910; title: the three wobbling layers of
// step 0xc15db0; menu: create 0xc10390's items with up/down and Enter.
async function titleArt(G) {
  const [s, fonts] = await Promise.all([
    sprites(G, ['sprHouses', 'sprPalmTree1', 'sprPalmTree2', 'sprPalmTree3', 'sprPalmTree4', 'sprScanlines', 'sprNoise']),
    Promise.all(['fntTitle', 'fntSubtitle', 'fntMenu', 'fntPreTitle', 'fntMainOption', 'fntSmall'].map(n => loadFont(G, n))),
  ]);
  const scene = new OffscreenCanvas(W, H), sx = scene.getContext('2d');
  sx.imageSmoothingEnabled = false;
  // Scenery that scrolls left, far to near, recycled off the left edge.
  const items = [];
  const add = (x, near) => {
    const palm = near || Math.random() < 0.4;
    const name = palm ? `sprPalmTree${1 + Math.floor(Math.random() * 4)}` : 'sprHouses';
    items.push({ name, x, frame: Math.floor(Math.random() * 16), near, speed: near ? 1.6 : 0.6 });
  };
  for (let x = -40; x < W + 120; x += 70) add(x, false);
  for (let x = 0; x < W + 160; x += 190) add(x, true);
  return { s, fonts, scene, sx, items, add };
}

function drawTitleScene(cx, a, t) {
  const { s, sx, scene, items } = a;
  // The surface: white sky, black scenery (the art is drawn black and the
  // tint below colours the sky).
  sx.globalCompositeOperation = 'source-over';
  sx.fillStyle = '#fff';
  sx.fillRect(0, 0, W, H);
  for (const it of [...items].sort((p, q) => p.near - q.near)) {
    it.x -= it.speed;
    const sp = s[it.name], f = sp?.frames[0];
    if (!f) continue;
    const y = H - f.h - (it.near ? -20 : 22);
    if (it.near) sx.filter = 'brightness(0)';
    else sx.filter = 'brightness(0.25)';
    blit(sx, sp, it.name === 'sprHouses' ? it.frame : t / 8 + it.frame, Math.round(it.x), y);
    sx.filter = 'none';
  }
  // Keep the title recognizable when a WAD lacks the scenery sprites.
  if (!Object.keys(s).some(name => /sprPalm|sprHouses/.test(name))) {
    sx.fillStyle = '#000';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 125 - t * 0.35) % (W + 100) + W + 100) % (W + 100) - 50, y = 75 + i % 2 * 20;
      sx.fillRect(x - 3, y, 6, H - y);
      for (let j = 0; j < 7; j++) {
        const angle = j * Math.PI / 3.5;
        sx.beginPath(); sx.moveTo(x, y); sx.quadraticCurveTo(x + Math.cos(angle) * 48, y + Math.sin(angle) * 15 - 12, x + Math.cos(angle) * 58, y + Math.sin(angle) * 38 + 8); sx.lineTo(x, y + 5); sx.fill();
      }
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], f = s[it.name]?.frames[0];
    if (it.x + (f?.w || 0) < -20) { items.splice(i, 1); a.add(W + 40 + Math.random() * 60, it.near); }
  }
  // draw_surface_general with corner colours v28, v16 (top) and v79, v73
  // (bottom), as a vertical multiply.
  const top = merge(merge(C.lime, C.yellow, wave(0.5, t / 60)), merge(C.lime, C.yellow, wave(0.6, t / 60)), 0.5);
  const bottom = merge(merge(merge(C.teal, C.maroon, wave(0.5, t / 60)), C.black, wave(0.5, t / 60, 45)),
    merge(merge(C.teal, C.maroon, wave(1.2, t / 60)), C.black, wave(0.5, t / 60, 45)), 0.5);
  const g = sx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(merge(top, C.fuchsia, 0.35)));
  g.addColorStop(1, css(bottom));
  sx.globalCompositeOperation = 'multiply';
  sx.fillStyle = g;
  sx.fillRect(0, 0, W, H);
  cx.drawImage(scene, 0, 0);
  tile(cx, s.sprScanlines, 0.25);
  tile(cx, s.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
}

// The two title lines, three layers each: shadow, colour, highlight.
function drawLogo(cx, a, t, y0 = 34) {
  const [fTitle, fSub] = a.fonts, tt = t / 60;
  const layer = (f, s, y, colours, k, wob) => {
    colours.forEach((c, i) => {
      const ang = (3 * Math.sin(0.1 * t / 6 + i * 0.4)) * Math.PI / 180;
      const dx = Math.sin(tt * 2.3 + i * 45) * wob * (2 - i), dy = Math.cos(tt * 2.0 + i * 45) * wob * (2 - i) * 9 / 11;
      cx.save();
      cx.translate(W / 2 + dx, y + dy);
      cx.rotate(ang);
      drawText(cx, f, s, 0, -f.line / 2, { align: 0.5, colour: c });
      cx.restore();
    });
  };
  const neon = merge(merge(C.aqua, C.white, 0.35 * Math.sin(2 * tt) + 0.35), C.teal, wave(1, tt));
  layer(fTitle, 'HOTLINE MIAMI', y0 + 30, ['#2a0030', css(merge(C.fuchsia, C.maroon, wave(1, tt))), '#ffd0f4'], 1, 2);
  layer(fSub, 'W R O N G   N U M B E R', y0 + 76, ['#001018', css(merge(C.teal, C.black, 0.3)), css(neon)], 1, 1);
}

// Menu list: items, selection, chosen with up/down and Enter or the mouse.
function menuList(cx, font, items, sel, t, y0, gap = 24, active = () => true) {
  const boxes = [];
  items.forEach((label, i) => {
    const on = i === sel, y = y0 + i * gap, ok = active(i);
    const wob = on ? Math.sin(t / 10) * 2 : 0;
    const colour = !ok ? '#5a3a5a' : on ? css(merge(C.fuchsia, C.aqua, wave(0.08, t))) : '#fff';
    drawText(cx, font, label, W / 2 + 2, y + 2 + wob, { align: 0.5, colour: '#000', scale: on ? 1.15 : 1 });
    drawText(cx, font, label, W / 2, y + wob, { align: 0.5, colour, scale: on ? 1.15 : 1 });
    const w = textWidth(font, label);
    boxes.push({ x0: W / 2 - w / 2 - 8, x1: W / 2 + w / 2 + 8, y0: y - 2, y1: y + gap - 2 });
  });
  return boxes;
}
function pick(ev, sel, n, boxes, active = () => true) {
  for (const e of ev) {
    if (e.k === 'up' || e.k === 'down') {
      // The next open item that way, wrapping; locked ones are passed over.
      for (let k = 1; k < n; k++) {
        const s = (sel + (e.k === 'up' ? n - k : k)) % n;
        if (active(s)) { sel = s; break; }
      }
    }
    if (e.k === 'move' || e.k === 'click') {
      const i = boxes.findIndex(b => e.x >= b.x0 && e.x <= b.x1 && e.y >= b.y0 && e.y <= b.y1);
      if (i >= 0 && active(i)) { sel = i; if (e.k === 'click') return { sel, chose: true }; }
    }
    if (e.k === 'ok' && active(sel)) return { sel, chose: true };
    if (e.k === 'back') return { sel, back: true };
  }
  return { sel };
}

// The title menu. Resolves with { action, scene }.
async function title(G, cx, canvas, a, openSettings) {
  G.audio.playMusic('beams');
  const [, , font, pre] = a.fonts;
  let sel = 0, screen = 'main', osel = 0;
  return loop(canvas, (t, ev) => {
    drawTitleScene(cx, a, t);
    if (screen === 'main') {
      drawLogo(cx, a, t);
      const items = ['NEW GAME', 'CONTINUE', 'OPTIONS', 'LEVEL VIEWER'];
      const boxes = menuList(cx, font, items, sel, t, 140);
      const r = pick(ev, sel, items.length, boxes);
      sel = r.sel;
      if (r.chose) {
        // Both open the act carousel of rmLevelSelect: NEW GAME on the
        // pilot, CONTINUE on the furthest act reached.
        if (sel === 0 || sel === 1) {
          const at = sel ? ACTS.findLastIndex(a => a.scenes[0] <= progress.get()) : 0;
          return chapters(G, cx, canvas, at).then(r => r.action === 'back' ? title(G, cx, canvas, a, openSettings) : r);
        }
        if (sel === 2) openSettings ? openSettings() : screen = 'options';
        if (sel === 3) return { action: 'viewer' };
      }
    } else {
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      cx.fillRect(0, 0, W, H);
      drawText(cx, pre, 'OPTIONS', W / 2, 20, { align: 0.5, colour: '#fff' });
      const items = [`MUSIC: ${options.music ? 'ON' : 'OFF'}`, `SENSITIVE SCENES: ${options.censor ? 'SKIP' : 'SHOW'}`, 'BACK'];
      const boxes = menuList(cx, font, items, osel, t, 80, 30);
      const r = pick(ev, osel, items.length, boxes);
      osel = r.sel;
      if (r.back || (r.chose && osel === 2)) { screen = 'main'; osel = 0; }
      else if (r.chose && osel === 0) { options.music = !options.music; options.save(); G.audio.playMusic('beams'); }
      else if (r.chose && osel === 1) { options.censor = !options.censor; options.save(); }
    }
  });
}

// --- rmLevelSelect (480x200, letterboxed here): objBoxSelector (create
// 0x5103a0, step 0x5220c0, draw 0x517cc0). One screen per act, left/right
// to turn: the act label (the player's own text, 3090 for the pilot and
// 3116 on), the pilot's tape and each act's VHS box built from stacked
// layer frames, the sun and the skyline behind, the act name in front.
// Enter on a box lays its scene covers out (sprActNCoverLayers, five
// layers each). Positions and motion were matched by eye against frames
// of the real game.
const ACTS = [
  { label: 3090, title: 0, scenes: [0], item: 'sprMidnightAnimal' },
  { label: 3116, title: 1, scenes: [1, 2, 3, 4], item: 'sprAct1BoxLayers', covers: 'sprAct1CoverLayers' },
  { label: 3117, title: 5, scenes: [5, 6, 7, 8], item: 'sprAct2BoxLayers', covers: 'sprAct2CoverLayers' },
  { label: 3118, title: 9, scenes: [9, 10, 11, 12], item: 'sprAct3BoxLayers', covers: 'sprAct3CoverLayers' },
  { label: 3119, title: 13, scenes: [13, 14, 15, 16], item: 'sprAct4BoxLayers', covers: 'sprAct4CoverLayers' },
  { label: 3120, title: 17, scenes: [17, 18, 19, 20], item: 'sprAct5BoxLayers', covers: 'sprAct5CoverLayers' },
  { label: 3121, title: 21, scenes: [21, 22, 23, 24, 25, 26], item: 'sprAct6BoxLayers', covers: 'sprAct6CoverLayers' },
];
const ROOM_H = 200, OY = (H - ROOM_H) / 2;
// A layered sprite: frames 0..n-1 drawn bottom to top, each a step up and
// right, the stack turned by angle (degrees) about (x, y).
function stack(cx, s, x, y, angle, { from = 0, n = s?.frames.length || 0, step = 0.75, scale = 1 } = {}) {
  if (!s) return;
  cx.save();
  cx.translate(x, y);
  cx.rotate(-angle * Math.PI / 180);
  for (let i = 0; i < n; i++) {
    const f = s.frames[from + i];
    if (!f) break;
    cx.drawImage(s.img, f.x, f.y, f.w, f.h, (-f.w / 2 + i * step * 0.45) * scale, (-f.h / 2 - i * step) * scale, f.w * scale, f.h * scale);
  }
  cx.restore();
}
// A sprite frame filled with one colour (the exe's image_blend).
const tints = new Map();
function tinted(s, i, colour) {
  if (!s) return null;
  const key = s.img, f = s.frames[i % s.frames.length], id = `${f.x},${f.y},${colour}`;
  let m = tints.get(key);
  if (!m) tints.set(key, m = new Map());
  if (!m.has(id)) {
    const c = new OffscreenCanvas(f.w, f.h), x = c.getContext('2d');
    x.drawImage(s.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = colour;
    x.fillRect(0, 0, f.w, f.h);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(s.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    m.set(id, c);
  }
  return m.get(id);
}
async function chapters(G, cx, canvas, startAct) {
  const names = ['sprCityScape', 'sprCitySun', 'sprCloudsSmoke', 'sprMusicCassette', 'sprMidnightOpen', 'sprAct1CoverOpen', 'sprAct1VHSTape', 'sprScanlines', 'sprNoise', ...new Set(ACTS.flatMap(a => [a.item, a.covers].filter(Boolean)))];
  const [s, fonts] = await Promise.all([sprites(G, names),
    Promise.all(['fntVHSTitle', 'fntVHSSubtitle', 'fntVHSStats', 'fntVHSGrading', 'fntVHSMusic'].map(n => loadFont(G, n)))]);
  const [fTitle, fLabel, fStats, fGrading, fMusic] = fonts;
  const reached = i => i <= progress.get();
  const open = i => reached(ACTS[i].scenes[0]);
  const text = (id, or) => G.text?.[id] || or;
  // ask: on a scene already cleared, the open tape asks to skip the intro
  // (0 yes, 1 no, -1 not asking).
  // view: the carousel position; pick: -1 browsing acts, else the scene
  // shown (Enter); pull: 0..1 how far the box has moved aside for it.
  let act = Math.max(0, Math.min(startAct, ACTS.length - 1)), view = act, slide = 0, pick = -1, pull = 0, picked = 0, ask = -1, asked = 0;
  return loop(canvas, (t, ev) => {
    const tt = t / 60, a = ACTS[act], list = a.scenes.filter(reached);
    for (const e of ev) {
      const turn = e.k === 'left' || e.k === 'up' ? -1 : e.k === 'right' || e.k === 'down' ? 1 : e.k === 'click' && (e.x < 120 || e.x > 360) ? (e.x < 240 ? -1 : 1) : 0;
      if (ask >= 0) {
        if (turn) { ask ^= 1; G.audio.play?.('sndMenuMove'); }
        else if (e.k === 'ok' || e.k === 'click') { G.audio.play?.('sndMenuSelect'); return { action: 'story', scene: list[pick], skip: ask === 0 }; }
        else if (e.k === 'back') ask = -1;
        continue;
      }
      if (pick < 0) {
        if (turn) {
          // Only reached acts are in the carousel; it wraps.
          let n = act;
          do n = (n + turn + ACTS.length) % ACTS.length; while (!open(n));
          if (n !== act) { slide = turn; act = n; G.audio.play?.('sndMenuMove'); }
        } else if (e.k === 'ok' || e.k === 'click') { pick = 0; picked = t; slide = 0; G.audio.play?.('sndMenuSelect'); }
        else if (e.k === 'back') return { action: 'back' };
      } else {
        if (turn && list.length > 1) { pick = (pick + turn + list.length) % list.length; slide = turn; picked = t; G.audio.play?.('sndMenuMove'); }
        else if (e.k === 'ok' || e.k === 'click') {
          G.audio.play?.('sndMenuSelect');
          if (list[pick] >= progress.get()) return { action: 'story', scene: list[pick] };
          ask = 1; asked = t;
        }
        else if (e.k === 'back') pick = -1;
      }
    }
    view += (act - view) * 0.12;
    slide *= 0.88;
    pull += ((pick >= 0) - pull) * 0.15;
    const pilot = !a.covers, scene = pick >= 0 ? list[pick] : a.title;
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H);
    cx.save();
    cx.beginPath(); cx.rect(0, OY, W, ROOM_H); cx.clip();
    cx.translate(0, OY);
    // Sky: deep red darkening to the right, an orange glow at the top left.
    const sky = cx.createLinearGradient(0, 0, W, 0);
    sky.addColorStop(0, '#f2584a'); sky.addColorStop(0.55, '#d8303f'); sky.addColorStop(1, '#a0142f');
    cx.fillStyle = sky; cx.fillRect(0, 0, W, ROOM_H);
    const glow = cx.createRadialGradient(30, 40, 0, 30, 40, 360);
    glow.addColorStop(0, 'rgba(255,225,150,1)'); glow.addColorStop(0.4, 'rgba(255,150,90,0.7)'); glow.addColorStop(1, 'rgba(255,80,90,0)');
    cx.fillStyle = glow; cx.fillRect(0, 0, W, ROOM_H);
    if (s.sprCloudsSmoke) {
      cx.globalCompositeOperation = 'screen'; cx.globalAlpha = 0.2;
      const f = s.sprCloudsSmoke.frames[0];
      for (let k = 0; k < 2; k++) blit(cx, s.sprCloudsSmoke, k, ((k * 240 - t * 0.15) % (W + f.w) + W + f.w) % (W + f.w) - f.w, -40);
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }
    cx.fillStyle = 'rgba(80,0,30,0.12)';
    for (let y = 0; y < 120; y += 4) cx.fillRect(0, y, W, 2);
    // The sun under the middle, then two skylines scrolling at two speeds.
    const sun = tinted(s.sprCitySun, 0, '#ff4f86');
    if (sun) { cx.save(); cx.shadowColor = '#ff2a6a'; cx.shadowBlur = 14; cx.drawImage(sun, W / 2 - 18, 110, 36, 36); cx.restore(); }
    for (const [frame, colour, y, speed] of [[1, '#c0243f', 96, 0.1], [0, '#9a1030', 106, 0.25]]) {
      const f = s.sprCityScape?.frames[frame];
      if (!f) break;
      const img = tinted(s.sprCityScape, frame, colour), off = (t * speed) % f.w;
      for (let x = -off; x < W; x += f.w) cx.drawImage(img, Math.round(x), y);
    }
    const ground = cx.createLinearGradient(0, 150, 0, ROOM_H);
    ground.addColorStop(0, '#a3123a'); ground.addColorStop(1, '#d4234c');
    cx.fillStyle = ground; cx.fillRect(0, 150, W, ROOM_H - 150);
    cx.fillStyle = 'rgba(60,0,20,0.35)';
    for (let k = 0; k < 7; k++) cx.fillRect(0, 152 + k * k * 1.1, W, 1);
    if (ask >= 0) {
      // The tape case opened in the middle, and Yes / No under it.
      const k = Math.min(1, (t - asked) / 12), y = 92 + (1 - k) * 30;
      stack(cx, pilot ? s.sprMidnightOpen : s.sprAct1CoverOpen, W / 2, y, 0, { step: 0.8, scale: 1.2 });
      stack(cx, s.sprAct1VHSTape, W / 2 + 12, y, 0, { step: 0.8, scale: 1.2 });
      const q = text(3071, 'Skip Intro?'), lc = css(merge([52, 214, 180], [255, 90, 170], wave(1.2, tt)));
      drawText(cx, fLabel, q, W / 2 + 1, 7, { align: 0.5, colour: '#40001a' });
      drawText(cx, fLabel, q, W / 2, 6, { align: 0.5, colour: lc });
      [[3072, 'Yes', -40], [3073, 'No', 46]].forEach(([id, or, dx], n) => {
        const on = n === ask, str = text(id, or), x = W / 2 + dx + (1 - k) * dx * 3, y = 156 - fTitle.line * 0.45;
        for (let d = 4; d > 0; d--) drawText(cx, fTitle, str, x + d * 0.6, y + d, { align: 0.5, colour: on ? (d > 2 ? '#3a0016' : '#ff3d8b') : '#4a0018', scale: 0.9 });
        drawText(cx, fTitle, str, x, y, { align: 0.5, colour: on ? '#3fe0b5' : css(merge([120, 10, 40], [200, 30, 70], wave(3, tt))), scale: 0.9 });
      });
    } else {
    // The carousel. Picking the pilot pulls its tape forward and the rest
    // away; picking an act moves its box left and a scene cover slides out.
    ACTS.forEach((b, i) => {
      if (!open(i)) return;
      let x = W / 2 + (i - view) * 115;
      const bob = Math.sin(tt * 2 + i) * 3, tilt = Math.sin(tt * 1.3 + i) * 4, own = i === act;
      if (!own) x += pull * 400 * Math.sign(i - act);
      else x -= pull * (pilot ? 33 : 63);
      if (x < -70 || x > W + 70) return;
      if (!b.covers) { stack(cx, s[b.item], x, 87 + bob * (1 - pull), -6 + tilt * (1 - pull), { step: 0.9, scale: 1 + (own ? pull * 0.3 : 0) }); return; }
      if (own && pull > 0.02 && pick >= 0) {
        // The scene's cover (five layers per cover), sliding out to the right.
        const k = s[b.covers] ? s[b.covers].frames.length / 5 : 4, j = k - 1 - b.scenes.indexOf(list[pick]), out = Math.min(1, (t - picked) / 18);
        stack(cx, s[b.covers], x + 28 * out * pull, 86, -3, { from: j * 5, n: 5, step: 0.8, scale: 1.1 });
      }
      stack(cx, s[b.item], x, 83 + bob * (1 - pull), 8 + tilt * (1 - pull), { step: 0.75, scale: 1.15 });
    });
    // The label: the act, or the scene once one is shown.
    const lc = css(merge([52, 214, 180], [255, 90, 170], wave(1.2, tt)));
    const label = pick >= 0 && !pilot ? text(3090 + scene, STORY[scene].scene) : text(a.label, a.label === 3090 ? 'Pilot' : 'Act ' + act);
    drawText(cx, fLabel, label, W / 2 + 1, 7, { align: 0.5, colour: '#40001a' });
    drawText(cx, fLabel, label, W / 2, 6, { align: 0.5, colour: lc });
    // The big name: the act's, or the scene's, sliding in on a turn.
    const name = pick >= 0 && !pilot ? STORY[scene].title : STORY[a.title].act?.[1] || STORY[a.title].title;
    const sc = Math.min(1, (W - 40) / Math.max(1, textWidth(fTitle, name)));
    const tx = W / 2 + slide * 300, ty = 156 - fTitle.line * sc / 2;
    for (let d = 6; d > 0; d--) drawText(cx, fTitle, name, tx + d * 0.6, ty + d, { align: 0.5, colour: d > 4 ? '#3a0016' : '#ff3d8b', scale: sc });
    drawText(cx, fTitle, name, tx, ty, { align: 0.5, colour: '#3fe0b5', scale: sc });
    if (pull > 0.5) {
      cx.globalAlpha = Math.min(1, (pull - 0.5) * 2);
      const px = 248, row = (str, y, colour) => {
        drawText(cx, fStats, str, px + 1, y + 1, { colour: '#3a0016' });
        drawText(cx, fStats, str, px, y, { colour });
      };
      if (pilot) {
        // The film's own notes: title, length, rating.
        [2979, 2980, 2981].forEach((id, k) => row(text(id, ''), 52 + k * 20, k === 2 ? '#ff6a3d' : '#ffe9a8'));
      } else {
        const rec = records.get(scene);
        row(`${text(3122, 'HIGHSCORE')}: ${rec?.score ?? 0}`, 52, '#ffe9a8');
        row(`${text(3123, 'BEST TIME')}: ${rec ? clock(rec.steps) : text(3124, 'Unknown')}`, 72, '#ffe9a8');
        row(text(2978, 'LEADERBOARDS'), 92, '#ffe9a8');
        drawText(cx, fGrading, text(3126, 'Grade') + ':', px + 2, 112, { colour: '#0a3a12' });
        drawText(cx, fGrading, text(3126, 'Grade') + ':', px, 110, { colour: css(merge([40, 220, 90], [180, 255, 120], wave(2, tt))) });
      }
      // The scene's track on a cassette at the bottom.
      const raw = STORY[pilot ? 0 : scene].track, track = raw && raw[0].toUpperCase() + raw.slice(1);
      if (track) {
        const w = textWidth(fMusic, track);
        blit(cx, s.sprMusicCassette, scene % 27, W / 2 - w / 2 - 34, 183);
        drawText(cx, fMusic, track, W / 2 - w / 2, 184, { colour: '#f0e0e8' });
      }
      cx.globalAlpha = 1;
    }
    }
    cx.restore();
    tile(cx, s.sprScanlines, 0.12);
    tile(cx, s.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
  });
}

// --- Cards between scenes: the act card (rmPart: "First Act" over the act
// name, with sprSun), the scene card (rmScene: "1ST SCENE" and its title
// over sprPalmTrees), and the prologue's film title (rmIntro). About three
// seconds each, or a key.
export async function card(G, canvas, zoom, s, kind) {
  if (kind === 'film') return film(G, canvas, zoom, s);
  if (kind === 'act') return act(G, canvas, zoom, s);
  const cx = setup(canvas, zoom);
  const [pre, big, film1, film2] = await Promise.all(['fntPartPrefix', 'fntChapter', 'fntFilmTitle1', 'fntFilmTitle2'].map(n => loadFont(G, n)));
  const sp = await sprites(G, ['sprSun', 'sprPalmTrees', 'sprScanlines', 'sprNoise']);
  const len = 200;
  return loop(canvas, (t, ev) => {
    if ((t > 20 && skip(ev)) || t > len) return true;
    const tt = t / 60, fade = Math.min(1, t / 20, (len - t) / 20);
    const g = cx.createLinearGradient(0, 0, 0, H);
    if (kind === 'act') { g.addColorStop(0, '#ff3fa0'); g.addColorStop(0.6, '#ffb347'); g.addColorStop(1, '#30103a'); }
    else if (kind === 'film') { g.addColorStop(0, '#000'); g.addColorStop(1, '#1a0008'); }
    else { g.addColorStop(0, '#1a0830'); g.addColorStop(0.7, '#d0306a'); g.addColorStop(1, '#ffcf5a'); }
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    if (kind === 'act') blit(cx, sp.sprSun, 0, W / 2, H * 0.62, { centre: true });
    if (kind === 'scene') for (let i = 0; i < 9; i++) blit(cx, sp.sprPalmTrees, i, ((i * 64 - t * 0.5) % (W + 64) + W + 64) % (W + 64) - 64, H - 150);
    cx.globalAlpha = fade;
    if (kind === 'film') {
      drawText(cx, film1, s.title.split(' ')[0], W / 2, 50, { align: 0.5, colour: '#d01020', scale: 0.6 });
      drawText(cx, film2, s.title.split(' ').slice(1).join(' '), W / 2, 110, { align: 0.5, colour: '#fff', scale: 0.45 });
    } else {
      const top = kind === 'act' ? s.act[0] : s.scene, main = kind === 'act' ? s.act[1] : s.title;
      drawText(cx, pre, top, W / 2 + 2, 52, { align: 0.5, colour: '#000', scale: 0.7 });
      drawText(cx, pre, top, W / 2, 50, { align: 0.5, colour: '#fff', scale: 0.7 });
      const sc = Math.min(1, (W - 30) / textWidth(big, main));
      for (const [d, c] of [[3, '#000'], [0, css(merge(C.fuchsia, C.yellow, wave(2, tt)))]])
        drawText(cx, big, main, W / 2 + d, 96 + d + Math.sin(tt * 2) * 3, { align: 0.5, colour: c, scale: sc });
    }
    cx.globalAlpha = 1;
    tile(cx, sp.sprScanlines, 0.2);
    tile(cx, sp.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
  });
}

// The act card as the native rmPart draws it (objPartTitle, objFlock): black,
// the act's number in fntPartPrefix over its name in fntPartTitle, each letter
// a pink-to-red ramp over a red extrusion down and to the left, and once the
// words are in, a sun with a dark red glow rising behind them and a few birds.
// Colours and places are measured from the native capture.
async function act(G, canvas, zoom, s) {
  const cx = setup(canvas, zoom);
  const [pre, big] = await Promise.all(['fntPartPrefix', 'fntPartTitle'].map(n => loadFont(G, n)));
  const sp = await sprites(G, ['sprBird', 'sprScanlines', 'sprNoise']);
  const off = new OffscreenCanvas(W, H), o = off.getContext('2d');
  const [top, main] = s.act, sun = [237, 117], len = 300;
  const birds = Array.from({ length: 5 }, (_, i) => [272 + i * 11, 78 + (i % 2) * 6, i * 0.7]);
  // One word, each letter its own vertical ramp; returns the letters' left edges.
  const ramp = (f, str, x, y, ramps) => {
    o.clearRect(0, 0, W, H);
    let at = x;
    [...str].forEach((ch, i) => {
      const g = f.chars?.get(ch.codePointAt(0));
      drawText(o, f, ch, at, y, { colour: '#fff' });
      const w = g ? g.adv : textWidth(f, ch), [a, b] = ramps(i);
      const gr = o.createLinearGradient(0, y + (g?.oy ?? 0), 0, y + f.base);
      gr.addColorStop(0, a); gr.addColorStop(1, b);
      o.globalCompositeOperation = 'source-atop'; o.fillStyle = gr;
      o.fillRect(at - 8, 0, w + 16, H);
      o.globalCompositeOperation = 'source-over';
      at += w;
    });
    cx.drawImage(off, 0, 0);
  };
  return loop(canvas, (t, ev) => {
    if ((t > 20 && skip(ev)) || t > len) return true;
    const fade = Math.min(1, t / 50, (len - t) / 20), rise = Math.max(0, Math.min(1, (t - 70) / 60));
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    if (rise) {
      cx.globalAlpha = rise * fade;
      const glow = cx.createRadialGradient(...sun, 0, ...sun, 110);
      glow.addColorStop(0, 'rgba(120,10,0,0.9)'); glow.addColorStop(0.45, 'rgba(60,0,0,0.6)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = glow; cx.fillRect(0, 0, W, H);
      const disc = cx.createLinearGradient(0, sun[1] - 23, 0, sun[1] + 23);
      disc.addColorStop(0, '#f39a4e'); disc.addColorStop(1, '#c2402a');
      cx.fillStyle = disc; cx.beginPath(); cx.arc(...sun, 23, 0, Math.PI * 2); cx.fill();
      cx.filter = 'brightness(0.12)';
      for (const [x, y, p] of birds) blit(cx, sp.sprBird, t / 8 + p * 3, x + Math.sin(t / 50 + p) * 4, y + Math.cos(t / 40 + p) * 2);
      cx.filter = 'none';
    }
    cx.globalAlpha = fade;
    const pw = textWidth(pre, top), px = Math.round(W / 2 - pw / 2);
    drawText(cx, pre, top, px + 1, 91, { colour: '#000' });
    drawText(cx, pre, top, px + 1, 90, { colour: '#d0182a' });
    ramp(pre, top, px, 89, () => ['#f4e4f6', '#b896c8']);
    const bw = textWidth(big, main), sc = Math.min(1, (W - 40) / bw), bx = Math.round(W / 2 - bw * sc / 2), by = 124;
    for (let i = 6; i >= 1; i--)
      drawText(cx, big, main, bx - i, by + i, { colour: `rgb(${235 - (i - 1) * 35},0,0)`, scale: sc });
    // Each letter drifts between the pink ramp and a paler or bluer one.
    ramp(big, main, bx, by, i => {
      const k = Math.max(0, Math.sin(t / 45 + i * 0.9)) ** 3, m = (a, b) => Math.round(a + (b - a) * k);
      return [`rgb(${m(252, 214)},${m(129, 170)},${m(213, 236)})`, `rgb(${m(238, 150)},${m(29, 40)},${m(46, 120)})`];
    });
    cx.globalAlpha = 1;
    tile(cx, sp.sprScanlines, 0.2);
    tile(cx, sp.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
  });
}

// The prologue's opening (rmIntro, objFilmTitle): the tape goes in with a
// white flash that fades through beige to dark, then the night skyline
// (bgSkyline2 far, bgSkyline1 near with sprHouseLight's outlines), stars and
// sprMidnightMoon, with the film's lines fading in over it. The exe's credit
// lines are not in the wad, so the film's own title stands in for them, in the
// same fonts and colours (white, then red raised). Times are from the native
// capture: about 1.5 s of flash, then the lines.
async function film(G, canvas, zoom, s) {
  const cx = setup(canvas, zoom);
  const [red, white] = await Promise.all(['fntFilmTitle1', 'fntFilmTitle2'].map(n => loadFont(G, n)));
  const sp = await sprites(G, ['Backgrounds/midnightanimal/bgSkyline1', 'Backgrounds/midnightanimal/bgSkyline2', 'sprHouseLight', 'sprMidnightMoon', 'sprStar', 'sprScanlines', 'sprNoise']);
  const near = sp['Backgrounds/midnightanimal/bgSkyline1'], far = sp['Backgrounds/midnightanimal/bgSkyline2'];
  const stars = Array.from({ length: 46 }, (_, i) => [(i * 97.3) % W, (i * 53.7) % 150, i % 6]);
  let moon = null;
  if (sp.sprMidnightMoon) {
    const f = sp.sprMidnightMoon.frames[0];
    moon = new OffscreenCanvas(f.w, f.h);
    const m = moon.getContext('2d'), g = m.createLinearGradient(0, 0, 0, f.h);
    m.drawImage(sp.sprMidnightMoon.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    g.addColorStop(0, '#f0b886'); g.addColorStop(0.55, '#b0607a'); g.addColorStop(1, '#4a1450');
    m.globalCompositeOperation = 'source-atop'; m.fillStyle = g; m.fillRect(0, 0, f.w, f.h);
  }
  const [first, ...rest] = s.title.split(' '), second = rest.join(' ');
  const FLASH = 90, IN = 120, OUT = 420, len = 470;
  return loop(canvas, (t, ev) => {
    if ((t > 20 && skip(ev)) || t > len) return true;
    cx.fillStyle = '#060607'; cx.fillRect(0, 0, W, H);
    for (const [x, y, k] of stars) {
      cx.globalAlpha = 0.35 + 0.35 * Math.sin(t / 40 + x);
      const img = tinted(sp.sprStar, k + Math.floor(t / 12), '#3ab0b0');
      if (img) cx.drawImage(img, Math.round(x), Math.round(y));
    }
    cx.globalAlpha = 1;
    if (moon) { cx.save(); cx.shadowColor = '#c04a9a'; cx.shadowBlur = 10; cx.drawImage(moon, 154, 44, 48, 48); cx.restore(); }
    const fi = tinted(far, 0, '#163034');
    if (fi) cx.drawImage(fi, -80, 90);
    const ni = tinted(near, 0, '#123438');
    if (ni) cx.drawImage(ni, 0, 0);
    const edge = tinted(sp.sprHouseLight, 0, '#7a2468');
    if (edge) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.55; cx.drawImage(edge, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; }
    // The lines: the white word, then the red one a little higher.
    const a = Math.max(0, Math.min(1, (t - IN) / 25, (OUT - t) / 40));
    if (a > 0) {
      const sw = 0.55, sr = 0.45, w1 = textWidth(white, first) * sw, w2 = textWidth(red, second) * sr, x0 = W / 2 - (w1 + 6 + w2) / 2;
      cx.globalAlpha = a;
      drawText(cx, white, first, x0 + 1, 113, { colour: '#3a0010', scale: sw });
      drawText(cx, white, first, x0, 112, { colour: '#f4e8ec', scale: sw });
      drawText(cx, red, second, x0 + w1 + 7, 107, { colour: '#3a0010', scale: sr });
      drawText(cx, red, second, x0 + w1 + 6, 106, { colour: '#ee1020', scale: sr });
      cx.globalAlpha = 1;
    }
    // The tape's flash: white, beige, then dark, over the first second and a half.
    if (t < FLASH) {
      const k = t / FLASH, c = k < 0.35 ? merge([255, 250, 245], [216, 184, 136], k / 0.35) : merge([216, 184, 136], [12, 10, 10], Math.min(1, (k - 0.35) / 0.35));
      cx.fillStyle = css(c); cx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 1;
    }
    tile(cx, sp.sprScanlines, 0.12);
    tile(cx, sp.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
  });
}

// --- objMaskMenu: the Fans pick a mask before their levels. Selection 0..3,
// left/right (A/D) cycles, a click or Enter picks; the masks slide in from
// -700. sprMasksBig frames 0..3 follow the menu order (frame 4 is Ash's).
// Locked masks are skipped in the exe; all four are open here.
export const MASKS = [
  { name: 'COREY', obj: 'objPlayerZebra', frame: 0, note: [3056] },
  { name: 'TONY', obj: 'objPlayerTiger', frame: 1, note: [3054, 3055] },
  { name: 'ALEX & ASH', obj: 'objPlayerSwanChainsaw', frame: 2, note: [3057] },
  { name: 'MARK', obj: 'objPlayerBear', frame: 3, note: [3058] },
];
// objCobraMaskMenu (Jake, Hard News and Withdrawal): create 0x654060 names
// the masks JAKE, IRVIN, DALLAS and their notes from string ids 3051, 3052
// and 3053 + ", " + 3054; sprCobraMasksBig frames 0..2. objSonStyleMenu (the
// Son, Seizure and Take Over): create 0xb94470 takes the names from ids
// 3059..3061 and the notes from 3056, 3054 + ", " + 3055 and 3062;
// sprSonWeapons frames 0..2. Both share the keypress handlers 0x655570 and
// 0x655860 (A/D, selection 0..2 wrapping, skipping locked ones). The pick is
// passed on as '<player object>:<index>' (game.js FANS). Text comes from the
// player's own localization at runtime.
const PICKERS = {
  objMaskMenu: { native: true, sprite: 'sprMasksBig', list: G => MASKS.map(m => ({ ...m, note: noteText(G, m.note) })) },
  objCobraMaskMenu: { title: 'CHOOSE YOUR MASK', sprite: 'sprCobraMasksBig', slot: 110, scale: [1.2, 0.7], list: G => [
    { name: 'JAKE', note: [3051] }, { name: 'IRVIN', note: [3052] }, { name: 'DALLAS', note: [3053, 3054] },
  ].map((m, i) => ({ ...m, obj: 'objPlayerCobra:' + i, frame: i, note: noteText(G, m.note) })) },
  objSonStyleMenu: { title: 'CHOOSE YOUR STYLE', sprite: 'sprSonWeapons', slot: 120, scale: [1.4, 0.8], list: G => [
    { name: 3059, note: [3056] }, { name: 3060, note: [3054, 3055] }, { name: 3061, note: [3062] },
  ].map((m, i) => ({ obj: 'objSon:' + i, frame: i, name: (G.text?.[m.name] || 'STYLE ' + (i + 1)).toUpperCase(), note: noteText(G, m.note) })) },
};
const noteText = (G, ids) => ids.map(id => G.text?.[id] || '').filter(Boolean).join(', ').toUpperCase();
export const PICKER_OBJECTS = Object.keys(PICKERS);
const lastPick = {};
export async function maskMenu(G, canvas, zoom, kind = 'objMaskMenu', backdrop = null) {
  const k = PICKERS[kind] || PICKERS.objMaskMenu, list = k.list(G);
  if (k.native) return fansMenu(G, canvas, zoom, kind, list, backdrop);
  const cx = setup(canvas, zoom);
  const [big, small] = await Promise.all(['fntChapter', 'fntScoreSmall'].map(n => loadFont(G, n)));
  const sp = await sprites(G, [k.sprite, 'sprScanlines', 'sprNoise']);
  let sel = lastPick[kind] || 0, slide = -700;
  const n = list.length, slot = k.slot;
  return loop(canvas, (t, ev) => {
    for (const e of ev) {
      if (e.k === 'left' || e.k === 'up') sel = (sel + n - 1) % n;
      if (e.k === 'right' || e.k === 'down') sel = (sel + 1) % n;
      if (e.k === 'click' && t > 10) {
        // A click on a side mask turns to it; on the middle one, picks it.
        const i = Math.round((e.x - W / 2) / slot);
        if (i) { sel = (sel + n + Math.sign(i)) % n; continue; }
      }
      if ((e.k === 'ok' || e.k === 'click') && t > 10) { lastPick[kind] = sel; return list[sel].obj; }
      if (e.k === 'back') return null;
    }
    slide = Math.min(0, slide + Math.max(4, -slide * 0.15));
    const tt = t / 60;
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12051f'); g.addColorStop(1, css(merge([60, 0, 50], [140, 20, 60], wave(1, tt))));
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    drawText(cx, small, k.title, W / 2, 16, { align: 0.5, colour: '#fff' });
    const side = n > 3 ? 2 : 1;
    for (let d = -side; d <= side; d++) {
      const m = list[(sel + d + n * 2) % n], x = W / 2 + d * slot + slide;
      cx.globalAlpha = d ? 0.35 : 1;
      blit(cx, sp[k.sprite], m.frame, x, H / 2 - 22 + (d ? 0 : Math.sin(tt * 3) * 3), { centre: true, scale: k.scale[d ? 1 : 0] });
    }
    cx.globalAlpha = 1;
    const m = list[sel];
    const sc = Math.min(0.55, (W - 30) / textWidth(big, m.name));
    for (const [d, c] of [[3, '#000'], [0, css(merge(C.fuchsia, C.yellow, wave(2, tt)))]])
      drawText(cx, big, m.name, W / 2 + d, H - 92 + d, { align: 0.5, colour: c, scale: sc });
    drawText(cx, small, m.note, W / 2, H - 28, { align: 0.5, colour: '#c8b8ff', scale: Math.min(0.8, (W - 20) / Math.max(1, textWidth(small, m.note))) });
    tile(cx, sp.sprScanlines, 0.2);
    tile(cx, sp.sprNoise, 0.05, (t * 37) % 160, (t * 53) % 160);
  });
}

// The Fans' picker as the exe draws it over the level (measured on the
// native 480x270 view, here 7px higher for the 256 rows): the room around
// the car up top, a striped band across y 95..158 whose red rows fade out to
// the right under a pulsing green line, a dark glow below cycling purple to
// teal, the picked mask tilted and wobbling at (240,133) with the others to
// its right, and the van's roof (sprFansVan, origin 70,30) at (240,211) as
// the name plate: the name in fntMaskName, cyan over a magenta step, and the
// note from the player's localization in magenta under it.
const BAND = { top: 95, rows: 8, count: 8, red: [76, 76, 76, 89, 110, 131] };
async function fansMenu(G, canvas, zoom, kind, list, backdrop) {
  const cx = setup(canvas, zoom);
  const font = await loadFont(G, 'fntMaskName');
  const sp = await sprites(G, ['sprMasksBig', 'sprFansVan']);
  let sel = lastPick[kind] || 0, slide = -700;
  const n = list.length;
  const mask = (m, x, y, angle, scale) => {
    const s = sp.sprMasksBig;
    if (!s) return;
    const f = s.frames[m.frame % s.frames.length];
    cx.save();
    cx.translate(x, y);
    cx.rotate(-angle * Math.PI / 180);
    cx.scale(scale, scale);
    cx.drawImage(s.img, f.x, f.y, f.w, f.h, -59, -65, f.w, f.h);
    cx.restore();
  };
  return loop(canvas, (t, ev) => {
    for (const e of ev) {
      if (e.k === 'left' || e.k === 'up') sel = (sel + n - 1) % n;
      if (e.k === 'right' || e.k === 'down') sel = (sel + 1) % n;
      if ((e.k === 'ok' || e.k === 'click') && t > 10) { lastPick[kind] = sel; return list[sel].obj; }
      if (e.k === 'back') return null;
    }
    slide = Math.min(0, slide + Math.max(4, -slide * 0.15));
    const tt = t / 60;
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H);
    backdrop?.(cx);
    // The exe shows the room at about half its brightness.
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(0, 0, W, BAND.top);
    // The dark glow below the band.
    const bottom = BAND.top + BAND.rows * BAND.count;
    const hue = merge([100, 8, 108], [8, 128, 140], wave(0.6, tt));
    const g = cx.createRadialGradient(W / 2, bottom + 40, 10, W / 2, bottom + 40, 300);
    g.addColorStop(0, css(hue.map(v => v * 0.4)));
    g.addColorStop(1, css(hue.map(v => v * 0.02)));
    cx.fillStyle = g;
    cx.fillRect(0, bottom, W, H - bottom);
    // The band: two black rows, then the red ramp with the coloured line in it.
    const line = css(merge([0, 30, 0], [0, 120, 0], wave(2, tt)));
    for (let r = 0; r < BAND.count; r++) {
      const y = BAND.top + r * BAND.rows;
      cx.fillStyle = '#000';
      cx.fillRect(0, y, W, BAND.rows);
      BAND.red.forEach((red, i) => {
        const fade = cx.createLinearGradient(0, 0, 300, 0);
        fade.addColorStop(0, `rgb(${red},0,${Math.round(red * 0.3 * wave(0.6, tt))})`);
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = fade;
        cx.fillRect(0, y + 2 + i, W, 1);
      });
      cx.globalCompositeOperation = 'lighter';
      cx.fillStyle = line;
      cx.fillRect(0, y + 3, W, 2);
      cx.globalCompositeOperation = 'source-over';
    }
    // The masks: the next ones wait to the right of the picked one.
    for (let d = Math.min(2, n - 1); d >= 1; d--)
      mask(list[(sel + d) % n], 240 + d * 85 + slide, 133, 0, 1.1);
    mask(list[sel], 240 + slide, 133 + Math.sin(tt * 3) * 2, -20 + Math.sin(tt * 2) * 4, 1.35);
    // The van roof with the name and the note on it.
    const van = sp.sprFansVan;
    if (van) { const f = van.frames[0]; cx.drawImage(van.img, f.x, f.y, f.w, f.h, 240 - 70, 211 - 30, f.w, f.h); }
    const m = list[sel];
    const sc = Math.min(0.62, 110 / Math.max(1, textWidth(font, m.name)));
    for (const [d, c] of [[2, '#ff1fd2'], [1, '#ff1fd2'], [0, '#29f8ff']])
      drawText(cx, font, m.name, 240 - d, 196 + d, { align: 0.5, colour: c, scale: sc });
    if (m.note) drawText(cx, font, m.note, 240, 224, { align: 0.5, colour: '#ff5cf4', scale: Math.min(0.48, 116 / Math.max(1, textWidth(font, m.note))) });
  });
}

// The whole front end: logos, splash, notice (first visit of the page
// only), then the title. Resolves with what the title chose.
let booted = false;
export async function frontEnd(G, canvas, zoom, openSettings) {
  const cx = setup(canvas, zoom), mine = epoch, gone = () => mine !== epoch;
  if (!booted) {
    booted = true;
    for (const screen of [logos, dennaton, notice]) {
      await screen(G, cx, canvas);
      if (gone()) return { action: 'aborted' };
    }
  }
  const a = await titleArt(G);
  return gone() ? { action: 'aborted' } : title(G, cx, canvas, a, openSettings);
}
