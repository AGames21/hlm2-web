// Local real-WAD playthrough bot. Run explicitly; never distributes assets.
// Plays the story from a scene index (FROM, default 0) until STOP with the game's own
// input sets (movement keys, mouse aim and click, Space), stepping the game by
// hand. It paths to each enemy, hits it, executes the body, then takes the exit,
// and logs anything that looks broken: page errors, the player in a wall or with
// an unloaded sprite, position jumps, sprite flicker, enemies it cannot reach or
// hurt, rooms it cannot finish, and every sound name played per room.
// Writes fullrun-report.json and screenshots to OUT (default: the OS temp dir).
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FROM = +(process.env.FROM || 0), STOP = process.env.STOP || ''; // STOP: a scene label such as '3RD SCENE'
const OUT = process.env.OUT || path.join(process.env.TEMP || '/tmp', 'hlm2-fullrun');
const MINUTES = +(process.env.MINUTES || 90);

// Runs in the page. window.__bot drives one game handle at a time.
function installBot() {
  const VIEW_W = 480, VIEW_H = 270, CELL = 4;
  const B = window.__bot = { g: null, rooms: [], bugs: [], seen: new Set(), placed: new WeakMap(), deaths: {}, cur: null, unknownSounds: {} };
  const play = G.audio.play.bind(G.audio);
  G.audio.play = name => {
    if (B.cur) B.cur.sounds[name] = (B.cur.sounds[name] || 0) + 1;
    if (!G.audio.table.has(name)) B.unknownSounds[name] = (B.unknownSounds[name] || 0) + 1;
    return play(name);
  };
  const bug = (kind, detail, extra) => {
    const key = `${B.cur?.name}|${kind}|${detail}`;
    if (B.seen.has(key)) return;
    B.seen.add(key);
    B.bugs.push({ room: B.cur?.name, kind, detail, step: B.cur?.steps, ...extra });
    B.newBug = true;
  };
  const free = (sol, box, x, y) => {
    const l = Math.round(x) + box.l, t = Math.round(y) + box.t, r = l + box.r - box.l, b = t + box.b - box.t, E = 16; // game.js ROOM_EDGE
    if (l < -E || t < -E || r >= sol.w + E || b >= sol.h + E) return false;
    for (let yy = Math.max(t, 0); yy <= Math.min(b, sol.h - 1); yy++) for (let xx = Math.max(l, 0); xx <= Math.min(r, sol.w - 1); xx++) if (sol.grid[yy * sol.w + xx]) return false;
    return true;
  };
  const clearLine = (sol, a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
    for (let i = 1; i < n; i++) {
      const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n);
      if (sol.grid[y * sol.w + x]) return false;
    }
    return true;
  };

  function buildNav(g) {
    const sol = g.solids, w = Math.ceil(sol.w / CELL), h = Math.ceil(sol.h / CELL), ok = new Uint8Array(w * h);
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) ok[cy * w + cx] = free(sol, g.box, cx * CELL + CELL / 2, cy * CELL + CELL / 2) ? 1 : 0;
    return { w, h, ok };
  }
  const cellOf = (nav, x, y) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 8 && best < 0; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x2 = cx + dx, y2 = cy + dy;
        if (x2 < 0 || y2 < 0 || x2 >= nav.w || y2 >= nav.h || !nav.ok[y2 * nav.w + x2]) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = y2 * nav.w + x2; }
      }
    return best;
  };
  // Breadth-first distances from the player's cell (8-way, no corner cutting).
  function flood(nav, start) {
    const dist = new Int32Array(nav.w * nav.h).fill(-1), from = new Int32Array(nav.w * nav.h).fill(-1), q = new Int32Array(nav.w * nav.h);
    if (start < 0) return { dist, from };
    let head = 0, tail = 0;
    dist[start] = 0; q[tail++] = start;
    while (head < tail) {
      const i = q[head++], x = i % nav.w, y = (i - x) / nav.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x2 = x + dx, y2 = y + dy;
        if (x2 < 0 || y2 < 0 || x2 >= nav.w || y2 >= nav.h) continue;
        const j = y2 * nav.w + x2;
        if (!nav.ok[j] || dist[j] >= 0) continue;
        if (dx && dy && (!nav.ok[y * nav.w + x2] || !nav.ok[y2 * nav.w + x])) continue;
        dist[j] = dist[i] + 1; from[j] = i; q[tail++] = j;
      }
    }
    return { dist, from };
  }

  function attach(g) {
    g.stop();
    const d = g.diagnostics();
    const restart = B.cur && B.cur.name === g.room && B.restarting;
    B.restarting = false;
    B.g = g;
    B.cur = { name: g.room, character: d.character, restart, steps: 0, deaths: B.deaths[g.room] || 0, sounds: {}, enemies: d.counts.enemies, bosses: d.counts.bosses,
      talks: g.talks.length, exits: g.exits.length, elevators: g.elevators.length, assists: [], stuck: 0, spriteChanges: 0, maxJump: 0, outcome: null };
    B.rooms.push(B.cur);
    B.art = new Set(Object.keys(d.frameCounts));
    B.nav = buildNav(g);
    B.plan = null; B.best = Infinity; B.since = 0; B.hitting = null; B.hitFor = 0; B.prev = null; B.hist = []; B.deadFor = 0; B.target = null;
    const p = g.player;
    if (!p.sceneHidden && !free(g.solids, g.box, p.x, p.y)) bug('spawn in wall', `${Math.round(p.x)},${Math.round(p.y)}`);
    if (p.sprite && !B.art.has(p.sprite)) bug('player sprite not loaded', p.sprite);
    B.cur.at = `${Math.round(p.x)},${Math.round(p.y)}`;
    B.cur.exitState = g.exits.map(x => `${x.x},${x.y}${x.grey ? ' grey' : ''}${x.off ? ' off' : ''}`).join(' | ');
    B.reachDue = true;
    if (!p.sceneHidden) reach(g, d);
  }
  // Enemies and exits the player cannot walk to, checked once the player is in the room
  // (a car arrival hides the player off the map first).
  function reach(g, d = g.diagnostics()) {
    B.reachDue = false;
    const p = g.player, start = cellOf(B.nav, p.x, p.y), f = flood(B.nav, start);
    for (const t of d.targets) {
      if (t.sprite && !B.art.has(t.sprite)) bug('enemy sprite not loaded', `${t.kind} ${t.sprite}`);
      const c = cellOf(B.nav, t.x, t.y);
      if (t.isEnemy && (c < 0 || f.dist[c] < 0)) bug('enemy unreachable on foot', `${t.kind} at ${Math.round(t.x)},${Math.round(t.y)}`);
    }
    for (const x of [...g.exits, ...g.elevators]) {
      const c = cellOf(B.nav, x.x + ((x.box?.l ?? 0) + (x.box?.r ?? 0)) / 2, x.y + ((x.box?.t ?? 0) + (x.box?.b ?? 0)) / 2);
      if (c < 0 || f.dist[c] < 0) bug('exit unreachable on foot', `${Math.round(x.x)},${Math.round(x.y)}`);
    }
  }

  // The thing to go for now, as { x, y, kind, ref }.
  function pickTarget(g, f) {
    const p = g.player, cands = [];
    const add = (o, kind, x = o.x, y = o.y) => {
      const c = cellOf(B.nav, x, y), dd = c >= 0 ? f.dist[c] : -1;
      cands.push({ x, y, kind, ref: o, cell: c, d: dd >= 0 ? dd : 1e6 + Math.hypot(x - p.x, y - p.y) });
    };
    for (const k of g.kos) add(k, 'ko');
    for (const e of g.enemies) if (e.isEnemy) add(e, 'enemy');
    for (const b of g.bosses) add(b, 'boss');
    if (!cands.length) {
      // Arrival elevators stay disabled until the player walks completely out.
      // Pick a reachable tile outside the used lifts before targeting a ride.
      const used = g.elevators.filter(l => l.used);
      if (used.length) {
        const outside = (x, y) => used.every(l =>
          Math.round(x) + g.box.l > Math.round(l.x) + l.box.r ||
          Math.round(x) + g.box.r < Math.round(l.x) + l.box.l ||
          Math.round(y) + g.box.t > Math.round(l.y) + l.box.b ||
          Math.round(y) + g.box.b < Math.round(l.y) + l.box.t);
        let best = null;
        for (let i = 0; i < f.dist.length; i++) {
          if (f.dist[i] < 0 || best && f.dist[i] >= best.d) continue;
          const x = (i % B.nav.w) * CELL + CELL / 2, y = Math.floor(i / B.nav.w) * CELL + CELL / 2;
          if (outside(x, y)) best = { x, y, d: f.dist[i] };
        }
        if (best) { add(used[0], 'step off elevator', best.x, best.y); return cands[0]; }
      }
      // Skip exits back to cleared hub rooms unless they are the only way on.
      // live is only set by the room's first step; a clear room's exits count from the start.
      const clear = !g.enemies.some(e => e.isEnemy) && !g.kos.length && !g.bosses.length;
      const all = g.exits.filter(x => x.live || clear && !x.off), fresh = all.filter(x => !x.grey);
      const live = fresh.length ? fresh : all;
      for (const x of live) add(x, 'exit', x.x + ((x.box?.l ?? 0) + (x.box?.r ?? 0)) / 2, x.y + ((x.box?.t ?? 0) + (x.box?.b ?? 0)) / 2);
      for (const l of g.elevators) add(l, 'elevator', l.x + ((l.box?.l ?? 0) + (l.box?.r ?? 0)) / 2, l.y + ((l.box?.t ?? 0) + (l.box?.b ?? 0)) / 2);
    }
    if (!cands.length) for (const e of g.enemies) add(e, 'other');
    // Standing on an exit that has not gone live (it was the way in): step off it.
    if (!cands.length && g.exits.some(x => x.off)) {
      // The nearest reachable cell well clear of the exit's arrival box.
      const x = g.exits.find(x => x.off), o = x.off;
      let best = -1;
      for (let c = 0; c < f.dist.length; c++) {
        if (f.dist[c] < 0 || best >= 0 && f.dist[c] >= f.dist[best]) continue;
        const cx = (c % B.nav.w + 0.5) * CELL, cy = (Math.floor(c / B.nav.w) + 0.5) * CELL;
        if (cx < x.x + x.box.l - o.r - 8 || cx > x.x + x.box.r - o.l + 8 || cy < x.y + x.box.t - o.b - 8 || cy > x.y + x.box.b - o.t + 8) best = c;
      }
      if (best >= 0) add(x, 'step off', (best % B.nav.w + 0.5) * CELL, (Math.floor(best / B.nav.w) + 0.5) * CELL);
    }
    if (!cands.length && g.talks.length) {
      const t = g.talks[0];
      if (t.at) add(t.at[0], 'talker');
    }
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }

  function botInput(g) {
    const p = g.player, keys = g.keys, mouse = g.mouse;
    keys.clear();
    if (g.talking()) { if (B.cur.steps % 8 === 0) g.pressed.add(' '); return; }
    if (p.dead) {
      if (B.deadFor === 0) {
        const near = [...g.enemies, ...g.bosses].map(e => ({ kind: e.kind, d: Math.round(Math.hypot(e.x - p.x, e.y - p.y)), gun: e.g?.sound || null, sprite: e.sprite })).sort((a, b) => a.d - b.d)[0];
        (B.cur.deathsHere ||= []).push({ step: B.cur.steps, sprite: p.dead.sprite, near, at: `${Math.round(p.x)},${Math.round(p.y)}` });
      }
      if (++B.deadFor === 60) { B.deaths[g.room] = (B.deaths[g.room] || 0) + 1; B.restarting = true; g.pressed.add('r'); }
      return;
    }
    if (p.exec || p.ride || p.locked || p.sceneHidden) return;
    const start = cellOf(B.nav, p.x, p.y);
    if (!B.plan || B.cur.steps % 15 === 0) B.plan = flood(B.nav, start);
    const t = pickTarget(g, B.plan);
    if (!t) return;
    if (B.target?.ref !== t.ref) { B.target = t; B.best = Infinity; B.since = 0; }
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    p.aim = Math.atan2(t.y - p.y, t.x - p.x);
    mouse.x = t.x - g.cam.x; mouse.y = t.y - g.cam.y;
    const fighting = t.kind === 'enemy' || t.kind === 'boss' || t.kind === 'other';
    const gun = p.ammo > 0;
    if (fighting && !(p.cooldown > 0) && !p.attack) {
      if (d < 30 || (gun && d < 260 && clearLine(g.solids, p, t))) mouse.click = true;
    }
    if (t.kind === 'ko' && d < 8) g.pressed.add(' ');
    // Track hits that never land.
    if (fighting && d < 22) {
      if (B.hitting === t.ref) { if (++B.hitFor === 400) { bug('enemy cannot be hurt in melee', `${t.ref.kind || t.ref.obj} ${t.ref.sprite} at ${Math.round(t.x)},${Math.round(t.y)}`, { weapon: p.weapon }); } }
      else { B.hitting = t.ref; B.hitFor = 0; }
    }
    // Walk the flood path backwards from the target to a waypoint a few cells out.
    let goal = { x: t.x, y: t.y };
    if (t.cell >= 0 && B.plan.dist[t.cell] > 2) {
      const path = [];
      for (let i = t.cell; i >= 0 && path.length < 4000; i = B.plan.from[i]) path.push(i);
      const w = path[Math.max(0, path.length - 1 - 3)];
      goal = { x: (w % B.nav.w) * CELL + CELL / 2, y: Math.floor(w / B.nav.w) * CELL + CELL / 2 };
    }
    const close = fighting ? 10 : 1;
    if (d > close) {
      const dx = goal.x - p.x, dy = goal.y - p.y;
      if (dx > 1.5) keys.add('d'); else if (dx < -1.5) keys.add('a');
      if (dy > 1.5) keys.add('s'); else if (dy < -1.5) keys.add('w');
    }
    // Stuck: no progress on the path for a while, hop ahead along it.
    const progress = t.cell >= 0 && B.plan.dist[t.cell] >= 0 ? B.plan.dist[t.cell] : d;
    if (progress < B.best - 0.5) { B.best = progress; B.since = 0; }
    else if (++B.since > 500 && d > 24) {
      B.cur.stuck++;
      bug('bot stuck', `going for ${t.kind} at ${Math.round(t.x)},${Math.round(t.y)} from ${Math.round(p.x)},${Math.round(p.y)}`);
      const at = goal.x === t.x && goal.y === t.y ? t : goal;
      p.x = at.x; p.y = at.y; p.hs = p.vs = 0; B.since = 0; B.best = Infinity; B.teleported = true;
    }
  }

  function check(g) {
    const p = g.player, sol = g.solids, cur = B.cur;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bug('player position not a number', `${p.x},${p.y}`);
    const busy = p.exec || p.ride || p.dead || p.sceneHidden;
    if (B.reachDue && !p.sceneHidden) reach(g);
    if (!busy && !free(sol, g.box, p.x, p.y)) bug('player inside a wall', `${Math.round(p.x)},${Math.round(p.y)} sprite ${p.sprite}`);
    if (!p.sceneHidden && p.sprite && !B.art.has(p.sprite)) bug('player sprite not loaded (invisible)', p.sprite);
    if (B.prev) {
      const j = Math.hypot(p.x - B.prev.x, p.y - B.prev.y), skip = B.teleported || p.exec || B.prev.exec || p.ride || p.dead || B.prev.hidden;
      if (!skip) { cur.maxJump = Math.max(cur.maxJump, j); if (j > 8) bug('player jumped', `${j.toFixed(1)}px to ${Math.round(p.x)},${Math.round(p.y)} sprite ${p.sprite}`); }
      if (p.sprite !== B.prev.sprite) cur.spriteChanges++;
      if (B.prev.exec && !p.exec && j > 10) bug('player snapped after an execution', `${j.toFixed(1)}px to ${Math.round(p.x)},${Math.round(p.y)}`);
    }
    B.teleported = false;
    B.hist.push(p.sprite); if (B.hist.length > 4) B.hist.shift();
    const h = B.hist;
    if (h.length === 4 && h[0] === h[2] && h[1] === h[3] && h[0] !== h[1] && !p.attack) bug('player sprite flicker', `${h[0]} <-> ${h[1]}`);
    B.prev = { x: p.x, y: p.y, sprite: p.sprite, exec: !!p.exec, hidden: !!p.sceneHidden };
    for (const e of g.enemies) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) bug('enemy position not a number', e.kind);
      else if (e.box && !free(sol, e.box, e.x, e.y)) {
        // Some rooms place an enemy a pixel or two into a wall; only report
        // one that walked into a wall, not one still where the room put it.
        if (!B.placed.has(e)) B.placed.set(e, { x: e.x, y: e.y });
        const s = B.placed.get(e);
        if (!s || Math.hypot(e.x - s.x, e.y - s.y) > 4) bug('enemy inside a wall', `${e.kind} ${Math.round(e.x)},${Math.round(e.y)}`);
      } else if (!B.placed.has(e)) B.placed.set(e, null);
      if (e.sprite && !B.art.has(e.sprite)) bug('enemy sprite not loaded (invisible)', `${e.kind} ${e.sprite}`);
    }
    for (const k of g.kos) if (k.sprite && !B.art.has(k.sprite)) bug('body sprite not loaded', `${k.obj} ${k.sprite}`);
    for (const d of g.dead) if (d.sprite && !B.art.has(d.sprite)) bug('corpse sprite not loaded', d.sprite);
    for (const w of g.weapons) if (w.sprite && !B.art.has(w.sprite)) bug('weapon sprite not loaded', `${w.name} ${w.sprite}`);
  }

  // Steps the current game up to n times. Returns what the runner should do.
  B.tick = (n, assistAfter = 15000, giveUpAfter = 22000) => {
    const g = window.game;
    if (location.hash === '#menu') return { mode: 'menu' };
    if (!g) return { mode: 'nogame', status: document.querySelector('#status').textContent };
    if (g !== B.g) attach(g);
    if (g.left) return { mode: 'left', status: document.querySelector('#status').textContent };
    B.newBug = false;
    for (let i = 0; i < n; i++) {
      if (window.game !== g || g.left) break;
      const cur = B.cur;
      cur.steps++;
      botInput(g);
      // Assists when the bot is outmatched: first no enemy bullets, then no enemies.
      const deaths = B.deaths[g.room] || 0;
      if (deaths >= 3) { if (!cur.assists.includes('no bullets')) cur.assists.push('no bullets'); for (let k = g.bullets.length - 1; k >= 0; k--) if (!g.bullets[k].byPlayer) g.bullets.splice(k, 1); }
      if ((deaths >= 6 || cur.steps === assistAfter) && (g.enemies.some(e => e.isEnemy) || g.bosses.length || g.kos.length)) {
        if (cur.steps === assistAfter) bug('bot could not clear the room', `${g.enemies.filter(e => e.isEnemy).map(e => `${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`).join(' ')} bosses ${g.bosses.map(b => b.kind).join(' ')} kos ${g.kos.length}`);
        cur.assists.push('removed enemies');
        g.enemies.splice(0, g.enemies.length, ...g.enemies.filter(e => !e.isEnemy)); g.kos.length = 0; g.bosses.length = 0;
      }
      if (cur.steps === giveUpAfter) {
        bug('room never ended', `exits ${g.exits.map(x => x.live).join(',')} elevators ${g.elevators.length} talks ${g.talks.length} enemies ${g.enemies.length}`);
        cur.assists.push('forced leave'); g.leave(); break;
      }
      try { g.step(); } catch (e) { bug('step threw', e.message); cur.outcome = 'crash'; return { mode: 'crash', error: e.stack }; }
      g.cam.x = Math.max(0, Math.min(g.solids.w - VIEW_W, Math.round(g.player.x - VIEW_W / 2)));
      g.cam.y = Math.max(0, Math.min(g.solids.h - VIEW_H, Math.round(g.player.y - VIEW_H / 2)));
      if (window.game === g && !g.left) check(g);
      if (i % 4 === 0) try { g.draw(); } catch (e) { bug('draw threw', e.message); }
    }
    if (g.left) { B.cur.outcome = 'left'; B.cur.via = g.via; }
    const p = g.player;
    return { mode: 'playing', room: g.room, steps: B.cur.steps, newBug: B.newBug, enemies: g.enemies.length, kos: g.kos.length, x: Math.round(p.x), y: Math.round(p.y), dead: !!p.dead };
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = 18079, base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js', 'C:/Users/speci/hlm2-data'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });
  let browser, page;
  const errors = [], logs = [];
  const save = () => page && page.evaluate(() => window.__bot && { rooms: window.__bot.rooms, bugs: window.__bot.bugs, unknownSounds: window.__bot.unknownSounds }).then(r => {
    fs.writeFileSync(path.join(OUT, 'fullrun-report.json'), JSON.stringify({ ...r, errors, logs: logs.slice(-200) }, null, 1));
    return r;
  }).catch(() => null);
  try {
    for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
    page.on('response', r => { if (r.status() >= 400) logs.push(r.status() + ' ' + r.url()); });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
    await page.goto(base + '/');
    await page.waitForFunction(() => window.G && window.runScene, null, { timeout: 120000 });
    await page.evaluate(installBot);
    await page.evaluate(i => { history.replaceState(null, '', '#bot'); window.runScene(i); }, FROM);
    const t0 = Date.now();
    let lastRoom = null, shots = 0, quiet = 0;
    while (Date.now() - t0 < MINUTES * 60000) {
      const s = await page.evaluate(() => window.__bot.tick(1200));
      if (s.mode === 'menu') { console.log('Back at the menu: story over.'); break; }
      if (s.mode === 'crash') { console.log('CRASH', s.error); break; }
      if (s.mode === 'nogame' || s.mode === 'left') {
        if (++quiet > 600) { console.log('Stalled with no game:', s.status); break; }
        // Cards, the mask menu and the score screen all take Enter.
        if (s.mode === 'nogame' && quiet % 3 === 0) await page.keyboard.press('Enter');
        if (s.mode === 'left' && quiet % 3 === 0) await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 150));
        continue;
      }
      quiet = 0;
      if (s.room !== lastRoom) {
        lastRoom = s.room;
        const scene = await page.evaluate(() => document.querySelector('#status').textContent);
        console.log(`room ${s.room}  (${scene.slice(0, 60)})`);
        if (STOP && scene.startsWith(STOP)) { console.log('Reached', STOP); break; }
      }
      if (s.newBug && shots < 80) {
        shots++;
        const last = await page.evaluate(() => window.__bot.bugs.at(-1));
        console.log('  BUG', last.kind, '-', last.detail);
        await page.locator('#canvas').screenshot({ path: path.join(OUT, `bug${String(shots).padStart(2, '0')}-${s.room}.png`) }).catch(() => {});
      }
      if (s.steps % 6000 < 1200) await save();
    }
    const r = await save();
    console.log(`\nRooms played: ${r?.rooms.length}, bugs: ${r?.bugs.length}, page errors: ${errors.length}`);
    console.log('Report:', path.join(OUT, 'fullrun-report.json'));
  } finally { await browser?.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
