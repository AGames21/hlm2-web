// Requires Playwright, Chromium, and FFmpeg. Uses generated test assets only.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');
const { dataWad, musicWad } = require('./fixture.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
let passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log('PASS:', name); return true; }
  catch (error) { failures.push(name); console.error('FAIL:', name, '\n', error.stack); return false; }
}
async function freePort() {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function stepOntoExit(page, clearArrival = false) {
  await page.evaluate(clear => {
    const g = window.game, exit = g.exits[0];
    if (clear) { g.player.x = exit.x - 30; g.player.y = exit.y; g.step(); }
    Object.assign(g.player, { x: exit.x, y: exit.y, hs: 0, vs: 0 }); g.step();
  }, clearArrival);
}
async function pointAt(page, worldX, worldY, click = 'left') {
  const point = await page.evaluate(([x, y]) => {
    const r = document.querySelector('#canvas').getBoundingClientRect(), g = window.game;
    return { x: r.x + (x - g.cam.x) * r.width / 480, y: r.y + (y - g.cam.y) * r.height / 270 };
  }, [worldX, worldY]);
  await page.mouse.move(point.x, point.y); await delay(40);
  await page.mouse.click(point.x, point.y, { button: click });
}
async function punchAndFinish(page) {
  const point = await page.evaluate(() => {
    const g = window.game;
    Object.assign(g.enemies[0], { x: g.player.x + 12, y: g.player.y });
    return [g.player.x + 20, g.player.y];
  });
  await pointAt(page, ...point);
  await page.waitForFunction(() => window.game.kos.length === 1);
  await page.waitForFunction(() => !window.game.player.attack);
  await page.evaluate(() => { const g = window.game, k = g.kos[0]; Object.assign(g.player, { x: k.x, y: k.y, hs: 0, vs: 0 }); });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.kos.length === 0 && !window.game.player.exec);
}

