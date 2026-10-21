"""Decoders for the HLM2 GL/*.bin tables (work in progress, built by inspection).

Common layout: u32 lookup_len, i32 lookup[lookup_len], u32 count,
fixed-size records, then u32 strtab_size + null-terminated names.
Each record holds a u32 offset into that string table.
"""
import struct


def _strtab(d, off):
    size, = struct.unpack_from('<I', d, off)
    return d[off + 4:off + 4 + size], off + 4 + size


def _name(tab, o):
    return tab[o:tab.index(b'\0', o)].decode('utf-8')


def _table(d, rec_words):
    n, = struct.unpack_from('<I', d, 0)
    lookup = list(struct.unpack_from('<%di' % n, d, 4))
    off = 4 + 4 * n
    count, = struct.unpack_from('<I', d, off)
    off += 4
    recs = [struct.unpack_from('<%di' % rec_words, d, off + i * rec_words * 4) for i in range(count)]
    tab, end = _strtab(d, off + count * rec_words * 4)
    return lookup, recs, tab, end


def sprites(d):
    lookup, recs, tab, _ = _table(d, 16)
    out = []
    for r in recs:
        out.append(dict(name=_name(tab, r[14]), id=r[0], w=r[1], h=r[2], ox=r[3], oy=r[4],
                        raw=r[5:14]))
    return lookup, out


def objects(d):
    lookup, recs, tab, _ = _table(d, 11)
    out = []
    for r in recs:
        out.append(dict(name=_name(tab, r[10]), raw=r[:10]))
    return lookup, out
