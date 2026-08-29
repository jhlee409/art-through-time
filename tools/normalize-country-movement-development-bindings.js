#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementsFile = path.join(root, 'data', 'art-movements.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function serializeMovements(data) {
  const context = JSON.stringify(data.contextOnlyMovements || [], null, 2).split('\n').map((line, index) => index ? `  ${line}` : line).join('\n');
  const countries = data.countries.map(country => {
    const heading = `    {"id":${JSON.stringify(country.id)},"name":${JSON.stringify(country.name)},"movements":[`;
    const movementRows = (country.movements || []).map(movement => `      ${JSON.stringify(movement)}`).join(',\n');
    return `${heading}\n${movementRows}\n    ]}`;
  }).join(',\n');
  return `{\n  "contextOnlyMovements": ${context},\n  "countries": [\n${countries}\n  ]\n}\n`;
}

function movement(country, koName) {
  const result = (country.movements || []).find(item => item.name?.ko === koName);
  if (!result) throw new Error(`${country.id}: movement is missing: ${koName}`);
  return result;
}

function movementAny(country, koNames) {
  const result = (country.movements || []).find(item => koNames.includes(item.name?.ko));
  if (!result) throw new Error(`${country.id}: movement is missing: ${koNames.join(' / ')}`);
  return result;
}

function bind(item, {parentId, documentOwnerId, categoryIds = [], developmentIds = []}) {
  item.canonical = {parentId, documentOwnerId, categoryIds, developmentIds};
}

function main() {
  const data = readJson(movementsFile);
  const countries = new Map((data.countries || []).map(country => [country.id, country]));
  const required = id => {
    const country = countries.get(id);
    if (!country) throw new Error(`Missing country: ${id}`);
    return country;
  };

  const germany = required('germany');
  movementAny(germany, ['북방 르네상스', '독일 르네상스']).name = {ko: '독일 르네상스', en: 'German Renaissance'};
  bind(movement(germany, '독일 르네상스'), {
    parentId: 'northern-renaissance',
    documentOwnerId: 'northern-renaissance',
    categoryIds: ['northern-renaissance--german'],
    developmentIds: ['dev--northern-renaissance-german-germany']
  });
  bind(movement(germany, '도나우파'), {parentId: 'northern-renaissance', documentOwnerId: 'northern-renaissance'});
  bind(movement(germany, '비더마이어'), {parentId: 'biedermeier', documentOwnerId: 'romanticism'});
  bind(movement(germany, '신즉물주의'), {parentId: 'new-objectivity', documentOwnerId: 'expressionism'});

  ['belgium', 'netherlands'].forEach(countryId => {
    bind(movement(required(countryId), '북방 르네상스'), {parentId: 'northern-renaissance', documentOwnerId: 'northern-renaissance'});
  });

  const france = required('france');
  bind(movement(france, '후기 인상주의'), {
    parentId: 'post-impressionism',
    documentOwnerId: 'post-impressionism',
    categoryIds: ['post-impressionism--core', 'post-impressionism--pont-aven-synthetism'],
    developmentIds: ['dev--post-impressionism-core-france', 'dev--post-impressionism-pont-aven-synthetism-france']
  });

  const russia = required('russia');
  bind(movement(russia, '이동파'), {parentId: 'realism', documentOwnerId: 'realism'});
  bind(movement(russia, '러시아 아방가르드'), {parentId: 'russian-avant-garde', documentOwnerId: 'russian-avant-garde'});
  bind(movement(russia, '절대주의'), {
    parentId: 'russian-avant-garde',
    documentOwnerId: 'russian-avant-garde',
    categoryIds: ['russian-avant-garde--suprematism'],
    developmentIds: ['dev--russian-avant-garde-suprematism-russia']
  });
  bind(movement(russia, '구성주의'), {
    parentId: 'russian-avant-garde',
    documentOwnerId: 'russian-avant-garde',
    categoryIds: ['russian-avant-garde--constructivism'],
    developmentIds: ['dev--russian-avant-garde-constructivism-russia']
  });

  const unitedStates = required('united-states');
  bind(movement(unitedStates, '포스트모더니즘'), {
    parentId: 'postmodernism',
    documentOwnerId: 'postmodernism',
    categoryIds: ['postmodernism--appropriation-pictures'],
    developmentIds: ['dev--postmodernism-appropriation-pictures-united-states']
  });

  const global = required('global-contemporary');
  bind(movement(global, '개념미술'), {
    parentId: 'conceptual-art',
    documentOwnerId: 'conceptual-art',
    categoryIds: ['conceptual-art--idea-language'],
    developmentIds: ['dev--conceptual-art-idea-language-global-contemporary']
  });
  bind(movement(global, '포토리얼리즘'), {parentId: 'photorealism', documentOwnerId: 'postmodernism'});
  bind(movement(global, '동시대 미술'), {
    parentId: 'contemporary-art',
    documentOwnerId: 'contemporary-art',
    categoryIds: ['contemporary-art--installation-performance', 'contemporary-art--new-media-digital'],
    developmentIds: ['dev--contemporary-art-installation-performance-global-contemporary', 'dev--contemporary-art-new-media-digital-global-contemporary']
  });

  fs.writeFileSync(movementsFile, serializeMovements(data), 'utf8');
  console.log(JSON.stringify({updated: true}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
