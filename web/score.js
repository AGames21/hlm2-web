// Level-end screen: "LEVEL CLEARED" and the level's tally, drawn with the
// game's own bitmap fonts (BMFont XML + page PNG under Fonts/ in the wad).
// objScoreScreen (create 0xb5f5e0, step 0xb68880, draw 0xb61940) is too big
// to port yet. Its level score is the sum of globals 0x1470, 0x1790, 0x10a0,
// 0x1780, 0x1770, 0x16b0 and the kill points 0xd90; only the kill points are
// counted here, so LEVEL SCORE is the kill points alone for now.

const fonts = new WeakMap();

// Fonts/<name>.fnt -> { chars, line, base, pages: [ImageBitmap] }
export async function loadFont(G, name) {
  let cache = fonts.get(G.wad);
  if (!cache) { cache = new Map(); fonts.set(G.wad, cache); }
  if (cache.has(name)) return cache.get(name);
  const pending = readFont(G, name).catch(error => {
    console.warn('Using fallback font:', name, error.message);
    const size = /Title$/.test(name) ? 36 : /Small|Subtitle/.test(name) ? 12 : /Chapter|LevelClear|Film/.test(name) ? 30 : 18;
    const measure = new OffscreenCanvas(1, 1).getContext('2d');
    measure.font = `bold ${size}px monospace`;
    return { fallback: true, size, line: size * 1.2, base: size, measure };
  });
  cache.set(name, pending);
  return pending;
}

async function readFont(G, name) {
  const xml = new DOMParser().parseFromString(await G.wad.slice(`Fonts/${name}.fnt`).text(), 'text/xml');
  const common = xml.querySelector('common');
  if (!common || xml.querySelector('parsererror')) throw new Error('Unsupported bitmap font format');
  const pages = await Promise.all([...xml.querySelectorAll('page')]
    .map(pg => createImageBitmap(G.wad.slice('Fonts/' + pg.getAttribute('file')))));
  const chars = new Map();
  for (const c of xml.querySelectorAll('char')) {
    const n = k => +c.getAttribute(k);
    chars.set(n('id'), { x: n('x'), y: n('y'), w: n('width'), h: n('height'), ox: n('xoffset'), oy: n('yoffset'), adv: n('xadvance'), page: n('page') });
  }
  if (!chars.size || !pages.length) throw new Error('Bitmap font has no glyphs or image pages');
  const f = { chars, line: +common.getAttribute('lineHeight'), base: +common.getAttribute('base'), pages, tints: new Map() };
  return f;
}

// The page tinted to one colour, made once. The pages are white glyphs on
// opaque black, so the brightness becomes the alpha first.
function tinted(f, page, colour) {
  const key = page + colour;
  if (!f.tints.has(key)) {
    const img = f.pages[page], c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i];
    x.putImageData(d, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = colour;
    x.fillRect(0, 0, img.width, img.height);
    f.tints.set(key, c);
  }
  return f.tints.get(key);
}

export function textWidth(f, s) {
  if (f.fallback) return f.measure.measureText(s).width;
  let w = 0;
  for (const ch of s) w += f.chars.get(ch.codePointAt(0))?.adv ?? 0;
  return w;
}

// align: 0 left, 0.5 centre, 1 right. y is the top of the line.
export function drawText(cx, f, s, x, y, { align = 0, colour = '#fff', scale = 1 } = {}) {
  if (f.fallback) {
    cx.save();
    cx.font = `bold ${f.size * scale}px monospace`;
    cx.fillStyle = colour; cx.textBaseline = 'top';
    cx.fillText(s, x - textWidth(f, s) * scale * align, y);
    cx.restore(); return;
  }
  let at = x - textWidth(f, s) * scale * align;
  for (const ch of s) {
    const g = f.chars.get(ch.codePointAt(0));
    if (!g) continue;
    if (g.w > 0 && g.h > 0) cx.drawImage(tinted(f, g.page, colour), g.x, g.y, g.w, g.h,
      Math.round(at + g.ox * scale), Math.round(y + g.oy * scale), g.w * scale, g.h * scale);
    at += g.adv * scale;
  }
}

// Three of the score screen's labels in hlm2_localization.bin.
const LABEL = { kills: 'KILLS', time: 'TIME', score: 'LEVEL SCORE' };
const COLOURS = ['#ff2ad4', '#2af6ff', '#ffe02a'];

const clock = steps => {
  const s = Math.floor(steps / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Shows the screen on canvas until a click or key; resolves then.
export async function scoreScreen(G, canvas, level, stats, { signal, paused = () => false } = {}) {
  const [title, big, small] = await Promise.all(['fntLevelClear', 'fntScore', 'fntScoreSmall'].map(n => loadFont(G, n)));
  if (signal?.aborted) return false;
  const cx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const rows = [[LABEL.kills, String(stats.kills)], [LABEL.time, clock(stats.steps)], [LABEL.score, (stats.score ?? 0) + 'pts']];
  let t = 0, done = false, resolve, timer;
  const draw = () => {
    if (done) return;
    if (paused()) { timer = setTimeout(draw, 1000 / 60); return; }
    t++;
    cx.save();
    cx.fillStyle = '#0c0418';
    cx.fillRect(0, 0, W, H);
    // A slow colour wash behind the title, in the score screen's palette.
    const g = cx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${(t * 0.6) % 360}, 70%, 18%)`);
    g.addColorStop(1, `hsl(${(t * 0.6 + 120) % 360}, 70%, 10%)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    const bob = Math.sin(t / 20) * 3;
    drawText(cx, title, 'LEVEL CLEARED', W / 2 + 3, 26 + bob + 3, { align: 0.5, colour: '#000' });
    drawText(cx, title, 'LEVEL CLEARED', W / 2, 26 + bob, { align: 0.5, colour: COLOURS[Math.floor(t / 8) % COLOURS.length] });
    drawText(cx, small, level, W / 2, 84, { align: 0.5, colour: '#c8b8ff' });
    rows.forEach(([k, v], i) => {
      const y = 120 + i * 30, shown = Math.min(1, Math.max(0, (t - 20 - i * 20) / 10));
      if (!shown) return;
      cx.globalAlpha = shown;
      drawText(cx, big, k, W / 2 - 110, y, { colour: '#fff' });
      drawText(cx, big, v, W / 2 + 110, y, { align: 1, colour: COLOURS[i % COLOURS.length] });
      cx.globalAlpha = 1;
    });
    if (t > 60 && Math.floor(t / 30) % 2) drawText(cx, small, 'CLICK TO CONTINUE', W / 2, H - 30, { align: 0.5, colour: '#fff' });
    cx.restore();
    timer = setTimeout(draw, 1000 / 60);
  };
  const finish = continued => {
    if (done) return;
    done = true; clearTimeout(timer);
    removeEventListener('keydown', go);
    canvas.removeEventListener('mousedown', go);
    signal?.removeEventListener('abort', cancel);
    resolve(continued);
  };
  const cancel = () => finish(false);
  const go = (e) => {
    if (paused() || t < 30 || (e.type === 'keydown' && (e.repeat || e.target.closest?.('input, select, textarea, button') || e.target.isContentEditable))) return;
    finish(true);
  };
  const shown = new Promise(r => { resolve = r; });
  addEventListener('keydown', go);
  canvas.addEventListener('mousedown', go);
  signal?.addEventListener('abort', cancel, { once: true });
  draw();
  return shown;
}
