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
  rogiervanderweyden: () => '[Vㅏㄴ] 데르 [Vㅔ]이던, [Rㅗ]히어르',
  // In standard Spanish, the initial v of Velázquez is /b/ rather than the
  // English /v/, and both z letters are /θ/ in the Castilian pronunciation.
  diegovelazquez: ({displayKorean, korean}) => String(displayKorean || korean || '벨라스케스').replace(/벨라스케스/g, '벨라[THㅡ]케[THㅡ]')
};

const manualAliasesByOriginal = {
  leonardodavinci: {
    ko: ['레오나르도', '다 빈치', '다빈치', '빈치'],
    en: ['Leonardo', 'da Vinci']
  },
  michelangelobuonarroti: {
    ko: ['미켈란젤로', '부오나로티'],
    en: ['Michelangelo']
  },
  raffaellosanziodaurbino: {
    ko: ['라파엘로', '라파엘', '산치오', '라파엘로 산치오'],
    en: ['Raphael', 'Raffaello', 'Raffaello Sanzio']
  },
  tizianovecellio: {
    ko: ['티치아노', '티치아노 베첼리오', '베첼리오'],
    en: ['Titian', 'Tiziano']
  },
  titian: {
    ko: ['티치아노 베첼리오', '베첼리오'],
    en: ['Tiziano Vecellio', 'Tiziano']
  },
  jmwturner: {
    ko: ['터너', '조지프 말로드 윌리엄 터너'],
    en: ['Turner', 'JMW Turner', 'Joseph Mallord William Turner']
  },
  vincentvangogh: {
    ko: ['반 고흐', '고흐'],
    en: ['Van Gogh', 'Gogh']
  },
  pieterbruegeltheelder: {
    ko: ['브뤼헐', '피터르 브뤼헐'],
    en: ['Bruegel', 'Pieter Bruegel']
  },
  lucascranachtheelder: {
    ko: ['크라나흐', '루카스 크라나흐'],
    en: ['Cranach', 'Lucas Cranach']
  },
  hansholbeintheyounger: {
    ko: ['홀바인', '한스 홀바인'],
    en: ['Holbein', 'Hans Holbein']
  },
  henridetoulouselautrec: {
    ko: ['툴루즈로트레크', '로트레크', '앙리 드 툴루즈로트레크'],
    en: ['Toulouse-Lautrec', 'Lautrec']
  },
  caspardavidfriedrich: {
    ko: ['프리드리히'],
    en: ['Friedrich']
  },
  jeanaugustedominiqueingres: {
    ko: ['앵그르'],
    en: ['Ingres']
  }
};

const koreanArtistDisplayOverrides = {
  Q7814: '디 본도네, 조토',
  Q43270: '브뤼헐, 피터르 대',
  Q213163: '비제 르 브룅, 엘리자베스 루이',
  Q82445: '툴루즈로트레크, 앙리 드',
  Q301: '엘 그레코',
  Q5592: '부오나로티, 미켈란젤로',
  Q5597: '산치오, 라파엘로',
  Q5598: '렘브란트 하르먼손 반 레인'
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

function uniqueAliases(values, canonicalValues = []) {
  const canonical = new Set(canonicalValues.map(normalizeText).filter(Boolean));
  const seen = new Set();
  const aliases = [];
  for (const value of values) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    const key = normalizeText(text);
    if (!text || text.length < 2 || !key || canonical.has(key) || seen.has(key)) continue;
    seen.add(key);
    aliases.push(text);
  }
  return aliases;
}

function nameWithoutSuffix(words) {
  const source = [...words];
  while (source.length >= 2 && /^the$/i.test(source[source.length - 2]) && /^(elder|younger)$/i.test(source[source.length - 1])) source.splice(source.length - 2, 2);
  return source;
}

function englishNameAliases(original) {
  const source = String(original || '').trim();
  const words = source.match(/[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+/g) || [];
  const compactWords = nameWithoutSuffix(words);
  const familyPrefixes = new Set(['van', 'von', 'de', 'del', 'della', 'da', 'di', 'du', 'la', 'le', 'der', 'den', 'ten', 'ter', 'st.', 'saint']);
  const aliases = [];
  if (source.normalize('NFD').replace(/[\u0300-\u036f]/g, '') !== source) aliases.push(source.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (compactWords.length > 1) {
    let start = compactWords.length - 1;
    while (start > 0 && familyPrefixes.has(compactWords[start - 1].toLowerCase())) start--;
    aliases.push(compactWords.slice(start).join(' '));
    aliases.push(compactWords[compactWords.length - 1]);
  }
  if (/\bthe\s+(Elder|Younger)\b/i.test(source)) aliases.push(source.replace(/\s+the\s+(Elder|Younger)\b/i, ''));
  return aliases;
}

function koreanNameAliases(korean, displayKorean) {
  const aliases = [];
  for (const value of [korean, displayKorean]) {
    const source = String(value || '').trim();
    if (!source) continue;
    if (source.includes(',')) {
      const [family, given] = source.split(',').map(part => part.trim()).filter(Boolean);
      if (family) aliases.push(family);
      if (family && given) aliases.push(`${given} ${family}`);
      continue;
    }
    const words = source.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const particles = new Set(['반', '판', '폰', '데', '드', '델', '다', '디', '더', '르', '라', '레', '테르']);
      let start = words.length - 1;
      while (start > 0 && particles.has(words[start - 1])) start--;
      aliases.push(words.slice(start).join(' '));
      aliases.push(words[words.length - 1]);
    }
  }
  return aliases;
}

function aliasesForName(original, korean, displayKorean) {
  const originalKey = normalizeText(latinKey(original));
  const manual = manualAliasesByOriginal[originalKey] || {};
  return {
    ko: uniqueAliases([...koreanNameAliases(korean, displayKorean), ...(manual.ko || [])], [korean, displayKorean]),
    en: uniqueAliases([...englishNameAliases(original), ...(manual.en || [])], [original])
  };
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
    aliases: aliasesForName(original, korean || shown, shown),
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

module.exports = {buildArtistMap, writeArtistMap, createNameRecord, aliasesForName};
