/* uHangul v0.7 core — ONSET ONLY
 * One completed extended syllable = one SPUA-A code point.
 * No new consonant may occur in final position.
 */
export const VERSION = "0.7";
export const SPUA_BASE = 0xFB000;
export const NEW = Object.freeze(["F","V","Z","R","X","TH"]);
export const VOWELS = Object.freeze(Array.from("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"));
export const FINALS = Object.freeze(["", ...Array.from("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")]);

function tokenizeBlock(block) {
  const tokens = [];
  for (let i = 0; i < block.length;) {
    const token = NEW.filter(value => value.length > 1)
      .sort((a, b) => b.length - a.length)
      .find(value => block.startsWith(value, i));
    if (token) { tokens.push(token); i += token.length; continue; }
    tokens.push(block[i++]);
  }
  return tokens;
}

export function blockToCodePoint(block) {
  const t = tokenizeBlock(String(block).trim());
  if (t.length < 2 || t.length > 3) {
    throw new Error(`uHangul v0.7 block must be onset+vowel(+existing final): [${block}]`);
  }

  const [onset, vowel, final = ""] = t;
  const oi = NEW.indexOf(onset);
  const vi = VOWELS.indexOf(vowel);
  const fi = FINALS.indexOf(final);

  if (oi < 0) {
    throw new Error(`uHangul v0.7 requires a NEW consonant in ONSET position: [${block}]`);
  }
  if (vi < 0) throw new Error(`Invalid vowel in [${block}]`);
  if (final && NEW.includes(final)) {
    throw new Error(`New consonants are onset-only in v0.7; invalid final in [${block}]`);
  }
  if (fi < 0) throw new Error(`Invalid existing Hangul final in [${block}]`);

  return SPUA_BASE + ((oi * 21 + vi) * 28 + fi);
}

export function encodeUHangulNotation(input) {
  return String(input).replace(/\[([^\]]+)\]/g, (_, block) =>
    String.fromCodePoint(blockToCodePoint(block))
  );
}

export function validateUHangulNotation(input) {
  const errors = [];
  String(input).replace(/\[([^\]]+)\]/g, (whole, block) => {
    try { blockToCodePoint(block); }
    catch (e) { errors.push({ block, error: e.message }); }
    return whole;
  });
  return errors;
}
