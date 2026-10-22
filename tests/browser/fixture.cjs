// Authored test assets and metadata, not extracts from Hotline Miami 2.
const { deflateSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const i32 = (...values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b; };
const sized = b => Buffer.concat([i32(b.length), b]);
const string = s => sized(Buffer.from(s));
const shortString = s => Buffer.concat([Buffer.from([Buffer.byteLength(s)]), Buffer.from(s)]);

function archive(files) {
  const header = Buffer.alloc(20); header.write('AGAR'); header.writeUInt32LE(1, 4); header.writeUInt32LE(files.length, 16);
  let offset = 0;
  const index = files.map(([name, bytes]) => {
    const record = Buffer.alloc(16); record.writeBigUInt64LE(BigInt(bytes.length)); record.writeBigUInt64LE(BigInt(offset), 8); offset += bytes.length;
    return Buffer.concat([string(name), record]);
  });
  return Buffer.concat([header, ...index, i32(0), ...files.map(([, bytes]) => bytes)]);
}

function table(records, nameIndex) {
  let offset = 0;
  const names = records.map(([name]) => { const b = Buffer.from(name + '\0'); const at = offset; offset += b.length; return { b, at }; });
  const rows = records.map(([, row], id) => { const values = [...row]; values[nameIndex] = names[id].at; return i32(...values); });
  return Buffer.concat([i32(records.length, ...records.map((_, i) => i), records.length), ...rows, sized(Buffer.concat(names.map(n => n.b)))]);
}

function crc32(bytes) {
  let c = -1;
  for (const value of bytes) { c ^= value; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); }
  return (c ^ -1) >>> 0;
}
function png(width, height) {
  const chunk = (name, data) => {
    const type = Buffer.from(name), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc((1 + width * 4) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = y * (1 + width * 4) + 1 + x * 4;
    const colour = x < 16 ? ((x >> 3) + (y >> 3)) % 2 ? [160, 130, 80] : [80, 60, 30] : [x % 3 * 80 + 60, 150, 200];
    pixels.set([...colour, 255], at);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

const spriteNames = ['sprPigWalkUnarmed', 'sprPigAttackPunch', 'sprPigKillStomp', 'sprWeaponMask', 'sprTargetIdle', 'sprTargetWalk', 'sprTargetGetUp', 'sprTargetKillStomp', 'sprMask', 'sprArrow', 'sprBat', 'sprPigWalkBat', 'sprPigAttackBat', 'spr9mm', 'sprPigWalk9mm', 'sprPigAttack9mm'];
const roomNames = ['rmTutorialFloor1', 'rmTutorialFloor2', 'rmFansLevel1Floor1', 'rmFansLevel1Floor2', 'rmFansHeadQuarters', 'rmPizzaPlace'];
function spriteFrames(name) { return /Attack|Kill|GetUp/.test(name) ? 8 : 1; }

function rooms() {
  let nameOffset = 0;
  const names = [], records = roomNames.map((name, id) => {
    const header = Buffer.alloc(244); header.writeUInt16LE(id); header.writeUInt16LE(480, 2); header.writeUInt16LE(270, 4); header.writeUInt16LE(60, 6); header.writeUInt32LE(0x333333, 12);
    const tiles = [];
    for (let y = 0; y < 270; y += 16) for (let x = 0; x < 480; x += 16) {
      const tile = Buffer.alloc(16); tile.writeInt16LE(x); tile.writeInt16LE(y, 2); tile.writeUInt16LE(16, 10); tile.writeUInt16LE(16, 12); tile.writeInt16LE(100, 14); tiles.push(tile);
    }
    // The second floor deliberately has no player instance.
    const instances = [[3, 160, 135], [4, 440, 135], [6, 300, 90], [8, 100, 170], [9, 125, 170]];
    if (id !== 1) instances.unshift([1, 100, 135]);
    const instanceBytes = instances.map(([obj, x, y], index) => { const b = Buffer.alloc(12); b.writeUInt16LE(index); b.writeUInt16LE(obj, 6); b.writeInt16LE(x, 8); b.writeInt16LE(y, 10); return b; });
    const backgrounds = Buffer.alloc(164); backgrounds.writeUInt32LE(8);
    const nameBytes = Buffer.from(name + '\0'); const at = nameOffset; nameOffset += nameBytes.length; names.push(nameBytes);
    return Buffer.concat([header, i32(tiles.length), ...tiles, i32(instances.length), ...instanceBytes, backgrounds, i32(at)]);
  });
  const ids = roomNames.map((_, id) => id);
  return Buffer.concat([i32(ids.length, ...ids, ids.length, ...ids, ids.length), ...records, sized(Buffer.concat(names))]);
}

function metadata() {
  const entries = [...spriteNames.map((name, id) => ({ name, x: 16 + id * 12, w: 8, h: 8, count: spriteFrames(name) })), { name: 'Backgrounds/bgFloor', x: 0, w: 16, h: 16, count: 1 }];
  const bytes = entries.map(e => {
    const frame = Buffer.alloc(36); frame.writeInt32LE(e.w, 4); frame.writeInt32LE(e.h, 8); frame.writeInt32LE(e.x, 12);
    return Buffer.concat([shortString(e.name), i32(e.count), ...Array.from({ length: e.count }, () => frame)]);
  });
  return Buffer.concat([shortString('AGTEXTUREPACKER'), i32(1, entries.length), ...bytes]);
}

function wav() {
  const rate = 8000, count = 800, bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(2000 * Math.sin(i * Math.PI / 10)), 44 + i * 2);
  return bytes;
}

function dataWad() {
  const spriteRows = spriteNames.map((name, id) => [name, [id, 8, 8, 4, 4, 0, 7, 0, 7, spriteFrames(name), 0, 0, 0, 0, 0, 0]]);
  const objectNames = ['objPlayer', 'objPigButcher', 'objEnemy', 'objTarget', 'objNextroom', 'objSolid', 'objWall', 'objWeapon', 'objBat', 'obj9mm'];
  const sprites = [-1, 0, -1, 4, 8, -1, 8, -1, 10, 13], parents = [-1, 0, -1, 2, -1, -1, 5, -1, 7, 7];
  const objectRows = objectNames.map((name, id) => [name, [id, sprites[id], id === 4 ? -101 : 0, parents[id], sprites[id], id === 6 ? 1 : 0, 1, 0, 0, 0, 0]]);
  const sounds = ['sndSwing1', 'sndSwing2', 'sndPunch', 'sndHit', 'sndWeaponPickup', 'sndWeaponThrow', 'snd9mm'];
  return archive([
    ['GL/hlm2_sprites.bin', table(spriteRows, 14)], ['GL/hlm2_objects.bin', table(objectRows, 10)],
    ['GL/hlm2_backgrounds.bin', table([['bgFloor', [0, 0, 0, 16, 16, 1, 16, 16]]], 1)],
    ['GL/hlm2_rooms.bin', rooms()], ['GL/hlm2_level_atlases.bin', Buffer.concat([i32(1, 0), sized(Buffer.from('Fixture\0')), i32(roomNames.length, ...roomNames.map(() => 0))])],
    ['GL/hlm2_collision_masks.bin', i32(0)], ['GL/hlm2_sounds.bin', table(sounds.map((name, id) => [name, [id, 0, 0, 0x7fffffff, 0, 0]]), 2)],
    ['Atlases/Levels/Fixture.meta', metadata()], ['Atlases/Levels/Fixture.png', png(224, 32)],
    ...sounds.map(name => ['Sounds/' + name + '.wav', wav()]),
  ]);
}

function musicWad() {
  const ogg = execFileSync(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=0.2', '-c:a', 'libvorbis', '-f', 'ogg', 'pipe:1']);
  return archive([['Music/Test.ogg', ogg]]);
}
module.exports = { dataWad, musicWad, roomNames };
