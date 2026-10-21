// Reader for Hotline Miami 2 AGAR .wad archives, working on a Blob so the
// 94 MB data wad never has to sit in memory as one ArrayBuffer.
//
// Layout (little endian):
//   "AGAR" u32 major, u32 minor, u32 extra_len, extra bytes
//   u32 file_count, then per file: u32 name_len, name, u64 size, u64 offset
//   u32 dir_count, then per dir: u32 name_len, name, u32 n, n * (u32 len, name, u8 type)
//   file data; offsets are relative to the end of the tables.

const utf8 = new TextDecoder();

export class Wad {
  static async open(blob) {
    let head = 1 << 20;
    for (;;) {
      const buf = await blob.slice(0, Math.min(head, blob.size)).arrayBuffer();
      try {
        return new Wad(blob, buf);
      } catch (e) {
        if (!(e instanceof RangeError) || head >= blob.size) throw e;
        head *= 4;
      }
    }
  }

  constructor(blob, buf) {
    const dv = new DataView(buf);
    if (utf8.decode(new Uint8Array(buf, 0, 4)) !== 'AGAR') throw new Error('not an AGAR wad');
    let o = 16 + dv.getUint32(12, true);
    const str = () => {
      const n = dv.getUint32(o, true);
      const s = utf8.decode(new Uint8Array(buf, o + 4, n));
      o += 4 + n;
      return s;
    };
    this.blob = blob;
    this.files = new Map();
    const count = dv.getUint32(o, true);
    o += 4;
    for (let i = 0; i < count; i++) {
      const name = str();
      const size = Number(dv.getBigUint64(o, true));
      const off = Number(dv.getBigUint64(o + 8, true));
      o += 16;
      this.files.set(name, { size, off });
    }
    const dirs = dv.getUint32(o, true);
    o += 4;
    for (let i = 0; i < dirs; i++) {
      str();
      const n = dv.getUint32(o, true);
      o += 4;
      for (let j = 0; j < n; j++) { str(); o += 1; }
    }
    if (o > buf.byteLength) throw new RangeError('index past header chunk');
    this.base = o;
  }

  has(name) { return this.files.has(name); }

  names(prefix = '') { return [...this.files.keys()].filter(n => n.startsWith(prefix)); }

  slice(name) {
    const f = this.files.get(name);
    if (!f) throw new Error('missing in wad: ' + name);
    return this.blob.slice(this.base + f.off, this.base + f.off + f.size);
  }

  async bytes(name) { return this.slice(name).arrayBuffer(); }
}
