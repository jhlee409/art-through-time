const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const mapFile = path.join(root, 'uhangul', 'data', 'artist-map.json');

const VOWELS = Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const FINALS = ['', ...Array.from('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')];
const ONSETS = Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const TARGET_ONSETS = {
  F: new Set(['ㅍ']),
  V: new Set(['ㅂ', 'ㅍ']),
  Z: new Set(['ㅈ', 'ㅅ', 'ㅆ']),
  R: new Set(['ㄹ']),
  TH: new Set(['ㅅ', 'ㅌ', 'ㄷ']),
  X: new Set(['ㅎ']),
  CH: new Set(['ㅎ'])
};
const PASSTHROUGH_ONSETS = {
  L: new Set(['ㄹ']),
  C: new Set(['ㅋ', 'ㄱ', 'ㅅ']),
  K: new Set(['ㅋ', 'ㄱ']),
  G: new Set(['ㄱ', 'ㅈ']),
  P: new Set(['ㅍ', 'ㅂ']),
  B: new Set(['ㅂ']),
  D: new Set(['ㄷ']),
  T: new Set(['ㅌ', 'ㄷ']),
  S: new Set(['ㅅ']),
  J: new Set(['ㅈ']),
  M: new Set(['ㅁ']),
  N: new Set(['ㄴ']),
  H: new Set(['ㅎ'])
};
const manualUHangulByOriginal = {
  carllarsson: ({displayKorean, korean}) => displayKorean || korean || '라르손, 칼',
  // In standard Spanish, the initial v of Velázquez is /b/ rather than the
  // English /v/, and both z letters are /θ/ in the Castilian pronunciation.
  diegovelazquez: () => '벨라[THㅡ]케[THㅡ]'
};

const koreanArtistDisplayOverrides = {
  Q43270: '브뤼헐, 피터르 대',
  Q213163: '비제 르 브룅, 엘리자베스 루이',
  Q82445: '툴루즈로트레크, 앙리 드',
  Q301: '엘 그레코',
  Q5592: '부오나로티, 미켈란젤로',
  Q5597: '산치오, 라파엘로',
  Q5598: '렘브란트 하르먼손 판 레인'
};

function koreanFamilyFirst(name, originalName) {
  if (String(name || '').includes(',')) return String(name || '').trim();
  const korean = String(name || '').trim().split(/\s+/);
  const original = String(originalName || '').trim().split(/\s+/);
  if (korean.length < 2 || original.length < 2) return korean.join(' ');
  const familyPrefixes = new Set(['van', 'von', 'de', 'del', 'della', 'da', 'di', 'du', 'la', 'le', 'der', 'den', 'ten', 'ter', 'st.', 'saint']);
  let familyLength = 1;
  for (let index = original.length - 2; index >= 0 && familyPrefixes.has(original[index].toLowerCase()); index--) familyLength++;
  if (familyLength >= korean.length) return korean.join(' ');
  return `${korean.slice(-familyLength).join(' ')}, ${korean.slice(0, -familyLength).join(' ')}`;
}

function displayName(artist) {
  const korean = artist?.name?.ko || '';
  return koreanArtistDisplayOverrides[artist?.qid] || koreanFamilyFirst(korean, artist?.name?.en || '');
}

function latinKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function slug(value) {
  return latinKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'artist';
}
function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function targetCues(original) {
  const text = latinKey(original);
  const cues = [];
  for (let i = 0; i < text.length;) {
    if (text.startsWith('th', i)) { cues.push('TH'); i += 2; continue; }
    if (text.startsWith('ph', i)) { cues.push('F'); i += 2; continue; }
    if (text.startsWith('ch', i)) { cues.push('CH'); i += 2; continue; }
    const ch = text[i];
    if (ch === 'f') cues.push('F');
    else if (ch === 'v' || ch === 'w') cues.push('V');
    else if (ch === 'z') cues.push('Z');
    else if (ch === 'r') cues.push('R');
    else if (ch === 'x' || (ch === 'g' && text[i + 1] === 'h')) cues.push('X');
    i += ch === 'g' && text[i + 1] === 'h' ? 2 : 1;
  }
  return cues;
}

function consonantEvents(original) {
  const text = latinKey(original);
  const events = [];
  for (let i = 0; i < text.length;) {
    if (text.startsWith('th', i)) { events.push({token: 'TH', target: true, allowed: TARGET_ONSETS.TH}); i += 2; continue; }
    if (text.startsWith('ph', i)) { events.push({token: 'F', target: true, allowed: TARGET_ONSETS.F}); i += 2; continue; }
    if (text.startsWith('ch', i)) { events.push({token: 'CH', target: true, allowed: TARGET_ONSETS.CH}); i += 2; continue; }
    if (text.startsWith('gh', i)) { events.push({token: 'X', target: true, allowed: TARGET_ONSETS.X}); i += 2; continue; }
    const ch = text[i];
    if (ch === 'f') events.push({token: 'F', target: true, allowed: TARGET_ONSETS.F});
    else if (ch === 'v' || ch === 'w') events.push({token: 'V', target: true, allowed: TARGET_ONSETS.V});
    else if (ch === 'z') events.push({token: 'Z', target: true, allowed: TARGET_ONSETS.Z});
    else if (ch === 'r') events.push({token: 'R', target: true, allowed: TARGET_ONSETS.R});
    else if (ch === 'x') events.push({token: 'X', target: true, allowed: TARGET_ONSETS.X});
    else if (ch === 'l') events.push({target: false, allowed: PASSTHROUGH_ONSETS.L});
    else if (PASSTHROUGH_ONSETS[ch.toUpperCase()]) events.push({target: false, allowed: PASSTHROUGH_ONSETS[ch.toUpperCase()]});
    i++;
  }
  return events;
}

