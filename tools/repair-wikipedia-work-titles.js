const fs = require('node:fs');
const path = require('node:path');

const artistsFile = path.join(__dirname, '..', 'data', 'artists.json');
const generatedFile = path.join(__dirname, '..', 'data', 'generated', 'qid-Q6394591.json');
const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const generated = JSON.parse(fs.readFileSync(generatedFile, 'utf8'));
const generatedById = new Map((generated.works || []).map(work => [work.id, work]));
const text = value => String(value || '').replace(/\s+/g, ' ').trim();
const loc = (value, language) => typeof value === 'object' ? text(value?.[language] || value?.en || value?.ko) : text(value);
const compose = (work, artist, language) => {
  const title = loc(work.title, language) || loc(work.title, 'en') || 'Untitled';
  const artistName = loc(artist.name, language) || loc(artist.name, 'en');
  const year = work.year ? (language === 'ko' ? `${work.year}년경` : `around ${work.year}`) : '';
  const movement = loc(work.movement, language);
  const country = loc(work.country, language);
  if (language === 'ko') {
    return [
      `${title}은/는 ${artistName ? `${artistName}의 ` : ''}${year ? `${year} 제작된 ` : ''}작품입니다.`,
      movement ? `${movement} 흐름과 관련됩니다.` : '',
      country ? `${country}와 관련된 작품으로 기록되어 있습니다.` : ''
    ].filter(Boolean).join(' ');
  }
  return [
    `${title} is ${artistName ? `a work by ${artistName}` : 'an artwork'}${year ? ` made ${year}` : ''}.`,
    movement ? `It is associated with ${movement}.` : '',
    country ? `It is recorded in connection with ${country}.` : ''
  ].filter(Boolean).join(' ');
};

let repaired = 0;
for (const artist of data.artists || []) {
  for (const work of artist.works || []) {
    if (!String(work.id || '').startsWith('wikipedia-Q6394591-')) continue;
    const original = generatedById.get(work.id);
    if (!original) continue;
    work.title = original.title;
    work.image = work.image || original.image;
    work.source = original.source || work.source;
    const summary = {ko: compose(work, artist, 'ko'), en: compose(work, artist, 'en')};
    work.description = summary;
    work.detail = {
      schema: 2,
      repairedFromGeneratedAt: new Date().toISOString(),
      summary,
      sections: {
        ko: [
          {title:'개요', body:summary.ko},
          {title:'자료 항목', body:[work.year ? `제작 연도: ${work.year}` : '', loc(work.movement, 'ko') ? `사조: ${loc(work.movement, 'ko')}` : '', loc(work.country, 'ko') ? `국가: ${loc(work.country, 'ko')}` : ''].filter(Boolean).join(' · ')}
        ].filter(section => section.body),
        en: [
          {title:'Overview', body:summary.en},
          {title:'Data points', body:[work.year ? `Year: ${work.year}` : '', loc(work.movement, 'en') ? `Movement: ${loc(work.movement, 'en')}` : '', loc(work.country, 'en') ? `Country: ${loc(work.country, 'en')}` : ''].filter(Boolean).join(' · ')}
        ].filter(section => section.body)
      },
      sources: [work.source].filter(Boolean),
      facts: {artist: artist.name || {}, year: work.year || null, country: work.country || {}, movement: work.movement || {}}
    };
    repaired++;
  }
}

fs.writeFileSync(artistsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`repaired wikipedia work titles: ${repaired}`);
