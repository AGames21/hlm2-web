// Sound effects and music through WebAudio. Effects are Sounds/<name>.wav in
// the data wad at the volume from hlm2_sounds.bin; music is
// Music/<Name>.ogg in hlm2_music_desktop.wad, which is optional.

export class Audio {
  constructor(wad, table) {
    this.wad = wad;
    this.table = table;
    this.music = null;
    this.ctx = new AudioContext();
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.ctx.destination);
    this.mus = this.ctx.createGain();
    this.mus.gain.value = 0.7;
    this.mus.connect(this.ctx.destination);
    this.buffers = new Map();
    this.track = null;
    // Browsers keep the context suspended until the page gets a gesture.
    const wake = () => this.ctx.state === 'suspended' && this.ctx.resume();
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
  }

  decode(wad, file) {
    if (!this.buffers.has(file)) {
      this.buffers.set(file, wad.bytes(file).then(b => this.ctx.decodeAudioData(b)).catch(e => {
        console.warn('sound', file, e.message);
        return null;
      }));
    }
    return this.buffers.get(file);
  }

  // sound_play: fire and forget. Unknown names are ignored.
  async play(name) {
    const s = this.table.get(name);
    if (!s) return;
    const file = ['wav', 'mp3'].map(e => `Sounds/${name}.${e}`).find(f => this.wad.has(f));
    const buf = file && await this.decode(this.wad, file);
    if (!buf) return;
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    gain.gain.value = s.volume;
    src.buffer = buf;
    src.connect(gain).connect(this.sfx);
    src.start();
  }

  // Loop one music track; the same name keeps playing, null stops.
  async playMusic(name) {
    if (this.track?.name === name) return;
    this.track?.src.stop();
    this.track = null;
    const file = name && `Music/${name}.ogg`;
    if (!file || !this.music?.has(file)) return;
    const track = { name, src: this.ctx.createBufferSource() };
    this.track = track;
    const buf = await this.decode(this.music, file);
    if (!buf || this.track !== track) return;
    track.src.buffer = buf;
    track.src.loop = true;
    track.src.connect(this.mus);
    track.src.start();
    // Decoded tracks are 30-60 MB of PCM each; keep only the one playing.
    for (const f of this.buffers.keys()) if (f.startsWith('Music/') && f !== file) this.buffers.delete(f);
  }
}

// A Blob stand-in over HTTP Range requests, so the 488 MB music wad is read
// piecewise from a private server (agar.js only needs size, slice, arrayBuffer).
export class RemoteFile {
  static async open(url) {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return null;
    return new RemoteFile(url, 0, +res.headers.get('Content-Length'));
  }

  constructor(url, start, end) { Object.assign(this, { url, start, end }); }

  get size() { return this.end - this.start; }

  slice(a = 0, b = this.size) {
    return new RemoteFile(this.url, this.start + a, this.start + Math.min(b, this.size));
  }

  async arrayBuffer() {
    const res = await fetch(this.url, { headers: { Range: `bytes=${this.start}-${this.end - 1}` } });
    if (res.status !== 206) throw new Error('server has no Range support');
    return res.arrayBuffer();
  }
}
