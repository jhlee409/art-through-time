/* uHangul v0.5 core — ONSET ONLY
 * One completed extended syllable = one SPUA-A code point.
 * No new consonant may occur in final position.
 */
export const VERSION = "0.5";
export const SPUA_BASE = 0xF8000;
export const NEW = Object.freeze(["F","V","Z","R","TH","X","CH"]);
export const VOWELS = Object.freeze(Array.from("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"));
export const FINALS = Object.freeze(["", ...Array.from("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")]);

function tokenizeBlock(block) {
  const tokens = [];
  for (let i = 0; i < block.length;) {
    if (block.startsWith("TH", i)) { tokens.push("TH"); i += 2; continue; }
    if (block.startsWith("CH", i)) { tokens.push("CH"); i += 2; continue; }
    tokens.push(block[i++]);
  }
  return tokens;
}

export function blockToCodePoint(block) {
  const t = tokenizeBlock(String(block).trim());
  if (t.length < 2 || t.length > 3) {
    throw new Error(`uHangul v0.5 block must be onset+vowel(+existing final): [${block}]`);
  }

  const [onset, vowel, final = ""] = t;
  const oi = NEW.indexOf(onset);
  const vi = VOWELS.indexOf(vowel);
  const fi = FINALS.indexOf(final);

  if (oi < 0) {
    throw new Error(`uHangul v0.5 requires a NEW consonant in ONSET position: [${block}]`);
  }
  if (vi < 0) throw new Error(`Invalid vowel in [${block}]`);
  if (final && NEW.includes(final)) {
    throw new Error(`New consonants are onset-only in v0.5; invalid final in [${block}]`);
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
