"""Exploration helper: print printable strings with offsets, or hex+u32 view of a range."""
import re
import struct
import sys

path, mode = sys.argv[1], sys.argv[2]
d = open(path, 'rb').read()
if mode == 'str':
    lo = int(sys.argv[3], 0) if len(sys.argv) > 3 else 0
    hi = int(sys.argv[4], 0) if len(sys.argv) > 4 else len(d)
    for m in re.finditer(rb'[\x20-\x7e]{4,}', d[lo:hi]):
        o = lo + m.start()
        pre = struct.unpack('<I', d[o - 4:o])[0] if o >= 4 else -1
        print(hex(o), pre, m.group().decode())
elif mode == 'u32':
    lo, n = int(sys.argv[3], 0), int(sys.argv[4], 0)
    vals = struct.unpack_from('<%di' % n, d, lo)
    for i in range(0, n, 8):
        print(hex(lo + i * 4), ' '.join('%6d' % v for v in vals[i:i + 8]))
