type ZipEntry = { name: string; data: Buffer };

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const hdr = Buffer.alloc(30 + nameBytes.length);
    hdr.writeUInt32LE(0x04034b50, 0);
    hdr.writeUInt16LE(20, 4);
    hdr.writeUInt16LE(0, 6);
    hdr.writeUInt16LE(0, 8);
    hdr.writeUInt16LE(0, 10);
    hdr.writeUInt16LE(0, 12);
    hdr.writeUInt32LE(crc, 14);
    hdr.writeUInt32LE(size, 18);
    hdr.writeUInt32LE(size, 22);
    hdr.writeUInt16LE(nameBytes.length, 26);
    hdr.writeUInt16LE(0, 28);
    nameBytes.copy(hdr, 30);

    offsets.push(offset);
    offset += hdr.length + size;
    localParts.push(hdr, entry.data);
  }

  const cdParts: Buffer[] = [];
  for (let i = 0; i < entries.length; i++) {
    const nameBytes = Buffer.from(entries[i].name, "utf8");
    const crc = crc32(entries[i].data);
    const size = entries[i].data.length;

    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offsets[i], 42);
    nameBytes.copy(cd, 46);
    cdParts.push(cd);
  }

  const centralDir = Buffer.concat(cdParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}
