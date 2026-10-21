"""Read and extract Hotline Miami 2 AGAR .wad archives.

Layout (little endian):
  "AGAR" u32 major, u32 minor, u32 extra_len, extra bytes
  u32 file_count, then per file: u32 name_len, name, u64 size, u64 offset
  u32 dir_count, directory table (ignored here)
  file data; offsets are relative to the end of the tables.
"""
import os
import struct
import sys


def read_index(path):
    with open(path, 'rb') as f:
        if f.read(4) != b'AGAR':
            raise ValueError('not an AGAR wad: ' + path)
        _major, _minor, extra = struct.unpack('<III', f.read(12))
        f.read(extra)
        count, = struct.unpack('<I', f.read(4))
        files = []
        for _ in range(count):
            n, = struct.unpack('<I', f.read(4))
            name = f.read(n).decode('utf-8')
            size, off = struct.unpack('<QQ', f.read(16))
            files.append((name, size, off))
        # Directory table: u32 count, then u32 name_len, name, u32 entry_count,
        # entries of (u32 name_len, name, u8 type).
        dirs, = struct.unpack('<I', f.read(4))
        for _ in range(dirs):
            n, = struct.unpack('<I', f.read(4))
            f.read(n)
            entries, = struct.unpack('<I', f.read(4))
            for _ in range(entries):
                n, = struct.unpack('<I', f.read(4))
                f.read(n + 1)
        return files, f.tell()


def extract(path, out_dir, pattern=None):
    files, base = read_index(path)
    with open(path, 'rb') as f:
        for name, size, off in files:
            if pattern and pattern not in name:
                continue
            dest = os.path.join(out_dir, name)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            f.seek(base + off)
            with open(dest, 'wb') as o:
                o.write(f.read(size))
    return len(files)


if __name__ == '__main__':
    wad, out = sys.argv[1], sys.argv[2]
    pat = sys.argv[3] if len(sys.argv) > 3 else None
    print(extract(wad, out, pat), 'files in index')
