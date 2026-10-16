export function readJpegDimensions(body: Buffer): { width: number; height: number } {
  if (body.length < 2 || body.readUInt16BE(0) !== 0xffd8) {
    throw new Error('Expected a JPEG SOI marker');
  }

  let offset = 2;
  while (offset < body.length) {
    if (body[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (body[offset] === 0xff) offset++;
    const marker = body[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > body.length) throw new Error('Truncated JPEG segment');

    const length = body.readUInt16BE(offset);
    if (length < 2 || offset + length > body.length) {
      throw new Error('Invalid JPEG segment length');
    }
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8) throw new Error('Truncated JPEG frame');
      const height = body.readUInt16BE(offset + 3);
      const width = body.readUInt16BE(offset + 5);
      if (!width || !height) throw new Error('Invalid JPEG dimensions');
      return { width, height };
    }
    offset += length;
  }

  throw new Error('JPEG SOF0/SOF2 marker not found');
}
