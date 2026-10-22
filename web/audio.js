// Sound effects and music through WebAudio. Effects are Sounds/<name>.wav in
// the data wad at the volume from hlm2_sounds.bin; music is
// Music/<Name>.ogg in hlm2_music_desktop.wad, which is optional.
import { options } from './settings.js';

export class Audio {
  constructor(wad = null, table = new Map()) {
    this.wad = wad;
    this.table = table;
    this.music = null;
    this.ctx = new AudioContext();
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.ctx.destination);
    this.mus = this.ctx.createGain();
    this.mus.gain.value = 0.7;
    this.mus.connect(this.ctx.destination);
    this.applySettings();
    addEventListener('settingschange', () => this.applySettings());
    this.buffers = new Map();
    this.track = null;
    this.requestedMusic = null;
    this.demo = null;
    // Browsers keep the context suspended until the page gets a gesture.
    const wake = () => this.ctx.state === 'suspended' && this.ctx.resume();
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
  }

  applySettings() {
    this.mus.gain.value = options.music ? options.musicVolume / 100 : 0;
    this.sfx.gain.value = options.effectsVolume / 100;
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
    this.requestedMusic = name;
    if (this.externalMusic) return;
    if (this.track?.name === name) return;
    this.track?.src?.stop();
    this.track = null;
    const file = name && `Music/${name}.ogg`;
    if (!name) return;
    const track = { name, src: null };
    this.track = track;
    const buf = name === '@original' || !this.music?.has(file)
      ? (this.demo ||= makeDemo(this.ctx)) : await this.decode(this.music, file);
    if (this.track !== track) return;
    if (!buf) { this.track = null; return false; }
    track.src = this.ctx.createBufferSource();
    track.src.buffer = buf;
    track.src.loop = true;
    track.src.connect(this.mus);
    track.src.start();
    // Decoded tracks are 30-60 MB of PCM each; keep only the one playing.
    for (const f of this.buffers.keys()) if (f.startsWith('Music/') && f !== file) this.buffers.delete(f);
  }
}

// An original four-bar synth loop, generated locally; no game assets or downloads.
function makeDemo(ctx) {
  const beat = 60 / 112, duration = beat * 16, rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * rate), rate);
  const out = buffer.getChannelData(0);
  const notes = [33, 33, 36, 31];
  let seed = 7;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2147483648 - 1; };
  for (let i = 0; i < out.length; i++) {
    const t = i / rate, step = Math.floor(t / (beat / 2)), phase = t % (beat / 2);
    const bar = Math.min(3, Math.floor(t / (beat * 4)));
    const bass = 440 * 2 ** ((notes[bar] - 69) / 12);
    const arp = bass * 4 * [1, 1.5, 2, 2.5, 2, 1.5, 1.25, 1.5][step % 8];
    const kickTime = t % beat, snareTime = t % (beat * 2) - beat;
    const duck = 0.35 + 0.65 * Math.min(1, kickTime / 0.15);
    let sample = 0.22 * Math.sin(2 * Math.PI * (48 * kickTime + 8 * (1 - Math.exp(-35 * kickTime)))) * Math.exp(-16 * kickTime);
    sample += 0.17 * Math.tanh(2 * Math.sin(2 * Math.PI * bass * t)) * Math.exp(-8 * phase) * duck;
    sample += 0.07 * Math.sin(2 * Math.PI * arp * phase) * Math.exp(-18 * phase) * duck;
    const n = noise();
    sample += 0.055 * n * Math.exp(-90 * phase);
    if (snareTime >= 0) sample += 0.13 * n * Math.exp(-22 * snareTime);
    out[i] = sample;
  }
  // Avoid a click when the loop wraps.
  const fade = Math.min(256, out.length / 2);
  for (let i = 0; i < fade; i++) { out[i] *= i / fade; out[out.length - 1 - i] *= i / fade; }
  return buffer;
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
