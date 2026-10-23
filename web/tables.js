// Decoders for the GL/*.bin tables and AGTEXTUREPACKER .meta files.
// Layouts were worked out by inspection; tools/*.py hold the Python twins.
//
// Common table layout: u32 n, i32 lookup[n] (id -> record index), u32 count,
// fixed-size i32 records, then u32 strtab_size + null-terminated names.

const utf8 = new TextDecoder();

function cstr(u8, o) {
  let e = o;
  while (u8[e]) e++;
  return utf8.decode(u8.subarray(o, e));
}

function table(buf, words) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const lookup = new Int32Array(buf.slice(4, 4 + 4 * n));
  let o = 4 + 4 * n;
  const count = dv.getUint32(o, true);
  o += 4;
  const recs = [];
  for (let i = 0; i < count; i++, o += 4 * words) {
    const r = [];
    for (let k = 0; k < words; k++) r.push(dv.getInt32(o + 4 * k, true));
    recs.push(r);
  }
  const size = dv.getUint32(o, true);
  const tab = new Uint8Array(buf, o + 4, size);
  return { lookup, recs, name: off => cstr(tab, off) };
}

function byId(lookup, list) {
  return id => (id >= 0 && id < lookup.length && lookup[id] >= 0 ? list[lookup[id]] : null);
}

// Assets/hlm2_localization.bin: u32 sections, then per section u32 index,
// u32 name length, name ("String IDs", "English", ...), u32 language id,
// u32 count, count u32 offsets, u32 blob size, null-terminated strings.
// Returns the strings of one language, indexed like LOC_STR_<n> (the game's
// string ids). The text stays in the player's own wad.
export function localization(buf, lang = 'English') {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const sections = dv.getUint32(0, true);
  let o = 4;
  for (let s = 0; s < sections && o < buf.byteLength; s++) {
    const n = dv.getUint32(o + 4, true), name = utf8.decode(u8.subarray(o + 8, o + 8 + n));
    o += 8 + n;
    const count = dv.getUint32(o + 4, true), offs = o + 8, blob = offs + 4 * count + 4;
    if (name === lang) return Array.from({ length: count }, (_, i) => cstr(u8, blob + dv.getUint32(offs + 4 * i, true)));
    o = blob + dv.getUint32(offs + 4 * count, true);
  }
  return [];
}

// 16 words: id, w, h, origin x, origin y, bbox left, right, top, bottom,
// frame count, ..., name offset at 14.
export function sprites(buf) {
  const t = table(buf, 16);
  const list = t.recs.map(r => ({
    id: r[0], w: r[1], h: r[2], ox: r[3], oy: r[4], name: t.name(r[14]),
    bbox: { l: r[5], r: r[6], t: r[7], b: r[8] }, frames: r[9],
  }));
  return { list, get: byId(t.lookup, list) };
}

// 11 words: id, sprite id, depth, parent, mask sprite (-1 = the sprite),
// solid, visible, ?, ?, ?, name offset.
export function objects(buf) {
  const t = table(buf, 11);
  const list = t.recs.map(r => ({
    id: r[0], sprite: r[1], depth: r[2], parent: r[3], mask: r[4], solid: r[5], visible: r[6], name: t.name(r[10]),
  }));
  return { list, get: byId(t.lookup, list) };
}

// 8 words: id, name offset, ?, tile w, tile h, tileset flag, image w, image h.
export function backgrounds(buf) {
  const t = table(buf, 8);
  const list = t.recs.map(r => ({ id: r[0], name: t.name(r[1]), tw: r[3], th: r[4], w: r[6], h: r[7] }));
  return { list, get: byId(t.lookup, list) };
}