(async () => {
  const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port) }; delete env.HLM2_DIR;
  const server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '../..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break; } catch {} await delay(100); }
    const executable = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(existsSync);
    browser = await chromium.launch({ headless: true, executablePath: executable, args: ['--no-sandbox'] });
    await check('HTTP serves current assets, HEAD, ranges, and missing-file responses', async () => {
      const root = path.resolve(__dirname, '../../web'), html = readFileSync(path.join(root, 'index.html'));
      const response = await fetch(base + '/'); assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), html);
      const file = readFileSync(path.join(root, 'app.js'));
      const head = await fetch(base + '/app.js', { method: 'HEAD' });
      assert.equal(+head.headers.get('content-length'), file.length); assert.equal(await head.text(), '');
      const range = await fetch(base + '/app.js', { headers: { Range: 'bytes=0-31' } });
      assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), file.subarray(0, 32));
      assert.equal((await fetch(base + '/missing')).status, 404);
      assert.equal((await fetch(base + '/game/hlm2_data_desktop.wad')).status, 404);
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(5000);
    await page.goto(base);
    await check('Code-only startup, generated music, volume and stop', async () => {
      assert(await page.locator('#play').isDisabled());
      await page.locator('#music-play').click();
      await page.waitForFunction(() => document.querySelector('#music-play').textContent === 'Stop music');
      await page.locator('#music-volume').fill('30');
      await page.locator('#music-play').click();
      await page.waitForFunction(() => document.querySelector('#music-play').textContent === 'Play music');
    });
    const data = dataWad(), music = musicWad();
    await check('Music-only WAD decodes real OGG and survives reload without game data', async () => {
      await page.locator('#pick').setInputFiles({ name: 'hlm2_music_desktop.wad', mimeType: 'application/octet-stream', buffer: music });
      await page.waitForFunction(() => document.querySelector('#music-track').options.length === 2);
      await page.locator('#music-play').click();
      await page.waitForFunction(() => document.querySelector('#music-status').textContent.includes('Playing: Test'));
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#music-track').options.length === 2);
      assert(await page.locator('#play').isDisabled());
    });
    await page.goto(base + '/#rmTutorialFloor1');
    await page.locator('#pick').setInputFiles({ name: 'hlm2_data_desktop.wad', mimeType: 'application/octet-stream', buffer: data });
    await page.waitForFunction(() => window.G && document.querySelector('#room').options.length === 6);
    await check('Full WAD parsing, atlas decoding and textured room viewer', async () => {
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('rmTutorialFloor1:'));
      const pixel = await page.evaluate(() => [...document.querySelector('#canvas').getContext('2d').getImageData(0, 0, 1, 1).data]);
      assert.deepEqual(pixel, [80, 60, 30, 255]);
    });
    await page.locator('#play').click(); await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor1');
    const movement = await check('Movement works immediately after clicking Play', async () => {
      const x = await page.evaluate(() => window.game.player.x);
      await page.keyboard.down('d'); await delay(120); await page.keyboard.up('d');
      assert(await page.evaluate(start => window.game.player.x > start + 2, x));
    });
    if (!movement) await page.evaluate(() => document.activeElement.blur()); // Continue other checks after recording a failure.
    await check('Collision blocks movement through a solid wall', async () => {
      await page.evaluate(() => Object.assign(window.game.player, { x: 280, y: 90, hs: 0, vs: 0 }));
      await page.keyboard.down('d'); await delay(200); await page.keyboard.up('d');
      const x = await page.evaluate(() => window.game.player.x); assert(x <= 292 && x >= 280, String(x));
    });
    await check('Losing window focus clears held movement', async () => {
      const state = await page.evaluate(() => {
        window.game.keys.add('d'); dispatchEvent(new Event('blur')); return [...window.game.keys];
      });
      assert.deepEqual(state, []);
    });
    await page.evaluate(() => window.game.keys.clear());
    await check('Exit stays locked while an enemy is alive', async () => {
      await stepOntoExit(page); await delay(100);
      assert.equal(await page.evaluate(() => window.game.room), 'rmTutorialFloor1');
      await page.evaluate(() => Object.assign(window.game.player, { x: 100, y: 135, hs: 0, vs: 0 }));
    });
    await check('Punch, knockout, execution, score award and sound decoding', async () => {
      await punchAndFinish(page);
      const result = await page.evaluate(async () => ({ kills: window.game.stats.kills, score: window.game.stats.score,
        decoded: (await Promise.all([...window.G.audio.buffers].filter(([name]) => name.startsWith('Sounds/')).map(([, value]) => value))).some(buffer => buffer?.duration > 0) }));
      assert.equal(result.kills, 1); assert.equal(result.score, 800); assert(result.decoded);
    });
    await check('Restart creates a fresh room and restores enemies', async () => {
      await page.evaluate(() => { window.oldGame = window.game; });
      await page.keyboard.press('r'); await page.waitForFunction(() => window.game && window.game !== window.oldGame);
      assert.equal(await page.evaluate(() => window.game.enemies.length), 1);
    });
    await check('Gun pickup, ammunition, firing, throwing and empty-gun behavior', async () => {
      await page.evaluate(() => Object.assign(window.game.player, { x: 125, y: 170, hs: 0, vs: 0 }));
      await pointAt(page, 160, 135, 'right');
      await page.waitForFunction(() => window.game.player.weapon === '9mm');
      await pointAt(page, 160, 135);
      await page.waitForFunction(() => window.game.stats.kills === 1);
      assert.equal(await page.evaluate(() => window.game.player.ammo), 14);
      await page.waitForFunction(() => !window.game.player.attack && window.game.player.cooldown === 0);
      await page.evaluate(() => { window.game.player.ammo = 0; });
      await pointAt(page, 160, 135);
      assert.equal(await page.evaluate(() => window.game.player.attack), null);
      await pointAt(page, 160, 135, 'right');
      await page.waitForFunction(() => !window.game.player.weapon && window.game.weapons.some(w => w.name === '9mm'));
    });
    await check('Settings pause/resume, remapping, duplicate-key rejection and persistence', async () => {
      await page.locator('#settings').click(); await delay(50);
      const ticks = await page.evaluate(() => window.game.stats.steps); await delay(120);
      assert.equal(await page.evaluate(() => window.game.stats.steps), ticks);
      await page.locator('#setting-effects-volume').fill('25');
      await page.locator('[data-tab=controls]').click();
      await page.getByRole('button', { name: 'Move up: W', exact: true }).click(); await page.keyboard.press('s');
      assert.match(await page.locator('#settings-message').textContent(), /already assigned/);
      await page.keyboard.press('i'); await page.getByRole('button', { name: 'Move up: I', exact: true }).waitFor();
      await page.locator('#settings-close').click();
      const y = await page.evaluate(() => window.game.player.y);
      await page.keyboard.down('i'); await delay(120); await page.keyboard.up('i');
      assert(await page.evaluate(start => window.game.player.y < start - 2, y));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hlm2-web-options')).effectsVolume), 25);
    });
    await check('Fullscreen fills the screen, resizes, and retains working options', async () => {
      await page.locator('#fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement === document.querySelector('#view'));
      for (const [width, height] of [[1920, 1080], [900, 1440], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => { const c = document.querySelector('#canvas'), r = c.getBoundingClientRect(), scale = Math.min(innerWidth / c.width, innerHeight / c.height); return Math.abs(r.width - c.width * scale) < 1 && Math.abs(r.height - c.height * scale) < 1; });
      }
      await page.locator('#fullscreen-settings').click();
      const downloadEvent = page.waitForEvent('download'); await page.locator('#settings-report').click();
      const download = await downloadEvent, report = JSON.parse(readFileSync(await download.path(), 'utf8'));
      assert.equal(report.game.room, 'rmTutorialFloor1'); assert(report.game.roomObjects.length);
      await page.locator('#settings-close').click(); await page.locator('#fullscreen-exit').click();
      await page.waitForFunction(() => !document.fullscreenElement);
    });
    await check('Second floor retains stats, textures and functional combat input', async () => {
      await page.evaluate(() => { window.oldGame = window.game; });
      await stepOntoExit(page); await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor2');
      assert.equal(await page.evaluate(() => window.game.stats.kills), 1);
      const pixel = await page.evaluate(() => [...document.querySelector('#canvas').getContext('2d').getImageData(0, 0, 1, 1).data]);
      assert.deepEqual(pixel, [80, 60, 30, 255]);
      await punchAndFinish(page);
      assert.equal(await page.evaluate(() => window.game.stats.kills), 2);
      assert.equal(await page.evaluate(() => window.oldGame.mouse.click), false);
    });
    await stepOntoExit(page, true);
    await check('Level-end score screen appears after both floors', async () => {
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('cleared. Click'));
    });
    await delay(600);
    await check('Score screen ignores keyboard activity in Settings', async () => {
      await page.locator('#settings').click(); await page.keyboard.press('ArrowDown'); await delay(100);
      assert.equal(await page.evaluate(() => window.game.room), 'rmTutorialFloor2');
    });
    await page.locator('#settings-close').click();
    await check('Continue from score screen loads the next level', async () => {
      if (await page.evaluate(() => window.game.room === 'rmTutorialFloor2')) {
        const box = await page.locator('#canvas').boundingBox(); await page.mouse.click(box.x + 30, box.y + 30);
      }
      await page.waitForFunction(() => window.game?.room === 'rmFansLevel1Floor1');
    });
    await check('YouTube embed validates hosts and can be closed', async () => {
      await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Test embed</p>' }));
      await page.locator('#youtube-url').fill('https://youtu.be/abcdefghijk'); await page.getByRole('button', { name: 'Load YouTube', exact: true }).click();
      await page.locator('#youtube-player').waitFor(); await page.locator('#youtube-close').click();
      assert.equal(await page.locator('#youtube-player').count(), 0);
      await page.locator('#youtube-url').fill('https://example.org/video'); await page.getByRole('button', { name: 'Load YouTube', exact: true }).click();
      assert.equal(await page.locator('#youtube-player').count(), 0);
    });
    await check('Corrupt data WAD reports failure and preserves the saved valid WAD', async () => {
      await page.locator('#pick').setInputFiles({ name: 'hlm2_data_desktop.wad', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid archive') });
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Could not read'));
      await page.goto(base + '/#rmTutorialFloor1'); await page.waitForFunction(() => window.G?.rooms.list.length === 6);
    });
    await check('Menu boot, original-art fallback, Options and story cards', async () => {
      await page.locator('#menu').click(); await page.evaluate(() => document.activeElement.blur());
      for (let i = 0; i < 3; i++) { await delay(180); await page.keyboard.press('Space'); }
      await page.waitForFunction(() => window.G.audio.requestedMusic === 'beams');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await page.locator('#settings-dialog').waitFor({ state: 'visible' }); await page.locator('#settings-close').click();
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('PROLOGUE'));
      await delay(450); await page.keyboard.press('Space'); await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor1');
    });
    await check('Rapid Play clicks create only one live simulation', async () => {
      await page.locator('#play').click(); await page.waitForFunction(() => !window.game);
      await delay(50);
      const count = await page.evaluate(async () => {
        let current = window.game; const handles = [];
        Object.defineProperty(window, 'game', { configurable: true, get: () => current, set: value => { current = value; if (value) handles.push(value); } });
        document.querySelector('#play').click(); document.querySelector('#play').click();
        await new Promise(resolve => setTimeout(resolve, 200));
        const running = handles.filter(handle => handle.diagnostics().running).length;
        for (const handle of handles) if (handle !== current) handle.stop();
        Object.defineProperty(window, 'game', { configurable: true, writable: true, value: current });
        return running;
      });
      assert.equal(count, 1);
    });
    await check('Switching to Menu cancels a delayed room draw', async () => {
      await page.evaluate(() => {
        const key = 'Atlases/Levels/Fixture.png', image = window.G.images.get(key);
        window.G.images.set(key, new Promise(resolve => setTimeout(() => resolve(image), 150)));
        document.querySelector('#room').value = 'rmTutorialFloor2';
        document.querySelector('#room').dispatchEvent(new Event('change'));
        document.querySelector('#menu').click();
      });
      await delay(250);
      assert.match(await page.locator('#status').textContent(), /^Arrows and Enter/);
      assert.equal(await page.evaluate(() => document.querySelector('#canvas').height), 256);
    });
    await check('Returning to Menu cancels score-screen rendering and input', async () => {
      await page.locator('#room').selectOption('rmTutorialFloor1'); await delay(180);
      await page.locator('#play').click(); await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor1');
      await page.evaluate(() => { window.game.enemies.length = 0; window.game.stats.kills = 1; window.game.leave(); });
      await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor2');
      await page.evaluate(() => { window.game.enemies.length = 0; window.game.leave(); });
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('cleared. Click'));
      await delay(650); await page.locator('#menu').click(); await delay(120);
      await page.keyboard.press('ArrowDown'); await delay(150);
      assert.equal(await page.evaluate(() => window.game), null);
      assert.match(await page.locator('#status').textContent(), /^Arrows and Enter/);
    });
    await check('Story score, act card, scene card, intro skip and saved progression', async () => {
      await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('PROLOGUE'));
      await delay(450); await page.keyboard.press('Space');
      await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor1');
      // Place the fixture at each completed-floor boundary to test the story flow.
      await page.evaluate(() => { window.game.enemies.length = 0; window.game.stats.kills = 1; window.game.leave(); });
      await page.waitForFunction(() => window.game?.room === 'rmTutorialFloor2');
      await page.evaluate(() => { window.game.enemies.length = 0; window.game.leave(); });
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('MIDNIGHT ANIMAL cleared'));
      await delay(650); await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('1ST SCENE'));
      for (let i = 0; i < 2; i++) { await delay(450); await page.keyboard.press('Space'); }
      await page.waitForFunction(() => window.game?.room === 'rmFansHeadQuarters');
      assert.match(await page.locator('#status').textContent(), /intro-room preview/);
      assert.equal(await page.evaluate(() => +localStorage.getItem('hlm2-web-progress')), 1);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.game?.room === 'rmFansLevel1Floor1');
    });
    await check('No uncaught browser exceptions across the integrated workflow', async () => assert.deepEqual(errors, []));
    await context.close();
    console.log(JSON.stringify({ passed, failed: failures.length, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
