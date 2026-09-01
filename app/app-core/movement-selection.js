const movementNameContains = (longer,shorter) => {
  const compactLonger = longer.replace(/[^\p{L}\p{N}]+/gu,'');
  const compactShorter = shorter.replace(/[^\p{L}\p{N}]+/gu,'');
  const index = compactLonger.indexOf(compactShorter);
  if (index < 0) return false;
  const prefix = compactLonger.slice(0,index);
  return !/(?:post|neo|néo|후기|신)$/.test(prefix);
};
function movementNamesMatch(left,right) {
  const leftNames = movementNameParts(left);
  const rightNames = movementNameParts(right);
  return leftNames.some(leftName => rightNames.some(rightName =>
    leftName === rightName || movementNameContains(leftName,rightName) || movementNameContains(rightName,leftName)
  ));
}
const workMovementText = work => movementNameParts(work?.movement).join(' ');
function representativeScore(work, artist={}) {
  const source = String(work?.source || '');
  const movement = workMovementText(work);
  let score = workPopularity(work);
  if (work?.origin === 'curated') score += 100000;
  if (work?.image || work?.thumbnail) score += 1200;
  if (work?.verified) score += 600;
  if (/wikidata\.org|commons\.wikimedia\.org|api\.artic\.edu|clevelandart\.org/i.test(source)) score += 420;
  if (/wikipedia\.org/i.test(source)) score -= 120;
  if (movementNamesMatch(work?.movement,artist?.movement)) score += 900;
  if (movement) score += 240;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}
