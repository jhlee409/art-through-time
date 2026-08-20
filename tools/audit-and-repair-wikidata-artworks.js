/* Audit stored artwork metadata against Wikidata and save a local report. */
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const artistsFile = path.join(dataDir, 'artists.json');
const generatedDir = path.join(dataDir, 'generated');
const reportDir = path.join(dataDir, 'audits');
const batchSize = 40;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const getJson = (url, attempt = 0) => new Promise((resolve, reject) => https.get(url, {headers:{'User-Agent':'ArtAtlasLocal metadata audit'}}, response => {
  let body = ''; response.setEncoding('utf8'); response.on('data', chunk => body += chunk);
  response.on('end', () => {
    if (response.statusCode === 200) { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } return; }
    if ((response.statusCode === 429 || response.statusCode >= 500) && attempt < 6) { setTimeout(() => getJson(url, attempt + 1).then(resolve, reject), 1500 * (attempt + 1)); return; }
    reject(new Error(`Wikidata returned ${response.statusCode}`));
  });
}).on('error', reject));
const chunks = (items, size) => Array.from({length:Math.ceil(items.length / size)}, (_, index) => items.slice(index * size, (index + 1) * size));
const entityId = (entity, property) => entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.id || '';
const year = entity => { const value = entity?.claims?.P571?.[0]?.mainsnak?.datavalue?.value?.time; const match = String(value || '').match(/^([+-]?\d{1,6})-/); return match ? Number(match[1]) : null; };
const label = (entity, language) => entity?.labels?.[language]?.value || entity?.labels?.en?.value || entity?.labels?.ko?.value || '';
async function fetchEntities(ids) {
  const entities = {};
  for (const group of chunks(ids, batchSize)) {
    const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({action:'wbgetentities',format:'json',languages:'ko|en',props:'labels|claims',ids:group.join('|')})}`;
    Object.assign(entities, (await getJson(url)).entities || {});
    await delay(1100);
  }
  return entities;
}
function repairWork(work, entities) {
  const qid = String(work.id || '').replace(/^wikidata-/, '');
  const entity = entities[qid]; if (!entity || entity.missing !== undefined) return {changed:false, issue:'missing Wikidata entity'};
  const changes = {};
  const nextYear = year(entity); if (nextYear && work.year !== nextYear) { changes.year = [work.year, nextYear]; work.year = nextYear; }
  const ko = label(entity, 'ko'), en = label(entity, 'en');
  if (ko && en && (work.title?.ko !== ko || work.title?.en !== en)) { changes.title = [work.title, {ko,en}]; work.title = {ko,en}; }
  const countryId = entityId(entity, 'P495'); const country = entities[countryId];
  if (country) { const nextCountry = {ko:label(country,'ko'), en:label(country,'en')}; if (nextCountry.ko && nextCountry.en && (work.country?.ko !== nextCountry.ko || work.country?.en !== nextCountry.en)) { changes.country = [work.country, nextCountry]; work.country = nextCountry; } }
  return {changed:Object.keys(changes).length > 0, changes, issue:countryId && !country ? 'country label unavailable' : ''};
}
async function main() {
  const artistsData = JSON.parse(await fs.readFile(artistsFile, 'utf8'));
  const targets = artistsData.artists.flatMap(artist => (artist.works || []).filter(work => /^wikidata-Q\d+$/.test(work.id || '')));
  const ids = [...new Set(targets.map(work => work.id.slice('wikidata-'.length)))];
  const artworkEntities = await fetchEntities(ids);
  const countryIds = [...new Set(Object.values(artworkEntities).map(entity => entityId(entity, 'P495')).filter(Boolean))];
  const entities = {...artworkEntities, ...await fetchEntities(countryIds)};
  const changes = [], issues = [];
  const repair = work => { const result = repairWork(work, entities); if (result.changed) changes.push({id:work.id, ...result.changes}); if (result.issue) issues.push({id:work.id, issue:result.issue}); };
  artistsData.artists.forEach(artist => (artist.works || []).forEach(repair));
  const generatedFiles = (await fs.readdir(generatedDir)).filter(name => name.endsWith('.json'));
  for (const name of generatedFiles) { const file = path.join(generatedDir, name); const data = JSON.parse(await fs.readFile(file, 'utf8')); let changed = false; (data.works || []).forEach(work => { const result = repairWork(work, entities); changed ||= result.changed; }); if (changed) await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8'); }
  await fs.writeFile(artistsFile, JSON.stringify(artistsData, null, 2) + '\n', 'utf8');
  await fs.mkdir(reportDir, {recursive:true});
  const report = {auditedAt:new Date().toISOString(), checkedWorks:ids.length, correctedWorks:changes.length, unverifiedNonWikidata:artistsData.artists.flatMap(artist => (artist.works || []).filter(work => !/^wikidata-Q\d+$/.test(work.id || '')).map(work => ({artist:artist.name?.en || artist.name?.ko, id:work.id, title:work.title}))), issues, changes};
  const reportFile = path.join(reportDir, 'wikidata-artwork-audit.json'); await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({checkedWorks:ids.length, correctedWorks:changes.length, unverifiedNonWikidata:report.unverifiedNonWikidata.length, report:path.relative(root, reportFile)}, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
