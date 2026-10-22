// Only build embeds for validated YouTube IDs; never embed arbitrary URLs.
export function youtubeEmbed(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Paste a full YouTube video or playlist URL.'); }
  const host = url.hostname.toLowerCase();
  const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'];
  if (!['https:', 'http:'].includes(url.protocol) || !hosts.includes(host) || url.username || url.password || url.port) {
    throw new Error('Use a youtube.com or youtu.be link.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const video = host.endsWith('youtu.be') ? parts[0]
    : ['embed', 'shorts', 'live'].includes(parts[0]) && parts[1] !== 'videoseries' ? parts[1] : url.searchParams.get('v');
  const list = url.searchParams.get('list');
  if (video && !/^[A-Za-z0-9_-]{11}$/.test(video)) throw new Error('That YouTube video ID is invalid.');
  if (list && !/^[A-Za-z0-9_-]{10,100}$/.test(list)) throw new Error('That YouTube playlist ID is invalid.');
  if (!video && !list) throw new Error('Choose a video or playlist link, rather than a search or channel.');
  const embed = new URL('https://www.youtube-nocookie.com/embed/' + (video || 'videoseries'));
  if (list) embed.searchParams.set('list', list);
  embed.searchParams.set('playsinline', '1');
  return embed.href;
}

function seconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return +value;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !m[0]) throw new Error('Use a valid YouTube timestamp, such as 90 or 1m30s.');
  return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
}
export function youtubeTrack(value) {
  const embed = new URL(youtubeEmbed(value)), url = new URL(value.trim());
  const video = embed.pathname.split('/').pop();
  const start = seconds(url.searchParams.get('start') || url.searchParams.get('t') || url.hash.match(/^#t=(.+)$/)?.[1]);
  const end = seconds(url.searchParams.get('end'));
  if (end && end <= start) throw new Error('The end timestamp must be after the start.');
  const rawIndex = url.searchParams.get('index');
  if (rawIndex && !/^[1-9]\d{0,4}$/.test(rawIndex)) throw new Error('Use a playlist index of 1 or higher.');
  return { videoId: video === 'videoseries' ? null : video, list: embed.searchParams.get('list'), index: rawIndex ? +rawIndex - 1 : 0, start, end };
}

let api;
function youtubeAPI() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  return api ||= new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { api = null; reject(new Error('YouTube could not connect. Check your connection or blocker, or open the video on YouTube.')); }, 15000);
    const previous = globalThis.onYouTubeIframeAPIReady;
    globalThis.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout); previous?.(); resolve(globalThis.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); api = null; script.remove(); reject(new Error('YouTube is blocked or offline. Open the video on YouTube, or try again.')); };
    document.head.append(script);
  });
}

// The official IFrame API keeps the visible player, game volume, and scene cues
// in sync. Every callback checks ownership, including callbacks arriving late.
export class YouTubePlayer {
  constructor(slot, onStatus) { this.slot = slot; this.onStatus = onStatus; this.generation = 0; }
  play(url, { single = true, label = 'YouTube soundtrack' } = {}) {
    const track = youtubeTrack(url), key = JSON.stringify([track, single]);
    if (this.key === key && !this.failed) return;
    this.stop();
    this.key = key; this.label = label; this.url = url; this.track = track; this.single = single;
    const generation = this.generation;
    const frame = document.createElement('iframe');
    frame.id = 'youtube-player'; frame.title = label;
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const embed = new URL(youtubeEmbed(url));
    if (single && track.videoId) embed.searchParams.delete('list');
    embed.searchParams.set('enablejsapi', '1'); embed.searchParams.set('origin', location.origin);
    embed.searchParams.set('autoplay', '1'); embed.searchParams.set('start', track.start);
    if (track.end) embed.searchParams.set('end', track.end);
    if (track.list && !track.videoId) embed.searchParams.set('index', track.index);
    frame.src = embed.href; this.slot.replaceChildren(frame);
    this.onStatus(`Loading ${label}. If playback is blocked, press play in the YouTube player.`);
    youtubeAPI().then(YT => {
      if (generation !== this.generation) return;
      const owns = () => generation === this.generation;
      this.player = new YT.Player(frame, { events: {
        onReady: event => {
          if (!owns()) return;
          this.player = event.target; this.ready = true; this.applyVolume();
          if (!this.enabled) this.player.pauseVideo();
        },
        onAutoplayBlocked: () => owns() && this.onStatus(`Press play in the YouTube player to start ${label}.`),
        onStateChange: event => {
          if (!owns()) return;
          if (event.data === 1) {
            // Convert a fixed playlist entry to a single looping video. A normal
            // manually loaded playlist retains its original order.
            if (single && !track.videoId) {
              const id = event.target.getPlaylist?.()?.[track.index];
              if (!id) { this.onStatus('This playlist entry is unavailable. Replace its scene link.'); event.target.pauseVideo(); return; }
              track.videoId = id;
              event.target.loadVideoById({ videoId: id, startSeconds: track.start, ...(track.end ? { endSeconds: track.end } : {}) });
            }
            this.applyVolume();
            if (!this.enabled) event.target.pauseVideo();
            else this.onStatus(`Playing ${label}.`);
          } else if (event.data === 0 && single && this.enabled) {
            event.target.seekTo(track.start, true); event.target.playVideo();
          } else if (event.data === 2) this.onStatus(`Paused: ${label}. Press play in the YouTube player to resume.`);
        },
        onError: event => {
          if (!owns()) return;
          this.failed = true;
          this.onStatus(`YouTube cannot play ${label} (error ${event.data}). Open it on YouTube or replace this scene's link.`);
        },
      } });
    }).catch(error => { if (generation === this.generation) { this.failed = true; this.onStatus(error.message); } });
  }
  setVolume(volume, enabled) {
    const changed = this.enabled !== undefined && this.enabled !== enabled;
    this.volume = volume; this.enabled = enabled; this.applyVolume();
    if (this.ready && changed) enabled ? this.player.playVideo() : this.player.pauseVideo();
  }
  applyVolume() {
    if (!this.ready) return;
    this.player.setVolume(this.volume ?? 70);
    if (this.enabled === false) this.player.mute(); else this.player.unMute();
  }
  stop() {
    this.generation++;
    this.ready = false; this.key = null; this.failed = false;
    this.player?.destroy(); this.player = null;
    this.slot.replaceChildren();
  }
}
