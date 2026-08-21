/*
 * Enrich the name dictionary from Wikidata without guessing ambiguous matches.
 * Usage: node tools/research-person-name-dictionary.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.resolve(__dirname, '..');
const dictionaryFile = path.join(root, 'data', 'person-name-dictionary.json');
const outputFile = path.join(root, 'data', 'person-name-research.json');
const userAgent = 'ArtThroughTime/1.0 (local educational project; name-dictionary research)';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {'User-Agent': userAgent, Accept: 'application/json'}}, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`HTTP ${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

function request(url, retries = 2) {
  return getJson(url).catch(async error => {
    if (!retries) throw error;
    await new Promise(resolve => setTimeout(resolve, 800));
    return request(url, retries - 1);
  });
}

function candidateScore(record, candidate) {
  const target = normalize(record.original);
  const labels = [candidate.label, candidate.match?.text, ...(candidate.aliases || [])].map(normalize);
  if (!labels.includes(target)) return 0;
  const description = String(candidate.description || '').toLowerCase();
  let score = normalize(candidate.label) === target ? 120 : 110;
  if (/disambiguation|wikimedia/.test(description)) score -= 100;
  if (/(artist|painter|sculptor|architect|photographer|printmaker|art historian|art critic|designer|engraver|draughtsman|illustrator|poet|writer|philosopher|historian|ruler|patron)/.test(description)) score += 10;
  return score;
}

async function findCandidate(record) {
  const params = new URLSearchParams({action: 'wbsearchentities', search: record.original, language: 'en', uselang: 'en', type: 'item', limit: '8', format: 'json', origin: '*'});
  const data = await request(`https://www.wikidata.org/w/api.php?${params}`);
  const ranked = (data.search || []).map(candidate => ({candidate, score: candidateScore(record, candidate)}))
    .filter(item => item.score >= 110).sort((a, b) => b.score - a.score);
  if (!ranked.length || (ranked[1] && ranked[0].score === ranked[1].score && normalize(ranked[0].candidate.label) !== normalize(record.original))) return null;
  return ranked[0].candidate.id;
}

function unique(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({length: limit}, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }));
  return results;
}

async function entityDetails(ids) {
  const output = new Map();
  for (let index = 0; index < ids.length; index += 40) {
    const batch = ids.slice(index, index + 40);
    const params = new URLSearchParams({action: 'wbgetentities', ids: batch.join('|'), props: 'labels|aliases|sitelinks', languages: 'en|ko', format: 'json', origin: '*'});
    const data = await request(`https://www.wikidata.org/w/api.php?${params}`);
    for (const [qid, entity] of Object.entries(data.entities || {})) output.set(qid, entity);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return output;
}

function sparqlLiteral(value) {
  return JSON.stringify(String(value || '')).replace(/\\u2028|\\u2029/g, ' ');
}

async function sparql(query) {
  return request(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`);
}

async function candidatesFromSparql(people) {
  const results = new Map(people.map(record => [record.original, []]));
  for (let index = 0; index < people.length; index += 70) {
    const batch = people.slice(index, index + 70);
    const values = batch.map(record => `${sparqlLiteral(record.original)}@en`).join(' ');
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      PREFIX schema: <http://schema.org/>
      PREFIX wikibase: <http://wikiba.se/ontology#>
      PREFIX bd: <http://www.bigdata.com/rdf#>
      SELECT ?input ?item ?itemLabel ?itemDescription ?enwiki WHERE {
        VALUES ?input { ${values} }
        { ?item rdfs:label ?input } UNION { ?item skos:altLabel ?input }
        OPTIONAL { ?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`;
    const data = await sparql(query);
    for (const row of data.results?.bindings || []) {
      const original = row.input?.value;
      if (!results.has(original)) continue;
      results.get(original).push({
        id: row.item?.value?.split('/').pop(),
        label: row.itemLabel?.value || '',
        description: row.itemDescription?.value || '',
        enwiki: row.enwiki?.value || ''
      });
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return results;
}

function selectSparqlCandidate(record, candidates) {
  const ranked = (candidates || []).map(candidate => ({candidate, score: candidateScore(record, candidate)}))
    .filter(item => item.score >= 110).sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const distinct = [...new Set(ranked.map(item => item.candidate.id))];
  if (distinct.length > 1 && ranked[1].score === ranked[0].score) return null;
  return ranked[0].candidate.id;
}

async function main() {
  const dictionary = JSON.parse(fs.readFileSync(dictionaryFile, 'utf8'));
  const people = (dictionary.records || []).filter(record => record.kind === 'person');
  console.log(`Matching ${people.length} people against Wikidata labels and aliases…`);
  const candidates = await candidatesFromSparql(people);
  const qids = people.map(record => selectSparqlCandidate(record, candidates.get(record.original)));
  const details = await entityDetails(unique(qids));
  const records = people.map((record, index) => {
    const wikidataQid = qids[index];
    const entity = wikidataQid && details.get(wikidataQid);
    if (!entity || entity.missing !== undefined) return {...record, status: 'unmatched'};
    const englishFullName = entity.labels?.en?.value || '';
    const wikipediaTitle = entity.sitelinks?.enwiki?.title || '';
    const aliases = {
      en: unique([...(entity.aliases?.en || []).map(alias => alias.value), wikipediaTitle]),
      ko: unique([...(entity.aliases?.ko || []).map(alias => alias.value), entity.labels?.ko?.value])
    };
    return {
      kind: record.kind,
      original: record.original,
      korean: record.korean,
      status: 'matched',
      wikidataQid,
      englishFullName,
      wikipediaTitle,
      aliases,
      source: 'Wikidata (labels, aliases, and enwiki sitelink)'
    };
  });
  const matched = records.filter(record => record.status === 'matched').length;
  const payload = {schema: 1, generatedAt: new Date().toISOString(), description: 'Verified name metadata from Wikidata. Ambiguous or unmatched entries are retained without enrichment.', records};
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({people: people.length, matched, unmatched: people.length - matched, file: path.relative(root, outputFile)}, null, 2));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
