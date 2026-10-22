// A recording implementation of the documented IFrame API. This deliberately
// does not stream real media: live YouTube is blocked in the cloud environment.
module.exports = `
window.__youtubePlayers = [];
window.YT = { Player: class {
  constructor(frame, options) {
    this.frame = frame; this.events = options.events; this.calls = [];
    this.video = new URL(frame.src).pathname.split('/').pop();
    window.__youtubePlayers.push(this);
    queueMicrotask(() => { this.events.onReady({ target: this }); this.events.onStateChange({ target: this, data: 1 }); });
  }
  setVolume(v) { this.volume = v; this.calls.push(['volume', v]); }
  mute() { this.muted = true; } unMute() { this.muted = false; }
  playVideo() { this.calls.push(['play']); } pauseVideo() { this.calls.push(['pause']); }
  seekTo(t) { this.calls.push(['seek', t]); }
  getPlaylist() { return ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee']; }
  loadVideoById(value) { this.video = value.videoId; this.calls.push(['load', value]); }
  destroy() { this.destroyed = true; this.frame.remove(); }
} };
window.onYouTubeIframeAPIReady?.();
`;
