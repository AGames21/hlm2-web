// Cutscene talk (the dialogue dispatcher 0xf3e3e0 and objConversation,
// object 37). Pages come from conversations.js: a portrait sprite and string
// ids, two ids per box (top and bottom row). The text is read at runtime from
// the player's own Assets/hlm2_localization.bin (G.text); no game text lives
// in this repo.
//
// From the exe (objConversation create 0x658840, step 0x659310, user event
// 53 0x658c70): the shown character count grows by a fixed step each frame
// until the box is out; a press while typing shows the whole box, a press
// after that moves to the next box. The last press ends the talk. The black
// bars slide in over the room while it is held still.

import { drawText, textWidth } from './score.js';

export const TALK = { typeSpeed: 1, bar: 68, top: 44, slide: 6, margin: 8, line: 18, font: 'bold 11px monospace',
  faceSpeed: 0.2, reach: 64, startDelay: 30,
  // Measured on the native talk screen (480x270): fntConversation text in
  // light cyan with a purple drop shadow, a 1px white rule under the top bar and
  // over the bottom one, and a slanted panel behind the portrait whose colour
  // swings teal to magenta and darkens downwards.
  fontName: 'fntConversation', textX: 25, textY: 211, colour: 'rgb(186,255,255)', shadow: 'rgb(136,59,195)', shadowAt: [1, 2],
  panel: { x0: 310, x1: 352, period: 160, hi: 209, b: 210, dark: 0.31 }, faceRight: -47, faceTop: 41, faceScale: 2,
  // GUESS: how long right mouse is held before the talk is skipped.
  skip: { text: 2975, font: 'fntKeyDescription', x: 28, y: 33, colour: 'rgb(124,124,124)', hold: 60 } };

// pages: [[portrait, [id, id, ...]]]. drawFace(cx, name, frame, x, y, h) draws
// the portrait (h 0 draws it at its own size, right-aligned on x). fonts holds
// the loaded bitmap fonts { text, skip }; without them a canvas font stands in.
// Returns a cutscene for env.cutscene, or null when none of the ids has text.
export function conversation(G, pages, { drawFace, onEnd, fonts = {} } = {}) {
  const t = id => (id >= 0 && G.text?.[id]) || '';
  const boxes = [];
  for (const [face, ids] of pages) {
    for (let j = 0; j < ids.length; j += 2) {
      // An unused bottom row holds an empty string; native still shows a "..." filler.
      const rows = [t(ids[j]), t(ids[j + 1])].filter(Boolean);
      if (rows.length) boxes.push({ face, rows, len: rows.reduce((n, r) => n + r.length, 0) });
    }
  }
  if (!boxes.length) return null;
  let i = 0, shown = 0, done = false, bars = 0, closing = false, faceFrame = 0, clock = 0, held = 0;
  // The game only passes movement keys and Space through; Enter skips the scene.
  const press = s => s.pressed.has(' ') || s.mouse.click;
  const text = fonts.text, skipText = t(TALK.skip.text);
  const width = r => text ? textWidth(text, r) : r.length * 7;
  const put = (cx, r, x, y, colour) => {
    if (text) return drawText(cx, text, r, x, y, { colour });
    cx.font = TALK.font; cx.textBaseline = 'top'; cx.fillStyle = colour; cx.fillText(r, x, y + 4);
  };
  return {
    get done() { return done; },
    get index() { return i; },
    get face() { return boxes[Math.min(i, boxes.length - 1)].face; },
    count: boxes.length,
    step(s) {
      if (done) return false;
      clock++;
      if (closing) {
        bars = Math.max(0, bars - TALK.slide);
        if (!bars) { done = true; onEnd?.(); }
        return !done;
      }
      if (bars < TALK.bar) { bars = Math.min(TALK.bar, bars + TALK.slide); return true; }
      held = s.mouse.rightHeld ? held + 1 : 0;
      if (held >= TALK.skip.hold) { closing = true; return true; }
      const cur = boxes[i];
      // native keeps the portrait animating after the box is fully typed
      faceFrame += TALK.faceSpeed;
      if (shown < cur.len) shown = Math.min(cur.len, shown + TALK.typeSpeed);
      if (press(s)) {
        if (shown < cur.len) shown = cur.len;
        else if (++i < boxes.length) shown = 0;
        else closing = true;
      }
      return true;
    },
    draw(cx, W, H) {
      if (done) return;
      const top = Math.round(bars / TALK.bar * TALK.top), bottom = H - bars;
      cx.save();
      cx.fillStyle = '#000';
      cx.fillRect(0, 0, W, top);
      cx.fillRect(0, bottom, W, bars);
      if (bars === TALK.bar && !closing) {
        const cur = boxes[i], P = TALK.panel;
        cx.fillStyle = '#fff';
        cx.fillRect(0, top, W, 1);
        cx.fillRect(0, bottom - 1, W, 1);
        if (cur.face && drawFace) {
          const k = (1 - Math.cos(clock * 2 * Math.PI / P.period)) / 2;
          const c = (m) => `rgb(${Math.round(P.hi * k * m)},${Math.round(P.hi * (1 - k) * m)},${Math.round(P.b * m)})`;
          const g = cx.createLinearGradient(0, top + 1, 0, bottom - 1);
          g.addColorStop(0, c(1)); g.addColorStop(1, c(P.dark));
          cx.beginPath();
          cx.moveTo(P.x0, top + 1); cx.lineTo(W, top + 1); cx.lineTo(W, bottom - 1); cx.lineTo(P.x1, bottom - 1); cx.closePath();
          cx.fillStyle = g; cx.fill();
          cx.strokeStyle = '#fff'; cx.lineWidth = 1;
          cx.beginPath(); cx.moveTo(P.x0 + 0.5, top + 1); cx.lineTo(P.x1 + 0.5, bottom - 1); cx.stroke();
          cx.save();
          cx.beginPath();
          cx.moveTo(P.x0, top + 1); cx.lineTo(W, top + 1); cx.lineTo(W, bottom - 1); cx.lineTo(P.x1, bottom - 1); cx.closePath();
          cx.clip();
          drawFace(cx, cur.face, faceFrame, W - TALK.faceRight, TALK.faceTop, 0);
          cx.restore();
        }
        if (skipText && fonts.skip) drawText(cx, fonts.skip, skipText, TALK.skip.x, TALK.skip.y, { colour: TALK.skip.colour });
        let left = Math.floor(shown), y = TALK.textY;
        for (const row of cur.rows) {
          const part = row.slice(0, Math.max(0, left));
          left -= row.length;
          for (const r of wrap(width, part, W - TALK.textX - TALK.margin)) {
            put(cx, r, TALK.textX + TALK.shadowAt[0], y + TALK.shadowAt[1], TALK.shadow);
            put(cx, r, TALK.textX, y, TALK.colour);
            y += TALK.line;
          }
        }
      }
      cx.restore();
    },
  };
}

function wrap(measure, text, width) {
  const out = [];
  for (const para of text.split('\n')) {
    let row = '';
    for (const word of para.split(' ')) {
      const t = row ? row + ' ' + word : word;
      if (row && measure(t) > width) { out.push(row); row = word; } else row = t;
    }
    if (row) out.push(row);
  }
  return out;
}
