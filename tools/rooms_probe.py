import struct
import sys

d = open(sys.argv[1], 'rb').read()
n, = struct.unpack_from('<I', d, 0)
o = 4 + 4 * n
c, = struct.unpack_from('<I', d, o)
o += 4 + 4 * c
rooms, = struct.unpack_from('<I', d, o)
o += 4
print('rooms', rooms)
for i in range(rooms):
    start = o
    a, w, h, spd = struct.unpack_from('<4H', d, o)
    o += 20 + 224
    nt, = struct.unpack_from('<I', d, o)
    o += 4 + 16 * nt
    ni, = struct.unpack_from('<I', d, o)
    o += 4 + 12 * ni
    nb, = struct.unpack_from('<I', d, o)
    if nb != 8:
        print('room', i, 'at', hex(start), 'bad bg count', nb, 'hdr', a, w, h, spd, 'inst', ni)
        print(d[o - 24:o + 96].hex(' ', 2))
        break
    o += 4 + 160
    extra, = struct.unpack_from('<I', d, o)
    o += 4
    if i < 6 or i % 40 == 0:
        print(i, hex(start), 'a', a, w, 'x', h, 'tiles', nt, 'inst', ni, 'extra', extra)
print('end', hex(o), 'of', hex(len(d)))
