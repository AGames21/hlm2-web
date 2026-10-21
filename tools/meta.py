"""AGTEXTUREPACKER .meta parser (layout found by inspection)."""
import struct
import sys


def parse(d):
    o = 0

    def s():
        nonlocal o
        n = d[o]
        v = d[o + 1:o + 1 + n].decode('utf-8')
        o += 1 + n
        return v

    magic = s()
    assert magic == 'AGTEXTUREPACKER', magic
    ver, count = struct.unpack_from('<II', d, o)
    o += 8
    out = {}
    while o < len(d):
        name = s()
        nf, = struct.unpack_from('<I', d, o)
        o += 4
        frames = []
        for _ in range(nf):
            frames.append(struct.unpack_from('<5i4f', d, o))
            o += 36
        out[name] = frames
    return ver, count, out


if __name__ == '__main__':
    ver, count, sprites = parse(open(sys.argv[1], 'rb').read())
    print('ver', ver, 'count', count, 'sprites', len(sprites))
    for k, v in list(sprites.items())[:int(sys.argv[2]) if len(sys.argv) > 2 else 5]:
        print(k, len(v), v[0][:5], ['%.4f' % x for x in v[0][5:]])
