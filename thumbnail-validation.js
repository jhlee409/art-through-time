function imageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) && buffer.length >= 24) {
    return {format:'png', width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20)};
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF' && buffer.length >= 10) {
    return {format:'gif', width:buffer.readUInt16LE(6), height:buffer.readUInt16LE(8)};
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    for (let offset = 2; offset + 9 < buffer.length;) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {format:'jpeg', width:buffer.readUInt16BE(offset + 7), height:buffer.readUInt16BE(offset + 5)};
      }
      offset += length + 2;
    }
  }
  return null;
}

function invalidArtworkThumbnail(buffer) {
  const image = imageDimensions(buffer);
  if (!image || !image.width || !image.height) return false;
  const largest = Math.max(image.width, image.height);
  return largest < 100 || (buffer.length < 4096 && largest <= 256);
}

module.exports = {imageDimensions, invalidArtworkThumbnail};
