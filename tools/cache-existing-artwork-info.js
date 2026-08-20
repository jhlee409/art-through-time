const fs = require('node:fs');
const path = require('node:path');

const artistsFile = path.join(__dirname, '..', 'data', 'artists.json');
const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));

const text = value => String(value || '').replace(/\s+/g, ' ').trim();
const loc = (value, language) => typeof value === 'object' ? text(value[language] || value.en || value.ko) : text(value);
const localizedDescription = (value, language) => {
  const candidate = loc(value, language);
  return language === 'ko' && candidate && !/[가-힣]/.test(candidate) ? '' : candidate;
};
const dedupeSentences = value => {
  const sentences = text(value).match(/[^.!?。]+[.!?。]?/g) || [];
  const output = [];
  for (const sentence of sentences) {
    const clean = text(sentence);
    if (clean && clean !== output[output.length - 1]) output.push(clean);
  }
  return output.join(' ');
};
const shortText = (value, limit = 760) => {
  const clean = dedupeSentences(value);
  if (clean.length <= limit) return clean;
  const trimmed = clean.slice(0, limit).replace(/\s+\S*$/, '').replace(/[.,;:]*$/, '');
  return trimmed ? `${trimmed}.` : clean.slice(0, limit);
};

function compose(work, artist, language) {
  const title = loc(work.title, language) || (language === 'ko' ? '제목 없는 작품' : 'Untitled');
  const artistName = loc(artist.name, language);
  const year = work.year ? (language === 'ko' ? `${work.year}년경` : `around ${work.year}`) : '';
  const movement = loc(work.movement, language);
  const country = loc(work.country, language);
  const description = localizedDescription(work.description, language);
  if (language === 'ko') {
    const base = `${title}은/는 ${artistName ? `${artistName}의 ` : ''}${year ? `${year} 제작된 ` : ''}작품입니다.`;
    if (description.startsWith(`${title}은/는`) && description.includes('작품입니다')) return shortText(description);
    const facts = [
      movement ? `${movement} 흐름과 관련됩니다.` : '',
      country ? `${country}와 관련된 작품으로 기록되어 있습니다.` : ''
    ].filter(Boolean).join(' ');
    return shortText([base, facts, description].filter(Boolean).join(' '));
  }
  const base = `${title} is ${artistName ? `a work by ${artistName}` : 'an artwork'}${year ? ` made ${year}` : ''}.`;
  if (description.startsWith(`${title} is `)) return shortText(description);
  const facts = [
    movement ? `It is associated with ${movement}.` : '',
    country ? `It is recorded in connection with ${country}.` : ''
  ].filter(Boolean).join(' ');
  return shortText([base, facts, description].filter(Boolean).join(' '));
}

let updated = 0;
for (const artist of data.artists || []) {
  for (const work of artist.works || []) {
    const ko = compose(work, artist, 'ko');
    const en = loc(work.description, 'en') || compose(work, artist, 'en');
    work.description = {ko, en};
    work.detail = {
      ...(work.detail || {}),
      schema: 1,
      cachedFromExistingData: true,
      summary: {ko: compose(work, artist, 'ko'), en: compose(work, artist, 'en')},
      sources: [work.source, work.id?.match(/Q\d+/)?.[0] ? `https://www.wikidata.org/wiki/${work.id.match(/Q\d+/)[0]}` : '']
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index),
      facts: {
        artist: artist.name || {},
        year: work.year || null,
        country: work.country || {},
        movement: work.movement || {}
      }
    };
    updated++;
  }
}

fs.writeFileSync(artistsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`cached artwork detail blocks: ${updated}`);
