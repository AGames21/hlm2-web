// Static server for web/. For private use (this PC or the homelab), set
// HLM2_DIR to a Hotline Miami 2 install and its .wad files are served under
// /game/ so the page loads them without a file pick. Never expose that
// variant publicly: the wads are the game's copyrighted data.
//
//   node server.js                      -> code only, port 8077
//   node server.js "C:/.../Hotline Miami 2"   (or set HLM2_DIR)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 8077;
const HOST = process.env.HOST || '127.0.0.1';
const WEB = path.join(__dirname, 'web');
const GAME_ARG = process.argv[2] || process.env.HLM2_DIR;
const GAME = GAME_ARG && path.resolve(GAME_ARG);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wad': 'application/octet-stream' };

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
    const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
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
}).listen(PORT, HOST, () => console.log(`hlm2-web on http://${HOST}:${PORT}` + (GAME ? ' (serving game wads)' : '')));