// u32 n, i32 lookup[n], u32 c, i32 order[c], u32 room_count, rooms, strtab.
// Room: 20-byte header (u16 id, w, h, speed, ?, ?, u32 colour BGR, ...),
// 8 views * 28 bytes, u32 nt + nt * 16-byte tiles, u32 ni + ni * 12-byte
// instances, u32 8 + 8 * 20-byte backgrounds, u32 name offset.
export function rooms(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const lookup = new Int32Array(buf.slice(4, 4 + 4 * n));
  let o = 4 + 4 * n;
  // The second array is the room order room_goto_next walks.
  const c = dv.getUint32(o, true);
  const order = [...new Int32Array(buf.slice(o + 4, o + 4 + 4 * c))];
  o += 4 + 4 * c;
  const count = dv.getUint32(o, true);
  o += 4;
  const list = [];
  for (let i = 0; i < count; i++) {
    const room = {
      id: dv.getUint16(o, true), w: dv.getUint16(o + 2, true), h: dv.getUint16(o + 4, true),
      colour: dv.getUint32(o + 12, true), tiles: [], insts: [],
    };
    o += 20 + 224;
    const nt = dv.getUint32(o, true);
    o += 4;
    for (let k = 0; k < nt; k++, o += 16) {
      room.tiles.push({
        x: dv.getInt16(o, true), y: dv.getInt16(o + 2, true), bg: dv.getUint16(o + 4, true),
        sx: dv.getUint16(o + 6, true), sy: dv.getUint16(o + 8, true),
        w: dv.getUint16(o + 10, true), h: dv.getUint16(o + 12, true), depth: dv.getInt16(o + 14, true),
      });
    }
    const ni = dv.getUint32(o, true);
    o += 4;
    for (let k = 0; k < ni; k++, o += 12) {
      room.insts.push({ id: dv.getUint16(o, true), obj: dv.getUint16(o + 6, true), x: dv.getInt16(o + 8, true), y: dv.getInt16(o + 10, true) });
    }
    o += 4 + 160;
    room.nameOff = dv.getUint32(o, true);
    o += 4;
    list.push(room);
  }
  const size = dv.getUint32(o, true);
  const tab = new Uint8Array(buf, o + 4, size);
  for (const r of list) r.name = cstr(tab, r.nameOff);
  return { list, get: byId(lookup, list), order };
}

// u32 n, i32 name_off[n], u32 strtab_size + names, u32 m, i32 room_id -> name index.
export function levelAtlases(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const offs = new Int32Array(buf.slice(4, 4 + 4 * n));
  let o = 4 + 4 * n;
  const size = dv.getUint32(o, true);
  const tab = new Uint8Array(buf, o + 4, size);
  const names = [...offs].map(x => cstr(tab, x));
  o += 4 + size;
  const m = dv.getUint32(o, true);
  const lookup = new Int32Array(buf.slice(o + 4, o + 4 + 4 * m));
  return roomId => (roomId < lookup.length && lookup[roomId] >= 0 ? names[lookup[roomId]] : null);
}

// u8-length "AGTEXTUREPACKER", u32 version, u32 count, then entries of
// u8-length name, u32 frames, frames of (i32 page, w, h, x, y, f32 u0 v0 u1 v1).
export function meta(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let o = 0;
  const str = () => {
    const s = utf8.decode(u8.subarray(o + 1, o + 1 + u8[o]));
    o += 1 + u8[o];
    return s;
  };
  if (str() !== 'AGTEXTUREPACKER') throw new Error('bad .meta');
  o += 8;
  const out = new Map();
  while (o < buf.byteLength) {
    const name = str();
    const nf = dv.getUint32(o, true);
    o += 4;
    const frames = [];
    for (let k = 0; k < nf; k++, o += 36) {
      frames.push({ w: dv.getInt32(o + 4, true), h: dv.getInt32(o + 8, true), x: dv.getInt32(o + 12, true), y: dv.getInt32(o + 16, true) });
    }
    out.set(name, frames);
  }
  return out;
}

// hlm2_collision_masks.bin: u32 n, then per sprite u32 sprite id, row bytes,
// w, h, frames, followed by frames * h rows of 1-bit pixels (high bit first).
// Sprites without an entry collide with their bounding box.
export function collisionMasks(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const masks = new Map();
  for (let i = 0, o = 4; i < n; i++) {
    const [id, stride, w, h, frames] = [0, 1, 2, 3, 4].map(k => dv.getUint32(o + 4 * k, true));
    o += 20;
    masks.set(id, { stride, w, h, frames, bits: new Uint8Array(buf, o, stride * h * frames) });
    o += stride * h * frames;
  }
  return masks;
}

// hlm2_sounds.bin, 6 words: id, ?, name offset, volume * INT_MAX, ?, ?.
// The file is Sounds/<name>.wav in the data wad (one .mp3).
export function sounds(buf) {
  const t = table(buf, 6);
  const byName = new Map();
  for (const r of t.recs) byName.set(t.name(r[2]), { id: r[0], volume: r[3] / 0x7fffffff });
  return byName;
}
