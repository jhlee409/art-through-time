function favoriteKey(artist, work) { return `${artist?.id || ''}::${work?.id || selectionKey(work)}`; }
function selectedFavoriteWorks() {
  const selected = [];
  artists.forEach(artist => (artist.works || []).forEach(work => {
    if (favoriteWorkKeys.has(favoriteKey(artist, work))) selected.push({artist, work});
  }));
  return selected;
}
function classificationTextValues(value) {
  const values = [];
  const visit = item => {
    if (item === null || item === undefined) return;
    if (typeof item === 'string' || typeof item === 'number') {
      const text = String(item).trim();
      if (text) values.push(text);
      return;
    }
    if (Array.isArray(item)) return item.forEach(visit);
    if (typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return values;
}
function artworkClassificationTexts(work, artist) {
  return [
    artworkThumbnailTitle(work, artist),
    ...artworkTitleAliases(work),
    work?.id,
    work?.title,
    work?.description,
    work?.genre,
    work?.genres,
    work?.subjects,
    work?.tags,
    work?.detail?.facts?.genre,
    work?.detail?.facts?.genres,
    work?.detail?.facts?.subject,
    work?.detail?.facts?.subjects
  ].flatMap(classificationTextValues);
}
function isPortraitArtwork(work, artist) {
  const texts = artworkClassificationTexts(work, artist);
  const joined = texts.join(' \n ');
  return /초상|자화상|인물화/.test(joined)
    || /\b(?:self[-\s]?portrait|portrait|portraits|portraiture)\b/i.test(joined);
}
function compactArtworkGroupingKey(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
function cleanArtworkSeriesLabel(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[《》〈〉"“”]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:the|a|an)\s+/i, '')
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)\s*$/i, '')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?\s*$/i, '')
    .trim();
}
function isGenericSeriesLabel(label) {
  const key = compactArtworkGroupingKey(label);
  return !key
    || key.length < 2
    || new Set([
      'portrait','portraits','portraiture','selfportrait','selfportraits',
      '초상','초상화','자화상','인물화',
      'study','studies','sketch','sketches','untitled','composition',
      '무제','습작','스케치','구성',
      'man','woman','boy','girl','figure','figures','lady','child',
      '남자','여자','여인','소녀','소년','아이','인물'
    ]).has(key);
}
function artworkSeriesTitleCandidateEntries(work, artist) {
  const candidates = [];
  const add = (value, slot='full') => {
    const label = cleanArtworkSeriesLabel(value);
    if (!label || isGenericSeriesLabel(label)) return;
    const key = compactArtworkGroupingKey(label);
    if (!key || key.length < 2) return;
    candidates.push({key, label, slot});
  };
  const addSplitParts = (cleaned, pattern, slotName) => {
    const parts = cleaned.split(pattern).map(cleanArtworkSeriesLabel).filter(Boolean);
    if (parts.length < 2) return;
    parts.slice(0, 2).forEach((part, index) => add(part, `${slotName}:${index}`));
  };
  const titles = [artworkThumbnailTitle(work, artist), ...artworkTitleAliases(work)];
  titles.forEach(title => {
    const cleaned = cleanArtworkSeriesLabel(title);
    if (!cleaned) return;
    add(cleaned);
    [
      cleaned.split(/\s+[—–-]\s+/)[0],
      cleaned.split(/\s*[:：]\s*/)[0],
      cleaned.split(/\s*,\s*/)[0],
      cleaned.split(/\s+\band\b\s+/i)[0],
      cleaned.split(/\s+\bwith\b\s+/i)[0]
    ].forEach(add);
    addSplitParts(cleaned, /\s+\band\b\s+/i, 'connector');
    addSplitParts(cleaned, /(?:과|와|및)\s+/, 'connector');
  });
  return [...new Map(candidates.map(item => [`${item.slot}:${item.key}`, item])).values()];
}
function preferredSeriesLabel(labels) {
  const unique = [...new Set(labels.map(cleanArtworkSeriesLabel).filter(Boolean))];
  const preferredLocale = label => language === 'ko' ? /[가-힣]/.test(label) : /[a-z]/i.test(label);
  return unique.sort((left, right) =>
    Number(preferredLocale(right)) - Number(preferredLocale(left))
    || left.length - right.length
    || left.localeCompare(right, language === 'ko' ? 'ko' : 'en')
  )[0] || '';
}
function buildArtworkSeriesGroups(works, artist) {
  const records = works.map(work => ({
    work,
    titleKeys: [...new Set([artworkThumbnailTitle(work, artist), ...artworkTitleAliases(work)]
      .map(compactArtworkGroupingKey)
      .filter(Boolean))]
  }));
  const parent = new Map();
  const find = key => {
    if (!parent.has(key)) parent.set(key, key);
    const next = parent.get(key);
    if (next === key) return key;
    const root = find(next);
    parent.set(key, root);
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left), rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  const candidateLabels = new Map();
  records.forEach(record => {
    const entries = artworkSeriesTitleCandidateEntries(record.work, artist);
    const bySlot = new Map();
    entries.forEach(candidate => {
      find(candidate.key);
      candidateLabels.set(candidate.key, [...(candidateLabels.get(candidate.key) || []), candidate.label]);
      bySlot.set(candidate.slot, [...(bySlot.get(candidate.slot) || []), candidate.key]);
    });
    bySlot.forEach(keys => keys.slice(1).forEach(key => union(keys[0], key)));
  });
  const candidateClusters = new Map();
  candidateLabels.forEach((labels, key) => {
    const root = find(key);
    const cluster = candidateClusters.get(root) || {keys:new Set(), labels:[]};
    cluster.keys.add(key);
    cluster.labels.push(...labels);
    candidateClusters.set(root, cluster);
  });
  const groups = [...candidateClusters.values()].map(cluster => {
    const keys = [...cluster.keys];
    const groupWorks = records
      .filter(record => record.titleKeys.some(titleKey => keys.some(key => titleKey.includes(key))))
      .map(record => record.work);
    return {
      key: keys.sort((left, right) => left.length - right.length)[0],
      label: preferredSeriesLabel(cluster.labels),
      works: [...new Map(groupWorks.map(work => [String(work.id || selectionKey(work)), work])).values()]
    };
  }).filter(group => group.works.length >= 2 && group.label && !isGenericSeriesLabel(group.label));
  const selected = [];
  groups.sort((left, right) => right.works.length - left.works.length || left.label.length - right.label.length).forEach(group => {
    const ids = new Set(group.works.map(work => String(work.id || selectionKey(work))));
    const duplicatesExisting = selected.some(existing => {
      const existingIds = new Set(existing.works.map(work => String(work.id || selectionKey(work))));
      const overlap = [...ids].filter(id => existingIds.has(id)).length;
      return overlap / Math.min(ids.size, existingIds.size) >= 0.8;
    });
    if (!duplicatesExisting) selected.push(group);
  });
  return selected;
}
function persistFavoriteWorks() {
  if (currentUserIsAdmin) localStorage.setItem(favoriteWorksStorageKey, JSON.stringify([...favoriteWorkKeys]));
  else localStorage.removeItem(favoriteWorksStorageKey);
  queueArtistSave();
}
