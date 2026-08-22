const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const topicsPath = path.join(root, 'data', 'topics.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';

function imageSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isFrame = (marker >= 0xc0 && marker <= 0xc3)
        || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb)
        || (marker >= 0xcd && marker <= 0xcf);
      if (isFrame) return {width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5)};
      offset += 2 + length;
    }
  }
  if (buffer.slice(0, 3).toString() === 'GIF') {
    return {width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8)};
  }
  return {width: 0, height: 0};
}

function safeTopicImage(relative) {
  const absolute = path.resolve(root, String(relative || ''));
  const imageRoot = path.resolve(topicImageDir);
  if (!absolute.startsWith(`${imageRoot}${path.sep}`)) throw new Error(`Unsafe image path: ${relative}`);
  return absolute;
}

const data = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const topic = (data.topics || []).find(item => item.id === topicId);
if (!topic) throw new Error(`Topic not found: ${topicId}`);

const deleted = [];
const kept = [];
for (const work of topic.works || []) {
  const absolute = safeTopicImage(work.thumbnail);
  const dimensions = fs.existsSync(absolute) ? imageSize(absolute) : {width: 0, height: 0};
  const missingArtistOrYear = !String(work.artist || '').trim() || !String(work.year || '').trim();
  const tooNarrow = dimensions.width < 500;
  if (missingArtistOrYear || tooNarrow) {
    deleted.push({
      id: work.id,
      title: work.title,
      artist: work.artist || '',
      year: work.year || '',
      width: dimensions.width,
      reason: [missingArtistOrYear ? 'artist/year missing' : '', tooNarrow ? 'width under 500px' : ''].filter(Boolean).join(', '),
      thumbnail: work.thumbnail
    });
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  }
  else kept.push(work);
}

topic.works = kept.map((work, index) => ({...work, sequence: index + 1}));

const referenced = new Set(topic.works.map(work => path.basename(String(work.thumbnail || ''))).filter(Boolean));
for (const name of fs.readdirSync(topicImageDir)) {
  if (!/^jesus-descent-\d+-/i.test(name)) continue;
  if (referenced.has(name)) continue;
  fs.unlinkSync(path.join(topicImageDir, name));
}

fs.writeFileSync(topicsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({kept: topic.works.length, deleted: deleted.length, deleted}, null, 2));
