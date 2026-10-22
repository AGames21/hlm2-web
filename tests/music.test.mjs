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

// Verify routing with a recording transport, separately from network/YouTube.
const { SceneSoundtrack, SOUNDTRACK, BUILTIN_SOURCES } = await import('../web/soundtrack.js');
const { youtubeTrack } = await import('../web/youtube.js');
const { MUSIC } = await import('../web/game.js');
const { STORY } = await import('../web/menu.js');

test('Every menu, intro and level cue has a named soundtrack entry', () => {
  const cues = ['beams', 'Detection', ...MUSIC.map(([, cue]) => cue), ...STORY.flatMap(s => [s.track, s.introTrack])].filter(Boolean);
  for (const cue of cues) assert(Object.hasOwn(SOUNDTRACK, cue), cue);
  for (const [cue, url] of Object.entries(BUILTIN_SOURCES)) {
    assert(SOUNDTRACK[cue]); const parsed = youtubeTrack(url);
    assert(parsed.videoId || parsed.list);
  }
});

test('YouTube links retain chapter timestamps and fixed playlist entry indices', () => {
  assert.deepEqual(youtubeTrack('https://youtu.be/abcdefghijk?t=1h2m3s&end=4000'), { videoId: 'abcdefghijk', list: null, index: 0, start: 3723, end: 4000 });
  assert.equal(youtubeTrack('https://www.youtube.com/playlist?list=PL1234567890&index=5').index, 4);
  assert.equal(youtubeTrack('https://youtu.be/abcdefghijk#t=90').start, 90);
  for (const suffix of ['?t=banana', '?start=30&end=10', '?index=-1', '?index=1.2']) assert.throws(() => youtubeTrack('https://youtu.be/abcdefghijk' + suffix));
});

test('Scene routing follows cues, stops on silence or missing sources, and leaves manual videos alone', () => {
  const calls = [], player = { play: (...args) => calls.push(args), stop: () => calls.push('stop') };
  const scene = new SceneSoundtrack({ player, sources: { Detection: 'https://youtu.be/abcdefghijk', voyager: 'https://youtu.be/lmnopqrstuv' } });
  assert.equal(scene.request('Detection'), false); assert.equal(calls.length, 0);
  scene.enable(); assert.equal(calls.at(-1)[0], 'https://youtu.be/abcdefghijk');
  scene.request('voyager'); assert.equal(calls.at(-1)[0], 'https://youtu.be/lmnopqrstuv');
  scene.request(null); assert.equal(calls.at(-1), 'stop');
  scene.stop(); scene.enable(); assert.equal(calls.at(-1), 'stop', 'enabling a silent scene must not invent a music cue');
  scene.request('Blizzard'); assert.equal(calls.at(-1), 'stop');
  scene.assign('Blizzard', 'https://youtu.be/abcdefghijk'); assert.equal(calls.at(-1)[0], 'https://youtu.be/abcdefghijk');
  scene.manual('https://youtu.be/lmnopqrstuv'); const count = calls.length;
  assert(scene.request('Detection')); assert.equal(calls.length, count);
  scene.stop(); assert.equal(scene.request('Detection'), false);
});

test('Scene transport cancels pending local decoding and records muted scene cues', async () => {
  const audio = new Audio(); audio.music = { has: () => true };
  let resolve; audio.decode = () => new Promise(done => { resolve = done; });
  const pending = audio.playMusic('Test');
  const cues = []; audio.onMusicCue = cue => { cues.push(cue); return true; };
  await audio.playMusic('Detection'); resolve({}); await pending;
  assert.equal(audio.track, null); assert.equal(audio.ctx.sources.length, 0);
  assert.equal(audio.requestedMusic, 'Detection'); assert.deepEqual(cues, ['Detection']);
});
