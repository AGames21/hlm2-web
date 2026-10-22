import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeEmbed } from '../web/youtube.js';
import { Audio } from '../web/audio.js';

test('YouTube video, short and playlist URLs become privacy-enhanced embeds', () => {
  for (const url of ['https://youtu.be/abcdefghijk?t=12', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk']) {
    assert.equal(new URL(youtubeEmbed(url)).pathname, '/embed/abcdefghijk');
  }
  const list = new URL(youtubeEmbed('https://www.youtube.com/playlist?list=PL1234567890'));
  assert.equal(list.hostname, 'www.youtube-nocookie.com');
  assert.equal(list.pathname, '/embed/videoseries');
  assert.equal(list.searchParams.get('list'), 'PL1234567890');
});

test('Only valid YouTube video or playlist links may be embedded', () => {
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://example.com', 'https://youtube.com/results?search_query=music', 'https://youtu.be/invalid', 'https://name:password@youtube.com/watch?v=abcdefghijk']) {
    assert.throws(() => youtubeEmbed(url));
  }
});

class Context {
  constructor() { this.destination = {}; this.sampleRate = 8000; this.sources = []; }
  createGain() { return { gain: { value: 1 }, connect() { return this; } }; }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    const source = { started: false, stopped: false, connect() {}, start() { this.started = true; }, stop() {
      assert(this.started, 'must not stop an unstarted source'); this.stopped = true;
    } };
    this.sources.push(source);
    return source;
  }
}
globalThis.AudioContext = Context;
globalThis.addEventListener = () => {};

test('Asset-free music produces finite, non-silent audio, loops, and stops', async () => {
  const audio = new Audio();
  await audio.playMusic('@original');
  const source = audio.track.src, samples = source.buffer.getChannelData(0);
  assert(source.started && source.loop);
  assert(samples.every(Number.isFinite));
  assert(samples.some(n => Math.abs(n) > 0.1));
  await audio.playMusic(null);
  assert(source.stopped);
  assert.equal(audio.track, null);
});

test('Stopping or switching while decoding cannot start a stale track', async () => {
  const audio = new Audio();
  audio.music = { has: () => true };
  let resolve;
  audio.decode = () => new Promise(done => { resolve = done; });
  const pending = audio.playMusic('Test');
  await audio.playMusic(null);
  resolve({});
  await pending;
  assert.equal(audio.track, null);
  assert.equal(audio.ctx.sources.length, 0);
  const next = audio.playMusic('Test');
  await audio.playMusic('@original');
  const original = audio.track;
  resolve({});
  await next;
  assert.equal(audio.track, original);
  assert.equal(audio.ctx.sources.length, 1);
});

test('YouTube priority suppresses in-game audio until released', async () => {
  const audio = new Audio();
  audio.externalMusic = true;
  await audio.playMusic('beams');
  assert.equal(audio.track, null);
  assert.equal(audio.requestedMusic, 'beams');
  audio.externalMusic = false;
  await audio.playMusic('beams');
  assert(audio.track.src.started);
});

test('Decode failure clears the current track and allows retry', async () => {
  const audio = new Audio();
  audio.music = { has: () => true };
  audio.decode = async () => null;
  assert.equal(await audio.playMusic('Test'), false);
  assert.equal(audio.track, null);
  assert.equal(audio.ctx.sources.length, 0);
  await audio.playMusic('@original');
  assert(audio.track.src.started);
});