function hangulParts(char) {
  const code = char.codePointAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const index = code - 0xAC00;
  return {
    onset: ONSETS[Math.floor(index / (21 * 28))],
    vowel: VOWELS[Math.floor((index % (21 * 28)) / 28)],
    final: FINALS[index % 28]
  };
}

function notationSyllable(char, token) {
  const parts = hangulParts(char);
  return parts ? `[${token}${parts.vowel}${parts.final}]` : char;
}

function applyCuesToKorean(original, korean) {
  const source = String(korean || '');
  const chars = Array.from(source);
  const used = new Set();
  // A numeric ordinal such as "2세" is Korean editorial notation, not a
  // syllable that represents a sound in the foreign name.  In particular,
  // the `th` in "the Younger" must never turn the `세` of "2세" into TH.
  for (const match of source.matchAll(/\d+\s*세/g)) {
    const start = Array.from(source.slice(0, match.index)).length;
    const ordinalChars = Array.from(match[0]);
    ordinalChars.forEach((char, offset) => {
      if (char === '세') used.add(start + offset);
    });
  }
  let cursor = 0;
  for (const event of consonantEvents(original)) {
    const allowed = event.allowed;
    if (!allowed) continue;
    for (let index = cursor; index < chars.length; index++) {
      if (used.has(index)) continue;
      const parts = hangulParts(chars[index]);
      if (!parts || !allowed.has(parts.onset)) continue;
      if (event.target) chars[index] = notationSyllable(chars[index], event.token);
      used.add(index);
      cursor = index + 1;
      break;
    }
  }
  return chars.join('');
}

function autoNotation(original, korean) {
  const originalWords = latinKey(original).match(/[a-z]+/g) || [];
  const koreanWords = String(korean || '').match(/[가-힣]+/g) || [];
  if (originalWords.length > 1 && originalWords.length === koreanWords.length) {
    let wordIndex = 0;
    return String(korean || '').replace(/[가-힣]+/g, word => applyCuesToKorean(originalWords[wordIndex++] || '', word));
  }
  return applyCuesToKorean(original, korean);
}

function displayNotation(canonicalKorean, canonicalNotation, displayKorean) {
  const display = String(displayKorean || canonicalKorean || '');
  const canonical = String(canonicalKorean || '');
  if (!display || display === canonical) return canonicalNotation;
  const sourceWords = canonical.split(/\s+/).filter(Boolean);
  const notationWords = String(canonicalNotation || '').split(/\s+/).filter(Boolean);
  const wordMap = new Map();
  sourceWords.forEach((word, index) => {
    if (!wordMap.has(word) && notationWords[index]) wordMap.set(word, notationWords[index]);
  });
  return display.replace(/[가-힣]+/g, word => wordMap.get(word) || autoNotation('', word));
}

function createNameRecord({id, original, korean, displayKorean}={}) {
  original = String(original || '');
  korean = String(korean || '');
  const shown = String(displayKorean || korean || original);
  const canonicalNotation = autoNotation(original, korean || shown);
  const manual = manualUHangulByOriginal[normalizeText(latinKey(original))];
  return {
    id: id || slug(original || shown),
    original,
    korean,
    displayKorean: shown,
    uhangul: manual ? manual({original, korean, displayKorean: shown}) : displayNotation(korean || shown, canonicalNotation, shown),
    note: 'auto-generated from original and Korean artist names'
  };
}

function artistRecord(artist) {
  const original = artist?.name?.en || '';
  const korean = artist?.name?.ko || '';
  return createNameRecord({id:artist.qid || artist.id,original,korean,displayKorean:displayName(artist) || korean || original});
}

function buildArtistMap(artists) {
  return (Array.isArray(artists) ? artists : [])
    .filter(artist => artist?.name?.ko || artist?.name?.en)
    .map(artistRecord);
}

function writeArtistMap(artists, targetFile = mapFile) {
  const records = buildArtistMap(artists);
  fs.mkdirSync(path.dirname(targetFile), {recursive: true});
  fs.writeFileSync(targetFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  return records;
}

if (require.main === module) {
  const payload = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
  const records = writeArtistMap(payload.artists || []);
  console.log(JSON.stringify({records: records.length, file: path.relative(root, mapFile).replace(/\\/g, '/')}, null, 2));
}

module.exports = {buildArtistMap, writeArtistMap, createNameRecord};