function movementMatchesArtist(work, artist={}) {
  return movementNamesMatch(work?.movement,artist?.movement);
}
function movementContributionScore(work, artist={}) {
  let score = representativeScore(work, artist);
  if (movementMatchesArtist(work, artist)) score += 5000;
  if (work?.origin === 'curated') score += 1800;
  if (work?.verified) score += 500;
  return score;
}
const workYearLabel = work => {
  const start = work?.year;
  const end = work?.yearEnd;
  if (!start) return '';
  return end && Number(end) !== Number(start) ? `${start}–${end}` : String(start);
};
function selectArtistWorks(works, limit=artistImportedWorkLimit, artist={}) {
  const byKey = new Map();
  const idCounts = new Map();
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    const key = id && idCounts.get(id) > 1 ? `id:${id}` : selectionKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {...work,...existing,popularity:Math.max(workPopularity(existing),workPopularity(work))} : work);
  });
  const unique = [...byKey.values()];
  const manualWorks = unique.filter(isManualWork).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const manualKeys = new Set(manualWorks.map(selectionKey));
  const curatedWorks = unique.filter(work => work?.origin === 'curated' && !manualKeys.has(selectionKey(work))).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const curatedKeys = new Set(curatedWorks.map(selectionKey));
  const localWorks = unique.filter(work => !manualKeys.has(selectionKey(work)) && !curatedKeys.has(selectionKey(work)) && hasLocalArtworkAsset(work)).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const localKeys = new Set(localWorks.map(selectionKey));
  const generatedWorks = unique.filter(work => !manualKeys.has(selectionKey(work)) && !curatedKeys.has(selectionKey(work)) && !localKeys.has(selectionKey(work))).sort((a,b) => representativeScore(b,artist) - representativeScore(a,artist) || workYearForSort(a) - workYearForSort(b));
  const selected = [...manualWorks,...curatedWorks,...localWorks,...generatedWorks.slice(0,Math.max(0,limit-manualWorks.length-curatedWorks.length-localWorks.length))];
  const authoritativeContributions = selected.filter(work =>
    work?.movementContribution && work?.movementContributionReason !== 'artist-movement-characteristic'
  );
  const aligned = selected.filter(work => movementMatchesArtist(work, artist));
  const contributionPool = aligned.length ? aligned : selected;
  const movementContributionKeys = new Set(
    (authoritativeContributions.length ? authoritativeContributions : contributionPool
      .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
      .slice(0,3))
      .map(selectionKey)
  );
  return selected.map(work => {
    const movementContribution = movementContributionKeys.has(selectionKey(work));
    const next = {...work,movementContribution};
    if (!movementContribution) delete next.movementContributionReason;
    else if (!authoritativeContributions.length) next.movementContributionReason = 'artist-movement-characteristic';
    return next;
  }).sort((a,b) => workYearForSort(a) - workYearForSort(b));
}
function koreanFamilyFirst(name, originalName) {
  if (String(name || '').includes(',')) return String(name || '').trim();
  const korean = String(name || '').trim().split(/\s+/), original = String(originalName || '').trim().split(/\s+/);
  if (korean.length < 2 || original.length < 2) return korean.join(' ');
  const familyPrefixes = new Set(['van','von','de','del','della','da','di','du','la','le','der','den','ten','ter','st.','saint']);
  let familyLength = 1;
  for (let index = original.length - 2; index >= 0 && familyPrefixes.has(original[index].toLowerCase()); index--) familyLength++;
  if (familyLength >= korean.length) return korean.join(' ');
  return `${korean.slice(-familyLength).join(' ')}, ${korean.slice(0, -familyLength).join(' ')}`;
}
const koreanArtistDisplayOverrides = {
  Q7814: '디 본도네, 조토',
  Q43270: '브뤼헐, 피터르 대',
  Q213163: '비제 르 브룅, 엘리자베스 루이',
  Q82445: '툴루즈로트레크, 앙리 드',
  Q301: '엘 그레코',
  Q5592: '부오나로티, 미켈란젤로',
  Q5597: '산치오, 라파엘로',
  Q5598: '렘브란트 하르먼손 반 레인',
  Q312617: '로소 피오렌티노'
};
const koreanArtistListNameOverrides = {
  Q7814: '조토',
  Q102272: '반 에이크',
  Q68631: '반 데르 베이던',
  Q762: '다 빈치',
  Q5592: '미켈란젤로',
  Q5597: '라파엘로',
  Q47551: '티치아노',
  Q312617: '로소',
  Q48319: '홀바인',
  Q7803: '브론치노',
  Q9348: '파르미자니노',
  Q9319: '틴토레토',
  Q43270: '브뤼헐',
  Q301: '엘 그레코',
  Q42207: '카라바조',
  Q5598: '렘브란트',
  Q82445: '툴루즈로트레크',
  Q155151: '바토',
  Q296: '모네'
};
const koreanNameParticles = new Set(['반', '판', '폰', '데', '드', '델', '다', '디', '더', '르', '라', '레', '테르']);
function koreanNameFirst(name) {
  const source = String(name || '').trim();
  if (!source.includes(',')) return source;
  const [family, given] = source.split(',').map(part => part.trim()).filter(Boolean);
  return [given, family].filter(Boolean).join(' ') || source;
}
function artistDisplayName(artist) {
  if (language !== 'ko') return loc(artist?.name);
  return artistStandardKoreanName(artist);
}
function artistStandardKoreanName(artist) {
  return koreanNameFirst(artist?.name?.ko || loc(artist?.name) || artist?.fullName || '');
}
function artistUHangulDisplayName(artist) {
  const koreanName = artistStandardKoreanName(artist);
  return koreanArtistDisplayOverrides[artist?.qid] || koreanFamilyFirst(koreanName, artist?.name?.en || '');
}
function artistListKoreanName(artist) {
  const explicit = artist?.listName?.ko || artist?.shortName?.ko;
  if (explicit) return explicit;
  const qid = artist?.qid;
  if (koreanArtistListNameOverrides[qid]) return koreanArtistListNameOverrides[qid];
  const aliases = textList(artist?.aliases?.ko || []);
  const standard = artistStandardKoreanName(artist);
  const alias = aliases.find(value => {
    const text = String(value || '').trim();
    return text && !text.includes(',') && text !== standard && text.split(/\s+/).length <= 3;
  });
  if (alias) return alias;
  const words = standard.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length <= 1) return standard;
  let start = words.length - 1;
  while (start > 0 && koreanNameParticles.has(words[start - 1])) start--;
  return words.slice(start).join(' ');
}
