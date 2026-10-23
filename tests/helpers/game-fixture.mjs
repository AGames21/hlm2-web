// Synthetic table/atlas metadata. No proprietary game files are needed to
// exercise the actual simulation, input handlers, and floor handoff.
import { play } from '../../web/game.js';

const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.removeEventListener = events.removeEventListener.bind(events);

class Canvas extends EventTarget {
  constructor(width = 480, height = 270) { super(); this.width = width; this.height = height; this.style = {}; }
  getContext() { return { drawImage() {} }; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
}
globalThis.OffscreenCanvas = Canvas;

export async function fixture({ punch = true, getUp = true, getUpFrames = 6, execution = true, weapons = false, carry = null, roomName = 'rmTutorialFloor2', canvas = new Canvas(), next, kind = 'objTarget', prefix = 'sprTarget', configure } = {}) {
  const names = ['sprPigWalkUnarmed', 'sprWeaponMask', prefix + 'Idle', prefix + 'Walk'];
  if (punch) names.push('sprPigAttackPunch');
  if (getUp) names.push(prefix + 'GetUp');
  if (execution) names.push('sprPigKillStomp', prefix + 'KillStomp');
  if (weapons) names.push('sprPigWalkBat', 'sprPigAttackBat', 'sprBat', 'sprPigWalk9mm', 'sprPigAttack9mm', 'spr9mm');
  const sprites = names.map((name, id) => ({ id, name, ox: 4, oy: 4, w: 8, h: 8, bbox: { l: 0, r: 7, t: 0, b: 7 } }));
  const objects = [
    { id: 0, name: 'objPlayer', sprite: -1, parent: -1, mask: -1, depth: 0 },
    { id: 1, name: 'objPigButcher', sprite: 0, parent: 0, mask: 0, depth: 0 },
    { id: 2, name: 'objEnemy', sprite: -1, parent: -1, mask: -1, depth: 0 },
    { id: 3, name: kind, sprite: 2, parent: 2, mask: 2, depth: 0 },
  ];
  const G = {
    sprites: { list: sprites, get: id => sprites[id] },
    objects: { list: objects, get: id => objects[id] },
    masks: new Map(),
  };
  const room = { id: 0, name: roomName, w: 480, h: 270, colour: 0, insts: [{ id: 10, obj: 3, x: 400, y: 200 }] };
  if (roomName === 'rmTutorialFloor1') room.insts.push({ id: 11, obj: 1, x: 240, y: 135 });
  const frameCounts = new Map();
  const addSprite = (name, count = 8) => {
    const id = sprites.length; names.push(name); frameCounts.set(name, count);
    sprites.push({ ...sprites[0], id, name, bbox: { ...sprites[0].bbox } }); return id;
  };
  configure?.({ sprites, objects, room, addSprite });
  const env = {
    G, room, canvas, carry, character: carry?.character, next, items: [], imgs: new Map(), zoom: 1, autostart: false, status() {},
    load: async () => {},
    frames(name) {
      if (!names.includes(name)) return null;
      const length = frameCounts.get(name) ?? (name.endsWith('GetUp') ? getUpFrames : /Attack|Kill/.test(name) ? 8 : 1);
      return { atlas: 'fixture', frames: Array.from({ length }, () => ({ x: 0, y: 0, w: 8, h: 8 })) };
    },
  };
  const game = await play(env);
  if (game.enemies[0]) Object.assign(game.enemies[0], { x: game.player.x + 12, y: game.player.y });
  return { game, canvas, env };
}

export function mouse(canvas, button = 0) {
  const event = new Event('mousedown');
  Object.assign(event, { button, clientX: 400, clientY: 135 });
  canvas.dispatchEvent(event);
}
