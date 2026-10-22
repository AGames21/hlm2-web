// Cue names are the game's Music/<name>.ogg names, shared by menus and levels.
// Sources and current verification limits are recorded in docs/music-sources.md.
export const SOUNDTRACK = Object.fromEntries([
  ['beams', 'Beams', 'Tape'], ['Detection', 'Detection', 'Prey Growl'],
  ['Blizzard', 'Blizzard', 'Light Club'], ['voyager', 'Voyager', 'Jasper Byrne'],
  ['Disturbance', 'Disturbance', 'Endless'], ['Technoir', 'Technoir', 'Perturbator'],
  ['MiamiJam', 'Miami Jam', 'Riddarna'], ['Divide', 'Divide (Miami Edit)', 'Magna'],
  ['Videodrome', 'Videodrome (game cue; title unverified)', ''], ['Interlude', 'Interlude', 'Chromacle'],
  ['NewWave', 'Neu Wave Hookers', 'Vestron Vulture'], ['evil', 'In the Face of Evil', 'Magic Sword'],
  ['Hideout', 'Hideout (game cue; title unverified)', ''], ['Remorse', 'Remorse', 'Scattle'],
  ['Sexualizer', 'Sexualizer', 'Perturbator'], ['Java', 'Java', 'Old Future Fox Gang'],
  ['Rust', 'Rust', 'El Huervo'], ['Delay', 'Delay', 'M|O|O|N'],
  ['Bloodline', 'Bloodline', 'Scattle'], ['HollywoodHeights', 'Hollywood Heights', 'Mitch Murder'],
  ['RollerMobster', 'Roller Mobster', 'Carpenter Brut'], ['Around', 'Around', 'Modulogeek'],
  ['Run', 'Run', 'IAMTHEKIDYOUKNOWWHATIMEAN'], ['HotlineTheme', 'Hotline Miami Theme', 'Benny Smiles'],
  ['Quixotic', 'Quixotic', 'M|O|O|N'], ['WayHome', 'The Way Home', 'Magic Sword'],
  ['Dubmood', 'Richard', 'Dubmood'], ['NARC', 'NARC', 'Mega Drive'],
  ['Rumble', 'The Rumble', 'Cinimod'], ['MsMinnie', 'Ms. Minnie', 'Auto Delta Time'],
  ['BurningCoals', 'She Swallowed Burning Coals', 'El Tigr3'], ['SlumLord', 'Slum Lord', 'Mega Drive'],
  ['FutureClub', 'Future Club', 'Perturbator'], ['GuidedMeditation', 'Guided Meditation', 'Old Future Fox Gang'],
  ['AbyssIntro', 'The Abyss', 'LipPi Sound'],
].map(([cue, title, artist]) => [cue, { title, artist }]));

export const SOUNDTRACK_MIX = 'https://www.youtube.com/watch?v=dEFcpyy_vq8';
export const BUILTIN_SOURCES = {
  evil: 'https://www.youtube.com/watch?v=-h5snZTfoEA',
  // A published playlist's documented order supplies these two entries. The
  // player resolves the selected entry to one video so it loops that song only.
  RollerMobster: 'https://www.youtube.com/playlist?list=PL1M4SFkXjuhhxIIELResZTZMJTX6fM35v&index=5',
  BurningCoals: 'https://www.youtube.com/playlist?list=PL1M4SFkXjuhhxIIELResZTZMJTX6fM35v&index=3',
};
export function trackLabel(cue) {
  const track = SOUNDTRACK[cue];
  return track ? `${track.artist ? track.artist + ' — ' : ''}${track.title}` : cue || 'Silence';
}
export function trackSearch(cue) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`Hotline Miami 2 ${trackLabel(cue)} soundtrack`);
}

// Transport-independent routing: a scene cue never changes a manually chosen
// video, and the same song persists across floors/restarts without seeking.
export class SceneSoundtrack {
  constructor({ player, sources = {}, onChange = () => {} }) {
    this.player = player;
    this.sources = { ...BUILTIN_SOURCES, ...sources };
    this.onChange = onChange;
    this.mode = 'local';
    this.cue = null;
  }
  request(cue) {
    this.cue = cue;
    if (this.mode === 'scene') this.follow();
    this.onChange();
    return this.mode !== 'local';
  }
  enable(cue = this.cue) {
    this.mode = 'scene'; this.cue = cue; this.follow(); this.onChange();
  }
  follow() {
    const url = this.cue && this.sources[this.cue];
    if (url) this.player.play(url, { single: true, label: trackLabel(this.cue) });
    else this.player.stop();
  }
  assign(cue, url) {
    if (!Object.hasOwn(SOUNDTRACK, cue)) throw new Error('Choose a soundtrack cue.');
    this.sources[cue] = url;
    if (this.mode === 'scene' && cue === this.cue) this.follow();
    this.onChange();
  }
  manual(url) {
    this.mode = 'manual'; this.player.play(url, { single: false, label: 'YouTube soundtrack' }); this.onChange();
  }
  stop() { this.mode = 'local'; this.player.stop(); this.onChange(); }
}
