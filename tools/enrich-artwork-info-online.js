const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');

const artistsFile = path.join(__dirname, '..', 'data', 'artists.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const text = value => String(value || '').replace(/\s+/g, ' ').trim();
const cleanTitle = value => text(value).replace(/_/g, ' ');
const qidFromWork = work => {
  const id = String(work?.id || '');
  const source = String(work?.source || '');
  return id.match(/^(?:wikidata|featured)-(Q\d+)/)?.[1] || source.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/)?.[1] || '';
};
const label = (value, language) => typeof value === 'object' ? text(value?.[language] || value?.en || value?.ko) : text(value);
const dedupe = values => values.map(text).filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);

function getJson(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {headers:{'User-Agent':'ArtAtlasLocal/1.0 (local enrichment)'}}, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return getJson(new URL(response.headers.location, url).href, attempt).then(resolve, reject);
        }
        if ((response.statusCode === 429 || response.statusCode >= 500) && attempt < 5) {
          const retryAfter = Number(response.headers['retry-after'] || 0) * 1000;
          const wait = response.statusCode === 429 ? Math.max(retryAfter, 10000 * (attempt + 1)) : 2500 * (attempt + 1);
          return delay(wait).then(() => getJson(url, attempt + 1)).then(resolve, reject);
        }
        if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(16000, () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
  });
}

const wikidataApi = params => `https://www.wikidata.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;
const wikipediaApi = (language, params) => `https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;

async function entity(qid) {
  if (!qid) return null;
  const data = await getJson(wikidataApi({action:'wbgetentities',ids:qid,props:'labels|descriptions|claims|sitelinks',languages:'ko|en'}));
  return data.entities?.[qid] || null;
}

const entityLabel = (item, language) => item?.labels?.[language]?.value || item?.labels?.en?.value || item?.labels?.ko?.value || '';
const entityDescription = (item, language) => {
  const value = item?.descriptions?.[language]?.value || '';
  return language === 'ko' && value && !/[가-힣]/.test(value) ? '' : value;
};
const claimValue = (item, property) => item?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
const claimValues = (item, property) => (item?.claims?.[property] || []).map(claim => claim.mainsnak?.datavalue?.value).filter(Boolean);
const claimQids = (item, property) => claimValues(item, property).map(value => value.id).filter(Boolean);
const claimYear = (item, property) => Number(String(claimValue(item, property)?.time || '').slice(1, 5)) || null;

async function labelsFor(qids) {
  const unique = dedupe(qids).filter(qid => /^Q\d+$/.test(qid));
  const output = new Map();
  for (let index = 0; index < unique.length; index += 40) {
    const batch = unique.slice(index, index + 40);
    const data = await getJson(wikidataApi({action:'wbgetentities',ids:batch.join('|'),props:'labels',languages:'ko|en'}));
    for (const qid of batch) {
      const item = data.entities?.[qid];
      output.set(qid, {ko:entityLabel(item, 'ko'), en:entityLabel(item, 'en')});
    }
    await delay(250);
  }
  return output;
}

async function extractFromTitle(title, language) {
  if (!title) return '';
  const data = await getJson(wikipediaApi(language, {action:'query',redirects:'1',titles:cleanTitle(title),prop:'extracts',exintro:'1',explaintext:'1',exsentences:'5'}));
  return text(Object.values(data.query?.pages || {}).map(page => page.extract).find(Boolean));
}

async function searchExtract(query, language) {
  if (!text(query)) return '';
  const search = await getJson(wikipediaApi(language, {action:'query',list:'search',srsearch:query,srlimit:'1'}));
  const title = search.query?.search?.[0]?.title || '';
  return title ? extractFromTitle(title, language) : '';
}

function sentenceList(value, max = 3) {
  const sentences = text(value).match(/[^.!?。]+[.!?。]?/g) || [];
  return dedupe(sentences).slice(0, max).join(' ');
}

function factsFromEntity(item, labels, work) {
  const fields = [
    ['collection', 'P195'],
    ['location', 'P276'],
    ['material', 'P186'],
    ['genre', 'P136'],
    ['mainSubject', 'P921'],
    ['movement', 'P135'],
    ['country', 'P495'],
    ['instanceOf', 'P31']
  ];
  const facts = {};
  for (const [key, property] of fields) {
    const values = claimQids(item, property).map(qid => labels.get(qid)).filter(Boolean);
    if (values.length) facts[key] = values.slice(0, 6);
  }
  facts.year = claimYear(item, 'P571') || work.year || null;
  return facts;
}

const names = {
  ko: {overview:'개요',background:'배경과 의미',data:'자료 항목'},
  en: {overview:'Overview',background:'Context and significance',data:'Data points'}
};

function joinLabels(values, language) {
  return (values || []).map(value => label(value, language)).filter(Boolean).join(', ');
}

