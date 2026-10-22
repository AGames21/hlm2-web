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
