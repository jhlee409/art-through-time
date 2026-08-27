const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const compact = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');

const movements = readJson('data/art-movements.json');
const events = readJson('data/country-art-events.json');
const backgrounds = readJson('data/country-movement-backgrounds.json');

const issues = [];
const countryIds = new Set((movements.countries || []).map(country => country.id));
const allowedCategories = new Set(events.categories || []);
const allowedEventKinds = new Set(['war']);
const allowedCountryOutcomes = new Set(['victory', 'defeat', 'unclear']);
const eventIdsByCountry = new Map();
let eventTotal = 0;

for (const [countryId, list] of Object.entries(events.countries || {})) {
  if (!countryIds.has(countryId)) issues.push(`${countryId}: unknown country in country-art-events.json`);
  const ids = new Set();
  for (const event of list || []) {
    eventTotal += 1;
    const id = event.id || '(no id)';
    if (!event.id || !event.name?.ko || !event.name?.en || !Number.isFinite(Number(event.start)) || !event.category || !event.impact?.ko || !event.impact?.en || !event.wiki) {
      issues.push(`${countryId}:${id} missing required event field`);
    }
    if (ids.has(event.id)) issues.push(`${countryId}: duplicate event id ${event.id}`);
    ids.add(event.id);
    if (!allowedCategories.has(event.category)) issues.push(`${countryId}:${id} invalid category ${event.category}`);
    if (event.eventKind && !allowedEventKinds.has(event.eventKind)) issues.push(`${countryId}:${id} invalid eventKind ${event.eventKind}`);
    if (event.eventKind === 'war' && !allowedCountryOutcomes.has(event.countryOutcome)) issues.push(`${countryId}:${id} invalid countryOutcome ${event.countryOutcome}`);
    if (event.end != null && Number(event.end) < Number(event.start)) issues.push(`${countryId}:${id} invalid year range`);
    if (event.wiki && !/^https?:\/\/[^\s]+$/i.test(event.wiki)) issues.push(`${countryId}:${id} invalid wiki URL`);
  }
  eventIdsByCountry.set(countryId, ids);
}

let backgroundTotal = 0;
let backgroundsWithoutPrelude = 0;
let backgroundsWithLaterEvents = 0;

for (const [countryId, list] of Object.entries(backgrounds.countries || {})) {
  if (!countryIds.has(countryId)) issues.push(`${countryId}: unknown country in country-movement-backgrounds.json`);
  const country = (movements.countries || []).find(item => item.id === countryId);
  const movementByKey = new Map((country?.movements || []).flatMap(movement =>
    [movement.name?.en, movement.name?.ko].filter(Boolean).map(name => [compact(name), movement])
  ));
  const seen = new Set();
  const eventMap = new Map((events.countries?.[countryId] || []).map(event => [event.id, event]));

  for (const background of list || []) {
    backgroundTotal += 1;
    const movementLabel = background.movement || background.movementEn || background.movementKo || '(no movement)';
    const key = compact(movementLabel);
    if (seen.has(key)) issues.push(`${countryId}: duplicate background ${movementLabel}`);
    seen.add(key);
    const movement = movementByKey.get(key);
    if (!movement) issues.push(`${countryId}: unknown movement ${movementLabel}`);
    if (!background.thesis?.ko && !background.thesis?.en) issues.push(`${countryId}:${movementLabel} missing thesis`);
    for (const mechanism of background.mechanisms || []) {
      if (!backgrounds.mechanisms?.[mechanism]) issues.push(`${countryId}:${movementLabel} unknown mechanism ${mechanism}`);
    }

    const linkedIds = [...(background.preludeEventIds || []), ...(background.eventIds || [])];
    for (const id of linkedIds) {
      if (!eventIdsByCountry.get(countryId)?.has(id)) issues.push(`${countryId}:${movementLabel} references unknown event ${id}`);
    }
    const linkedEvents = linkedIds.map(id => eventMap.get(id)).filter(Boolean);
    const movementStart = Number(movement?.start);
    const hasPrelude = linkedEvents.some(event => Number(event.start) <= movementStart);
    if (!hasPrelude) backgroundsWithoutPrelude += 1;
    if (linkedEvents.some(event => Number(event.start) > movementStart)) backgroundsWithLaterEvents += 1;
  }
}

const result = {
  eventCountries: Object.keys(events.countries || {}).length,
  eventTotal,
  backgroundCountries: Object.keys(backgrounds.countries || {}).length,
  backgroundTotal,
  backgroundsWithLaterEvents,
  backgroundsWithoutPrelude,
  issues: issues.length,
};

console.log(JSON.stringify(result, null, 2));
if (issues.length) {
  console.error(issues.slice(0, 80).join('\n'));
  process.exit(1);
}