function composeSections(work, artist, item, facts, extracts, language) {
  const title = entityLabel(item, language) || label(work.title, language) || label(work.title, 'en') || 'Untitled';
  const artistName = label(artist.name, language) || label(artist.name, 'en');
  const year = facts.year ? (language === 'ko' ? `${facts.year}년경` : `around ${facts.year}`) : '';
  const collection = joinLabels(facts.collection, language);
  const material = joinLabels(facts.material, language);
  const movement = joinLabels(facts.movement, language) || label(work.movement, language);
  const genre = joinLabels(facts.genre, language);
  const subject = joinLabels(facts.mainSubject, language);
  const location = joinLabels(facts.location, language);
  const description = entityDescription(item, language);
  const extract = extracts[language] || extracts.en || extracts.ko || '';

  const overview = language === 'ko'
    ? dedupe([
        `${title}은/는 ${artistName ? `${artistName}의 ` : ''}${year ? `${year} 제작된 ` : ''}작품입니다.`,
        movement ? `${movement}와 관련된 작품으로 정리되어 있습니다.` : '',
        collection ? `현재 소장처 또는 관련 기관은 ${collection}입니다.` : '',
        description
      ]).join(' ')
    : dedupe([
        `${title} is ${artistName ? `a work by ${artistName}` : 'an artwork'}${year ? ` made ${year}` : ''}.`,
        movement ? `It is associated with ${movement}.` : '',
        collection ? `It is connected with ${collection}.` : '',
        description
      ]).join(' ');

  const background = language === 'ko'
    ? dedupe([
        sentenceList(extract, 4),
        material ? `재료 또는 기법 항목에는 ${material}이/가 기록되어 있습니다.` : '',
        genre ? `장르 항목은 ${genre}입니다.` : '',
        subject ? `주요 주제는 ${subject}로 정리되어 있습니다.` : '',
        location && location !== collection ? `관련 장소는 ${location}입니다.` : ''
      ]).join(' ')
    : dedupe([
        sentenceList(extract, 4),
        material ? `Recorded materials or techniques include ${material}.` : '',
        genre ? `The recorded genre is ${genre}.` : '',
        subject ? `Main subject entries include ${subject}.` : '',
        location && location !== collection ? `The associated location is ${location}.` : ''
      ]).join(' ');

  const data = language === 'ko'
    ? dedupe([
        facts.year ? `제작 연도: ${facts.year}` : '',
        movement ? `사조: ${movement}` : '',
        collection ? `소장/관련 기관: ${collection}` : '',
        material ? `재료/기법: ${material}` : '',
        genre ? `장르: ${genre}` : '',
        subject ? `주제: ${subject}` : ''
      ]).join(' · ')
    : dedupe([
        facts.year ? `Year: ${facts.year}` : '',
        movement ? `Movement: ${movement}` : '',
        collection ? `Collection / institution: ${collection}` : '',
        material ? `Material / technique: ${material}` : '',
        genre ? `Genre: ${genre}` : '',
        subject ? `Subject: ${subject}` : ''
      ]).join(' · ');

  return [
    {title:names[language].overview, body:overview},
    {title:names[language].background, body:background},
    {title:names[language].data, body:data}
  ].filter(section => text(section.body));
}

async function enrichWork(artist, work, options = {}) {
  const qid = qidFromWork(work);
  const item = qid ? await entity(qid) : null;
  const related = item ? ['P195','P276','P186','P136','P921','P135','P495','P31'].flatMap(property => claimQids(item, property)) : [];
  const labels = await labelsFor(related);
  const facts = item ? factsFromEntity(item, labels, work) : {year:work.year || null};
  const koTitle = item?.sitelinks?.kowiki?.title;
  const enTitle = item?.sitelinks?.enwiki?.title;
  const extracts = {};
  try { extracts.ko = koTitle ? await extractFromTitle(koTitle, 'ko') : (options.searchMissing ? await searchExtract(`${label(work.title,'ko')} ${label(artist.name,'ko')}`, 'ko') : ''); } catch (_) {}
  await delay(250);
  try { extracts.en = enTitle ? await extractFromTitle(enTitle, 'en') : (options.searchMissing ? await searchExtract(`${label(work.title,'en')} ${label(artist.name,'en')}`, 'en') : ''); } catch (_) {}
  const sections = {
    ko: composeSections(work, artist, item, facts, extracts, 'ko'),
    en: composeSections(work, artist, item, facts, extracts, 'en')
  };
  const summary = {
    ko: sections.ko.map(section => section.body).find(Boolean) || work.detail?.summary?.ko || work.description?.ko || '',
    en: sections.en.map(section => section.body).find(Boolean) || work.detail?.summary?.en || work.description?.en || ''
  };
  const sources = dedupe([
    work.source,
    qid ? `https://www.wikidata.org/wiki/${qid}` : '',
    koTitle ? `https://ko.wikipedia.org/wiki/${encodeURIComponent(koTitle.replace(/ /g, '_'))}` : '',
    enTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle.replace(/ /g, '_'))}` : ''
  ]);
  return {
    ...work,
    title: {ko: entityLabel(item, 'ko') || work.title?.ko || work.title?.en || '', en: entityLabel(item, 'en') || work.title?.en || work.title?.ko || ''},
    description: summary,
    detail: {
      ...(work.detail || {}),
      schema: 2,
      enrichedOnlineAt: new Date().toISOString(),
      summary,
      sections,
      sources,
      facts: {
        ...(work.detail?.facts || {}),
        artist: artist.name || {},
        year: facts.year || work.year || null,
        country: work.country || {},
        movement: work.movement || {},
        collection: facts.collection || [],
        location: facts.location || [],
        material: facts.material || [],
        genre: facts.genre || [],
        mainSubject: facts.mainSubject || []
      }
    }
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = args.has('--all') ? Infinity : Number(limitArg?.split('=')[1] || 20);
  const data = JSON.parse(await fs.readFile(artistsFile, 'utf8'));
  let enriched = 0;
  for (const artist of data.artists || []) {
    for (let index = 0; index < (artist.works || []).length; index++) {
      const work = artist.works[index];
      if (work.detail?.schema >= 2 && !args.has('--refresh')) continue;
      if (enriched >= limit) break;
      try {
        artist.works[index] = await enrichWork(artist, work, {searchMissing:args.has('--search-missing')});
        enriched++;
        await fs.writeFile(artistsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`enriched ${enriched}: ${label(artist.name,'ko')} / ${label(artist.works[index].title,'ko')}`);
        await delay(600);
      } catch (error) {
        console.log(`skipped: ${label(artist.name,'ko')} / ${label(work.title,'ko')} (${error.message})`);
      }
    }
  }
  console.log(`done: enriched=${enriched}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
