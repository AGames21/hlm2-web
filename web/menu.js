// Front end: the boot logos, the content notice, the title screen, the scene
// list and the act/scene cards, drawn with the game's own sprites and fonts.
// Sources: objDevolverAbstraction (rmDevolver), objSplash (rmDennaton),
// objCensorship (rmCensorship), objTitleScreen (rmTitle: create 0xc10390,
// draw 0xc11910, step 0xc15db0) and the scene setter 0x11c5bf0. The wave and
// colour formulas are the decoded ones; positions the decode did not pin down
// are placed by eye and say so.
import { loadFont, drawText, textWidth } from './score.js';
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
  const [, , font, pre, option, small] = a.fonts;
  let sel = 0, screen = 'main', ssel = Math.min(progress.get(), STORY.length - 1), osel = 0, scroll = 0;
  return loop(canvas, (t, ev) => {
    drawTitleScene(cx, a, t);
    if (screen === 'main') {
      drawLogo(cx, a, t);
      const items = ['NEW GAME', 'CONTINUE', 'OPTIONS', 'LEVEL VIEWER'];
      const boxes = menuList(cx, font, items, sel, t, 140);
      const r = pick(ev, sel, items.length, boxes);
      sel = r.sel;
      if (r.chose) {
        if (sel === 0) return { action: 'story', scene: 0 };
        if (sel === 1) screen = 'scenes';
        if (sel === 2) openSettings ? openSettings() : screen = 'options';
        if (sel === 3) return { action: 'viewer' };
      }
    } else if (screen === 'scenes') {
      // CONTINUE: every scene reached so far, act headers between.
      const open = i => i <= progress.get();
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      cx.fillRect(0, 0, W, H);
      drawText(cx, pre, 'SELECT A SCENE', W / 2, 8, { align: 0.5, colour: '#fff' });
      const rows = 8, gap = 22, first = Math.max(0, Math.min(ssel - 3, STORY.length - rows));
      scroll += (first - scroll) * 0.3;
      cx.save();
      cx.beginPath();
      cx.rect(0, 34, W, rows * gap);
      cx.clip();
      const boxes = [];
      STORY.forEach((s, i) => {
        const y = 36 + (i - scroll) * gap, on = i === ssel;
        const colour = !open(i) ? '#5a3a5a' : on ? css(merge(C.fuchsia, C.aqua, wave(0.08, t))) : '#fff';
        const dy = on ? Math.sin(t / 10) * 2 : 0;
        if (s.act) drawText(cx, small, s.act[1], 16, y + 5, { colour: '#ff7ad9' });
        for (const [d, c] of [[2, '#000'], [0, colour]]) {
          drawText(cx, option, s.scene, 236 + d, y + d + dy, { align: 1, colour: c });
          drawText(cx, option, open(i) ? s.title : '???', 252 + d, y + d + dy, { colour: c });
        }
        boxes[i] = { x0: 90, x1: W - 20, y0: y, y1: y + gap };
      });
      cx.restore();
      drawText(cx, pre, 'ENTER: PLAY    ESC: BACK', W / 2, H - 22, { align: 0.5, colour: '#ccc' });
      const r = pick(ev, ssel, STORY.length, boxes, open);
      ssel = r.sel;
      if (r.back) screen = 'main';
      if (r.chose) return { action: 'story', scene: ssel };
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

// --- Cards between scenes: the act card (rmPart: "First Act" over the act
// name, with sprSun), the scene card (rmScene: "1ST SCENE" and its title
// over sprPalmTrees), and the prologue's film title (rmIntro). About three
// seconds each, or a key.
export async function card(G, canvas, zoom, s, kind) {
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

// --- objMaskMenu: the Fans pick a mask before their levels. Selection 0..3,
// left/right (A/D) cycles, a click or Enter picks; the masks slide in from
// -700. sprMasksBig frames 0..3 follow the menu order (frame 4 is Ash's).
// Locked masks are skipped in the exe; all four are open here.
export const MASKS = [
  { name: 'COREY', obj: 'objPlayerZebra', frame: 0, note: 'ROLL (SPACE)' },
  { name: 'TONY', obj: 'objPlayerTiger', frame: 1, note: 'LETHAL FISTS, NO WEAPONS' },
  { name: 'ALEX & ASH', obj: 'objPlayerSwanChainsaw', frame: 2, note: 'CHAINSAW' },
  { name: 'MARK', obj: 'objPlayerBear', frame: 3, note: 'DUAL MP5S, RIGHT CLICK SPREADS' },
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
  objMaskMenu: { title: 'CHOOSE YOUR MASK', sprite: 'sprMasksBig', slot: 130, scale: [0.9, 0.55], list: () => MASKS },
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
export async function maskMenu(G, canvas, zoom, kind = 'objMaskMenu') {
  const k = PICKERS[kind] || PICKERS.objMaskMenu, list = k.list(G);
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
