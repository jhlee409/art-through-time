/* Converts active name data to the confirmed uHangul v0.6-draft alphabet.
 * R is provisional: its old bracket notation becomes ordinary Korean ㄹ.
 * Spanish Z becomes ordinary Korean ㅅ, per the project display rule.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vowels = Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const finals = ['', ...Array.from('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')];
const onsets = Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const spanishNames = new Set(['joseclementeorozco']);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isSpanishNationality = artist => {
  const nationality = `${artist?.nationality?.ko || ''} ${artist?.nationality?.en || ''}`;
  return !/스페인령|spanish netherlands/i.test(nationality) && /스페인|\bspain\b|멕시코|\bmexico\b|콜롬비아|\bcolombia\b|아르헨티나|\bargentina\b|칠레|\bchile\b|페루|\bperu\b/i.test(nationality);
};
const syllable = (onset, vowel, final = '') => {
  const oi = onsets.indexOf(onset), vi = vowels.indexOf(vowel), fi = finals.indexOf(final);
  if (oi < 0 || vi < 0 || fi < 0) return null;
  return String.fromCodePoint(0xAC00 + ((oi * 21 + vi) * 28 + fi));
};
const migrateNotation = (value, language) => String(value || '').replace(/\[([RZ])([ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ])([ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ]?)\]/g, (whole, token, vowel, final) => {
  if (token === 'R') return syllable('ㄹ', vowel, final) || whole;
  if (token === 'Z' && String(language || '').startsWith('es')) return syllable('ㅅ', vowel, final) || whole;
  return whole;
});
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const artistData = readJson(path.join(root, 'data', 'artists.json'));
const artists = Array.isArray(artistData) ? artistData : (Array.isArray(artistData.artists) ? artistData.artists : []);
const spanishIds = new Set(artists.filter(isSpanishNationality).map(artist => String(artist.qid || artist.id || '')));
for (const relative of ['data/person-name-dictionary.json', 'uhangul/data/artist-map.json']) {
  const file = path.join(root, relative);
  const document = readJson(file);
  const records = Array.isArray(document) ? document : (Array.isArray(document.records) ? document.records : []);
  if (!records.length) throw new Error(`No records found in ${relative}`);
  for (const record of records) {
    const isSpanish = spanishIds.has(String(record.id || '')) || spanishNames.has(normalize(record.original));
    record.language = isSpanish ? 'es' : 'und';
    record.uhangulVersion = '0.6-draft';
    record.uhangul = migrateNotation(record.uhangul, record.language);
  }
  writeJson(file, Array.isArray(document) ? records : {...document, records});
}

const runtimeFile = path.join(root, 'uhangul', 'uhangul-runtime.js');
let runtime = fs.readFileSync(runtimeFile, 'utf8');
runtime = runtime.replace(/let RECORDS = (\[[\s\S]*?\]);\r?\n\r?\nconst EXCLUDED/, (_, source) => {
  const records = JSON.parse(source);
  for (const record of records) {
    record.language = record.language || 'und';
    record.uhangulVersion = '0.6-draft';
    record.uhangul = migrateNotation(record.uhangul, record.language);
  }
  return `let RECORDS = ${JSON.stringify(records)};\n\nconst EXCLUDED`;
});
fs.writeFileSync(runtimeFile, runtime, 'utf8');
console.log('Migrated active uHangul dictionaries to v0.6-draft.');
