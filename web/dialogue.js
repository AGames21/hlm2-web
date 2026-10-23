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

export const TALK = { typeSpeed: 1, bar: 64, slide: 6, margin: 8, line: 14, font: 'bold 11px monospace',
  faceSpeed: 0.2, reach: 64, startDelay: 30 };

// pages: [[portrait, [id, id, ...]]]. drawFace(cx, name, frame, x, y, h) draws
// the portrait. Returns a cutscene for env.cutscene, or null when none of the
// ids has text.
export function conversation(G, pages, { drawFace, onEnd } = {}) {
  const t = id => (id >= 0 && G.text?.[id]) || '';
  const boxes = [];
  for (const [face, ids] of pages) {
    for (let j = 0; j < ids.length; j += 2) {
      // An unused bottom row holds an empty string or the "..." filler.
      const top = t(ids[j]), bottom = t(ids[j + 1]);
      const rows = [top, top && bottom === '...' ? '' : bottom].filter(Boolean);
      if (rows.length) boxes.push({ face, rows, len: rows.reduce((n, r) => n + r.length, 0) });
    }
  }
  if (!boxes.length) return null;
  let i = 0, shown = 0, done = false, bars = 0, closing = false, faceFrame = 0;
  // The game only passes movement keys and Space through; Enter skips the scene.
  const press = s => s.pressed.has(' ') || s.mouse.click;
  return {
    get done() { return done; },
    get index() { return i; },
    count: boxes.length,
    step(s) {
      if (done) return false;
      if (closing) {
        bars = Math.max(0, bars - TALK.slide);
        if (!bars) { done = true; onEnd?.(); }
        return !done;
      }
      if (bars < TALK.bar) { bars = Math.min(TALK.bar, bars + TALK.slide); return true; }
      const cur = boxes[i];
      if (shown < cur.len) { shown = Math.min(cur.len, shown + TALK.typeSpeed); faceFrame += TALK.faceSpeed; }
      if (press(s)) {
        if (shown < cur.len) shown = cur.len;
        else if (++i < boxes.length) shown = 0;
        else closing = true;
      }
      return true;
    },
    draw(cx, W, H) {
      if (done) return;
      cx.save();
      cx.fillStyle = '#000';
      cx.fillRect(0, 0, W, bars / 2);
      cx.fillRect(0, H - bars, W, bars);
      if (bars === TALK.bar && !closing) {
        const cur = boxes[i], m = TALK.margin, top = H - bars;
        let x = m;
        if (cur.face && drawFace) x += drawFace(cx, cur.face, shown < cur.len ? faceFrame : 0, m, top + 4, bars - 8) + m;
        cx.font = TALK.font;
        cx.textBaseline = 'top';
        let left = Math.floor(shown), y = top + 10;
        for (const row of cur.rows) {
          const part = row.slice(0, Math.max(0, left));
          left -= row.length;
          for (const r of wrap(cx, part, W - x - m)) {
            cx.fillStyle = '#000'; cx.fillText(r, x + 1, y + 1);
            cx.fillStyle = '#fff'; cx.fillText(r, x, y);
            y += TALK.line;
          }
        }
        if (shown >= cur.len && (Date.now() >> 9) & 1) {
          cx.fillStyle = '#ff2ad4';
          cx.fillText('▼', W - m - 8, H - m - 10);
        }
      }
      cx.restore();
    },
  };
}

function wrap(cx, text, width) {
  const out = [];
  for (const para of text.split('\n')) {
    let row = '';
    for (const word of para.split(' ')) {
      const t = row ? row + ' ' + word : word;
      if (row && cx.measureText(t).width > width) { out.push(row); row = word; } else row = t;
    }
    if (row) out.push(row);
  }
  return out;
}
