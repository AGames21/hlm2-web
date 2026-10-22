// Static server for web/. For private use (this PC or the homelab), set
// HLM2_DIR to a Hotline Miami 2 install and its .wad files are served under
// /game/ so the page loads them without a file pick. Never expose that
// variant publicly without the login gate: the wads are the game's
// copyrighted data.
//
//   node server.js                      -> code only, port 8077
//   node server.js "C:/.../Hotline Miami 2"   (or set HLM2_DIR)
//   node server.js --hash               -> type a password, prints a hash
//
// Login gate: set HLM2_PASS_HASH to the output of --hash (and optionally
// HLM2_USER to a username) and every path needs a login first. The password
// itself is never stored anywhere.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

if (process.argv[2] === '--hash') {
  process.stdout.write('Password: ');
  process.stdin.once('data', d => {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(d.toString().trim(), salt, 32);
    console.log(`scrypt:${salt.toString('hex')}:${hash.toString('hex')}`);
    process.exit(0);
  });
  return;
}

const PORT = +process.env.PORT || 8077;
const HOST = process.env.HOST || '127.0.0.1';
const WEB = path.join(__dirname, 'web');
const GAME_ARG = process.argv[2] || process.env.HLM2_DIR;
const GAME = GAME_ARG && path.resolve(GAME_ARG);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wad': 'application/octet-stream' };

// ---- login gate (only when HLM2_PASS_HASH is set)
const PASS = /^scrypt:([0-9a-f]+):([0-9a-f]{64})$/.exec(process.env.HLM2_PASS_HASH || '');
if (process.env.HLM2_PASS_HASH && !PASS) throw new Error('HLM2_PASS_HASH is not a `node server.js --hash` value');
// Sessions are signed with a key derived from the hash, so they survive
// restarts and a new password logs everyone out.
const USER = process.env.HLM2_USER || '';
const KEY = PASS && crypto.createHash('sha256').update('hlm2-session:' + PASS[0]).digest();
const SESSION_DAYS = 30;
const fails = new Map(); // ip -> [count, firstFailMs]

const sign = exp => exp + '.' + crypto.createHmac('sha256', KEY).update(String(exp)).digest('hex');
function loggedIn(req) {
  const m = /(?:^|;\s*)hlm2=(\d+)\.([0-9a-f]{64})/.exec(req.headers.cookie || '');
  if (!m || +m[1] < Date.now()) return false;
  return crypto.timingSafeEqual(Buffer.from(sign(m[1])), Buffer.from(m[1] + '.' + m[2]));
}
function clientIp(req) {
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  // Behind a proxy on this host or the LAN (nginx, Tailscale Funnel), take the
  // address that proxy saw: X-Real-IP, else the last X-Forwarded-For entry.
  if (!/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(ip)) return ip;
  const fwd = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',').pop().trim();
  return fwd || ip;
}
function loginPage(res, msg = '', status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(
    `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>HLM2 Web</title>
<style>body{background:#111;color:#eee;font:16px sans-serif;display:grid;place-items:center;min-height:90vh}
form{display:grid;gap:10px;width:260px}input,button{font:inherit;padding:8px}p{color:#f66;margin:0}</style>
<form method=post action=login><b>HLM2 Web</b>${msg && `<p>${msg}</p>`}
${USER ? '<input name=username placeholder=Username autocomplete=username required>' : ''}
<input type=password name=password placeholder=Password autofocus required><button>Log in</button></form>`);
}
function handleLogin(req, res) {
  const ip = clientIp(req);
  const f = fails.get(ip);
  if (f && Date.now() - f[1] > 15 * 60e3) fails.delete(ip);
  else if (f && f[0] >= 5) return loginPage(res, 'Too many tries. Wait 15 minutes.', 429);
  let body = '';
  req.on('data', d => { body += d; if (body.length > 4096) req.destroy(); });
  req.on('end', () => {
    const form = new URLSearchParams(body);
    const userOk = !USER || form.get('username') === USER;
    crypto.scrypt(form.get('password') || '', Buffer.from(PASS[1], 'hex'), 32, (err, hash) => {
      if (err || !crypto.timingSafeEqual(hash, Buffer.from(PASS[2], 'hex')) || !userOk) {
        const g = fails.get(ip) || [0, Date.now()];
        fails.set(ip, [g[0] + 1, g[1]]);
        console.log(`login failed from ${ip}`);
        return loginPage(res, USER ? 'Wrong username or password.' : 'Wrong password.', 401);
      }
      fails.delete(ip);
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      res.writeHead(303, {
        'Set-Cookie': `hlm2=${sign(Date.now() + SESSION_DAYS * 864e5)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
        Location: './',
      }).end();
    });
  });
}

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (PASS) {
    if (url === '/login') return req.method === 'POST' ? handleLogin(req, res) : loginPage(res);
    if (url === '/logout') return res.writeHead(303, { 'Set-Cookie': 'hlm2=; Path=/; Max-Age=0', Location: 'login' }).end();
    if (!loggedIn(req)) return url.endsWith('/') || url.endsWith('.html') ? res.writeHead(303, { Location: 'login' }).end() : res.writeHead(401).end();
  }
  let root = WEB;
  if (url.startsWith('/game/')) {
    if (!GAME || !url.endsWith('.wad')) return res.writeHead(404).end();
    root = GAME;
    url = url.slice(5);
  }
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(root, path.normalize(url));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return res.writeHead(404).end();
    // The ETag lets a browser keep the 94 MB data wad and just revalidate it.
    const etag = `"${st.size}-${st.mtimeMs}"`;
    const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) return res.writeHead(304, head).end();
    // Range requests let the page read single tracks out of the music wad.
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (m) {
      const a = +m[1], b = Math.min(m[2] ? +m[2] : st.size - 1, st.size - 1);
      if (a > b) return res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
      res.writeHead(206, { ...head, 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${st.size}` });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, HOST, () => console.log(`hlm2-web on http://${HOST}:${PORT}` + (GAME ? ' (serving game wads)' : '') + (PASS ? ', login required' : '')));
