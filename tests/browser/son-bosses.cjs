// Local real-WAD verification. Run explicitly; never distributes assets.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const port = 18078, base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js', 'C:/Users/speci/hlm2-data'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });
  let browser;
  try {
    for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } }); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const room of ['rmSonMansionFloor4', 'rmLSDIntro']) {
      await page.goto(base + '/?encounter=' + room + '#' + room);
      await page.waitForFunction(() => window.G && !document.querySelector('#play').disabled, null, { timeout: 90000 });
      if (!await page.locator('#play').isVisible()) await page.locator('#toggle-tools').click();
      await page.locator('#play').click();
      await page.waitForFunction(name => window.game?.room === name, room);
      const initial = await page.evaluate(() => { const g = window.game; g.stop(); return { character: g.diagnostics().character, bosses: g.bosses.map(b => ({ kind: b.kind, sprite: b.sprite, x: b.x, y: b.y })), enemies: g.enemies.length, exits: g.exits.length }; });
      assert.equal(initial.character, 'objSon'); assert.equal(initial.bosses.length, 1); console.log(room, 'initial', JSON.stringify(initial));
      const outcome = await page.evaluate(() => {
        const g = window.game;
        if (g.room === 'rmSonMansionFloor4') Object.assign(g.player, { x: 480, y: 430, hs: 0, vs: 0 });
        for (let n = 0; n < 4000; n++) { g.mouse.click = true; g.pressed.add(' '); g.step(); }
        return { bosses: g.bosses.map(b => ({ state: b.state, x: b.x, y: b.y })), exits: g.exits.map(x => x.live), locked: !!g.player.locked, dead: !!g.player.dead, x: g.player.x, y: g.player.y };
      });
      console.log(room, 'script outcome', JSON.stringify(outcome)); assert(!outcome.dead); assert(!outcome.locked);
      if (room === 'rmSonMansionFloor4') {
        assert.equal(outcome.bosses[0].state, 8);
        const death = await page.evaluate(() => { const g = window.game, b = g.bosses[0]; g.bullets.push({ x: b.x - 2, y: b.y, dir: 0, speed: 2, byPlayer: true }); g.step(); g.draw(); return { bosses: g.bosses.length, kills: g.stats.kills, body: g.dead.at(-1)?.sprite, exits: g.exits.map(x => x.live) }; });
        console.log('Colombian death', JSON.stringify(death)); assert.equal(death.bosses, 0); assert.equal(death.body, 'sprColombianBossDead');
      } else { assert.equal(outcome.bosses.length, 0); assert(outcome.exits.every(Boolean)); }
      await page.screenshot({ path: path.join(process.env.TEMP, room + '-codex.png') });
      await page.evaluate(() => { const g = window.game, exit = g.exits[0]; g.mouse.click = false; g.pressed.clear(); Object.assign(g.player, { x: exit.x, y: exit.y, hs: 0, vs: 0 }); g.step(); });
      await page.waitForFunction(name => window.game?.room !== name || /cleared/i.test(document.querySelector('#status').textContent), room);
      console.log('PASS: exit handoff from', room);
    }
    assert.deepEqual(errors, []); console.log('PASS: real WAD encounter smoke checks');
  } finally { await browser?.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
