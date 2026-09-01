function artistListMovementLabelKey(movement) {
  return compactMovementName(movement?.name?.en || movement?.name?.ko || loc(movement?.name));
}
function artistListMovementDisplayRule(movement) {
  const key = artistListMovementLabelKey(movement);
  return artistMovementDisplayRules.find(rule => rule.keys.has(key)) || null;
}
function artistListMovementFamilyKey(label) {
  return compactMovementName(label?.en || label?.ko || loc(label));
}
function artistListMovementGroupKey(movement) {
  const key = artistListMovementLabelKey(movement);
  const rule = artistListMovementDisplayRule(movement);
  if (rule?.parent) return `parent:${artistListMovementFamilyKey(rule.parent)}`;
  const hierarchyGroup = artistMovementFilterHierarchy.find(group => movementFilterTreeKeys(group).has(key));
  if (hierarchyGroup) return `parent:${artistListMovementFamilyKey(hierarchyGroup.label)}`;
  const family = artistListMovementFamilySpecs.find(spec => spec.keys.has(key));
  return family ? `parent:${artistListMovementFamilyKey(family.label)}` : `movement:${key}`;
}
function artistListMovementCountryLabel(entry, compact=false) {
  const names = (entry.countryNames || [entry.countryName]).map(name => loc(name)).filter(Boolean);
  if (!compact || names.length <= 2) return names.join(', ');
  return language === 'ko' ? `${names[0]} 외 ${names.length - 1}개국` : `${names[0]} + ${names.length - 1}`;
}
function artistListMovementSortStart(entry) {
  const year = Number(entry?.sourceStart ?? entry?.start);
  return Number.isFinite(year) ? year : 0;
}
function artistListMovementSortEnd(entry) {
  const year = Number(entry?.sourceEnd ?? entry?.end);
  return Number.isFinite(year) ? year : artistListMovementSortStart(entry);
}
function artistListMovementKeyMatchesArtistEntry(rowMovementKey, artistEntry) {
  if (!artistEntry?.id) return false;
  if (artistEntry.id === rowMovementKey) return true;
  const rule = artistMovementDisplayRules.find(item => item.keys.has(artistEntry.id));
  const documentKey = compactMovementName(rule?.documentLabel?.en || rule?.documentLabel?.ko || loc(rule?.documentLabel));
  const parentKey = compactMovementName(rule?.parent?.en || rule?.parent?.ko || loc(rule?.parent));
  if (documentKey && documentKey === rowMovementKey) return true;
  if (parentKey && parentKey === rowMovementKey) return true;
  const rowAliases = {
    flemishbaroque: ['flemishbaroquepainting']
  };
  if ((rowAliases[rowMovementKey] || []).includes(artistEntry.id)) return true;
  const hierarchyMatches = node => {
    if (artistListMovementFamilyKey(node.label) === rowMovementKey && movementFilterTreeKeys(node).has(artistEntry.id)) return true;
    return (node.children || []).some(hierarchyMatches);
  };
  return artistMovementFilterHierarchy.some(hierarchyMatches);
}
function artistListPrimaryActivityCountry(artist) {
  if (artist?.movementActivityCountry) return artist.movementActivityCountry;
  const regions = (Array.isArray(artist?.regions) ? artist.regions : []).filter(Boolean);
  // When no movement-specific country is set, use the last recorded activity region.
  return regions.at(-1) || artistCountrySource(artist);
}
function artistListArtistCountryIds(artist) {
  const activityCountry = countryInfo(artistListPrimaryActivityCountry(artist));
  const countryId = allMovementCountryIds.find(id => countryArtTextMatches(activityCountry.name, id));
  return countryId ? [countryId] : [];
}
function artistListArtistLifeSpan(artist) {
  const numericYear = value => value === null || value === undefined || value === '' ? null : Number(value);
  const workYears = (artist?.works || []).flatMap(work => String(work?.yearLabel ?? work?.year ?? '').match(/\d{3,4}/g) || []).map(Number).filter(Number.isFinite);
  const birth = numericYear(artist?.birth);
  const activeFrom = numericYear(artist?.activeFrom);
  const firstWork = workYears.length ? Math.min(...workYears) : null;
  const start = Number.isFinite(birth) ? birth : (Number.isFinite(activeFrom) ? activeFrom : firstWork);
  if (!Number.isFinite(start)) return null;
  const death = numericYear(artist?.death);
  const activeTo = numericYear(artist?.activeTo);
  const lastWork = workYears.length ? Math.max(...workYears) : null;
  const unknownDeathEnd = Number.isFinite(birth)
    ? Math.min(movementAtlasEnd, Math.max(birth + 80, Number.isFinite(lastWork) ? lastWork : birth + 80))
    : movementAtlasEnd;
  const end = Number.isFinite(death)
    ? death
    : (Number.isFinite(activeTo) ? activeTo : (artist?.death === null ? movementAtlasEnd : unknownDeathEnd));
  return {start, end:Math.max(start + 1, end)};
}
function artistListLastRegisteredWorkYear(artist) {
  return Math.max(...(artist?.works || []).map(work => {
    const explicitEnd=Number(work?.yearEnd);
    if (Number.isFinite(explicitEnd)) return explicitEnd;
    const values=String(work?.year ?? '').match(/\d{3,4}/g) || [];
    return Number(values.at(-1));
  }).filter(Number.isFinite), Number.NEGATIVE_INFINITY);
}
function artistListIndependentActivitySpan(artist, boxStart, boxEnd, activityStart=boxStart, activityEnd=boxEnd) {
  const activeFrom=Number(artist?.activeFrom);
  const lastWork=artistListLastRegisteredWorkYear(artist);
  if (!Number.isFinite(activeFrom) || !Number.isFinite(lastWork) || lastWork < activeFrom) return null;
  const start=Math.max(boxStart, activityStart, activeFrom);
  const end=Math.min(boxEnd, activityEnd, lastWork);
  if (end < start) return null;
  const span=Math.max(1, boxEnd-boxStart);
  return {start:((start-boxStart)/span)*100,end:((end-boxStart)/span)*100};
}
function artistListArtistsForMovement(entry) {
  const movementKey = entry.parentMovementKey || artistListMovementLabelKey(entry);
  const movementStart = Number(entry.sourceStart ?? entry.start);
  const movementEnd = Number(entry.sourceEnd ?? entry.end);
  const countryIds = new Set(entry.countryIds || [entry.countryId].filter(Boolean));
  const declaredArtistIds=entry.artistIds || [];
  let representativeIds=declaredArtistIds;
  let primaryIds=new Set(entry.primaryArtistIds || declaredArtistIds);
  // Parent bars without an explicit artist assignment use only registered
  // artists whose canonical movement and activity country match the selection.
  if (!representativeIds.length) {
    const fallbackArtists=(artists || []).filter(artist => {
      const artistCountryIds=artistListArtistCountryIds(artist);
      return artistCountryIds.some(countryId => countryIds.has(countryId)) && artistMovementEntries(artist).some(artistEntry => artistListMovementKeyMatchesArtistEntry(movementKey, artistEntry));
    }).slice(0, 4);
    representativeIds=fallbackArtists.map(artist => artist.id);
    primaryIds=new Set(representativeIds.slice(0, 1));
  }
  if (!representativeIds.length) return [];
  const representativeSet=new Set(representativeIds);
  return (artists || []).map(artist => {
    const life = artistListArtistLifeSpan(artist);
    if (!life || life.start > movementEnd || life.end < movementStart) return null;
    if (!representativeSet.has(artist.id)) return null;
    const artistCountryIds = artistListArtistCountryIds(artist);
    if (!declaredArtistIds.length) {
      if (!artistCountryIds.some(countryId => countryIds.has(countryId))) return null;
      const movementEntries = artistMovementEntries(artist);
      if (!movementEntries.some(artistEntry => artistListMovementKeyMatchesArtistEntry(movementKey, artistEntry))) return null;
    }
    const countryLabel = artistCountryIds.filter(countryId => countryIds.has(countryId)).map(countryId => loc(movementCountries.find(country => country.id === countryId)?.name)).filter(Boolean).join(', ');
    return {artist, life, countryLabel, artistRole:primaryIds.has(artist.id) ? 'primary' : 'further', presentationLabel:''};
  }).filter(Boolean);
}
function artistListPillBaseHeight() {
  return Math.max(12, Math.round((window.innerHeight || window.screen?.height || 900) / 60));
}
const artistListSubmovementTopPadding = 6;
const artistListSubmovementBottomPadding = 6;
const artistListPillGap = Math.min(artistListSubmovementTopPadding, artistListSubmovementBottomPadding) * .6;
const artistListParentMovementPalette = ['#8cbfd6','#d9ab69','#9cbd91','#bc9ac7','#d48c83','#8dbab2'];
function artistListPackedArtistLayout(entry, chartStart, chartEnd, yearScale) {
  const candidates = artistListArtistsForMovement(entry).map(item => {
    const movementStart = Number(entry.sourceStart ?? entry.start);
    const movementEnd = Number(entry.sourceEnd ?? entry.end);
    const exceedsMovement = item.life.start < movementStart || item.life.end > movementEnd;
    const boxStart = Math.max(chartStart, exceedsMovement ? item.life.start : Math.max(item.life.start, movementStart));
    const boxEnd = Math.min(chartEnd, exceedsMovement ? item.life.end : Math.min(item.life.end, movementEnd));
    if (boxEnd <= boxStart) return null;
    return {...item, boxStart, boxEnd, exceedsMovement};
  }).filter(Boolean).sort((a, b) =>
    (a.artistRole === 'primary' ? 0 : 1) - (b.artistRole === 'primary' ? 0 : 1)
    || a.boxStart - b.boxStart
    || (b.boxEnd - b.boxStart) - (a.boxEnd - a.boxStart)
    || artistListKoreanName(a.artist).localeCompare(artistListKoreanName(b.artist), 'ko')
  );
  const gapYears = Math.max(1, 5 / Math.max(.01, yearScale));
  const lanes = [];
  const packed = candidates.map(item => {
    let lane = lanes.findIndex(end => item.boxStart >= end + gapYears);
    if (lane < 0) { lane = lanes.length; lanes.push(item.boxEnd); }
    else lanes[lane] = item.boxEnd;
    return {...item, lane};
  });
  return {packed, laneCount:Math.max(0,lanes.length)};
}
function artistListPackedArtistOverlayMarkup(entry, chartStart, chartEnd, yearScale, topOffset=0, layout=artistListPackedArtistLayout(entry,chartStart,chartEnd,yearScale), overlayOptions={}) {
  if (!layout.packed.length) return '';
  const movementStart=Number(entry.sourceStart ?? entry.start);
  const movementEnd=Number(entry.sourceEnd ?? entry.end);
  const boxHeight=artistListPillBaseHeight();
  const baseFontSize=Math.max(7,boxHeight*.62);
  const topBase=artistListSubmovementTopPadding;
  return layout.packed.map(item => {
    const left = (item.boxStart - chartStart) * yearScale;
    const width = Math.max(18, (item.boxEnd - item.boxStart) * yearScale);
    const top = topOffset + topBase + item.lane * (boxHeight + artistListPillGap);
    // Match the abbreviated Korean label used in the left artist list.
    const name = artistListKoreanName(item.artist);
    const yearsText = `${item.life.start}–${item.life.end}`;
    const countryText = item.countryLabel ? ` · ${item.countryLabel}` : '';
    const presentationText=item.presentationLabel ? ` · ${item.presentationLabel}` : '';
    const title = `${name}${countryText} · ${yearsText} · ${loc(entry.name)}${presentationText}`;
    const className = `${item.exceedsMovement ? ' artist-life-pill--extended' : ''}${item.artistRole === 'primary' ? ' artist-life-pill--primary' : ' artist-life-pill--further'}`;
    // A lifetime box may extend outside its parent movement range.  The blue
    // activity segment must nevertheless remain inside that box's time span.
    const activity=artistListIndependentActivitySpan(item.artist,item.boxStart,item.boxEnd,movementStart,movementEnd);
    const activityStyle=activity ? `--artist-active-start:${activity.start}%;--artist-active-end:${activity.end}%;` : '';
    const xScale = overlayOptions.density || 1;
    const yScale = overlayOptions.verticalDensity || 1;
    const heightScale = yScale / Math.max(overlayOptions.defaultFitDensity || 1, .001);
    const overlayLeft = (overlayOptions.labelColumnWidth + left) * xScale;
    const overlayTop = (overlayOptions.rowTop + top) * yScale;
    return `<button class="artist-life-pill artist-life-pill--overlay${className}" type="button" data-artist-id="${esc(item.artist.id)}" style="left:${overlayLeft}px;top:${overlayTop}px;width:${width * xScale}px;height:${boxHeight * heightScale}px;font-size:${baseFontSize * heightScale * .8}px;${activityStyle}" title="${esc(title)}"><span>${esc(name)}</span></button>`;
  }).join('');
}
function artistListParentMovementName(groupKey, rows) {
  const anchorKey = groupKey.replace(/^(?:parent|movement):/, '');
  const anchor = rows.find(row => artistListMovementLabelKey(row) === anchorKey);
  if (anchor) return anchor.name;
  const rule = rows.map(artistListMovementDisplayRule).find(item => item?.parent);
  if (rule?.parent) return rule.parent;
  const hierarchy = artistMovementFilterHierarchy.find(group => artistListMovementFamilyKey(group.label) === anchorKey);
  if (hierarchy) return hierarchy.label;
  const family = artistListMovementFamilySpecs.find(spec => artistListMovementFamilyKey(spec.label) === anchorKey);
  return family?.label || rows[0]?.name;
}
function artistListSubmovementLayout(entry, chartStart, chartEnd, yearScale) {
  const children = entry.children || [];
  const pillHeight=artistListPillBaseHeight();
  const lanes = [];
  const laneHeights=[];
  const packed = [...children].sort((a,b) => artistListMovementSortStart(a) - artistListMovementSortStart(b) || artistListMovementSortEnd(a) - artistListMovementSortEnd(b)).map(child => {
    const childStart=artistListMovementSortStart(child);
    const childEnd=artistListMovementSortEnd(child);
    const artistLayout=artistListPackedArtistLayout(child,chartStart,chartEnd,yearScale);
    // Artist life boxes can extend beyond their submovement dates. Reserve a
    // lane for the rendered span so neighboring schools remain distinct.
    const occupiedStart=Math.min(childStart,...artistLayout.packed.map(item => item.boxStart));
    const occupiedEnd=Math.max(childEnd,...artistLayout.packed.map(item => item.boxEnd));
    let lane=lanes.findIndex(end => occupiedStart >= end);
    if (lane < 0) { lane=lanes.length; lanes.push(occupiedEnd); laneHeights.push(0); }
    else lanes[lane]=occupiedEnd;
    const childHeight=artistListSubmovementTopPadding + artistListSubmovementBottomPadding + Math.max(1,artistLayout.laneCount) * pillHeight + Math.max(0,artistLayout.laneCount-1) * artistListPillGap;
    laneHeights[lane]=Math.max(laneHeights[lane],childHeight);
    return {...child, submovementLane:lane, artistLayout, submovementHeight:childHeight};
  });
  const laneGap=4.5;
  const laneOffsets=[];
  let cursor=artistListSubmovementTopPadding;
  laneHeights.forEach(height => { laneOffsets.push(cursor); cursor += height + laneGap; });
  return {
    submovements:packed.map(child => ({...child, submovementTop:laneOffsets[child.submovementLane], submovementHeight:laneHeights[child.submovementLane]})),
    rowHeight:Math.max(artistListSubmovementTopPadding + artistListSubmovementBottomPadding + 3 * pillHeight + 2 * artistListPillGap, cursor - laneGap + artistListSubmovementBottomPadding)
  };
}
function artistListMovementEntries(countries, selectedCountryIds, start, end) {
  const selected = new Set(selectedCountryIds);
  const rows = [];
  countries.filter(country => selected.has(country.id)).forEach((country, countryOrder) => {
    countryCanonicalMovements(country).forEach((movement, movementOrder) => {
      if (movementIsContextOnly(movement)) return;
      const clipped = clippedMovement(movement, start, end);
      if (!clipped) return;
      const canonicalBinding=clipped.canonical || null;
      const owner=canonicalBinding && (artMovementCanonical.parents || []).find(parent => parent.id === canonicalBinding.documentOwnerId);
      const parentDocumentName=owner?.documentKey || movementDocumentKey(clipped.name?.en || clipped.name?.ko || loc(clipped.name));
      let details=[{parentId:canonicalBinding?.parentId || '',developmentId:'',categoryId:'',countryIds:[country.id],label:'',artistIds:clipped.artistIds || [],primaryArtistIds:clipped.primaryArtistIds || [],furtherArtistIds:clipped.furtherArtistIds || []}];
      if (Array.isArray(clipped.atlasChildren) && clipped.atlasChildren.length) {
        const parentArtistIds=clipped.artistIds || [];
        details=[
          ...(parentArtistIds.length ? [{parentId:canonicalBinding?.parentId || '',developmentId:'',categoryId:'',countryIds:[country.id],label:'',artistIds:parentArtistIds,primaryArtistIds:clipped.primaryArtistIds || parentArtistIds,furtherArtistIds:clipped.furtherArtistIds || []}] : []),
          ...clipped.atlasChildren.map(child => ({parentId:canonicalBinding?.parentId || '',developmentId:child.id || '',categoryId:child.id || '',countryIds:[country.id],label:loc(child.name),name:child.name,start:child.start,end:child.end,artistIds:child.artistIds || [],primaryArtistIds:child.primaryArtistIds || child.artistIds || [],furtherArtistIds:child.furtherArtistIds || [],isExplicitSubmovement:true}))
        ];
      }
      details.forEach((detail, detailOrder) => rows.push({
        ...clipped,
        start:detail.start ?? clipped.start,
        end:detail.end ?? clipped.end,
        sourceStart:detail.start ?? clipped.sourceStart,
        sourceEnd:detail.end ?? clipped.sourceEnd,
        name:detail.name || owner?.name || {ko:loc(clipped.name),en:loc(clipped.name)},
        country,
        countryId:country.id,
        countryIds:[country.id],
        countryName:country.name,
        countryNames:[country.name],
        countryOrder,
        movementOrder,
        detailOrder,
        developmentId:detail.developmentId || '',
        categoryId:detail.categoryId || '',
        artistIds:detail.artistIds || [],
        primaryArtistIds:detail.primaryArtistIds || [],
        furtherArtistIds:detail.furtherArtistIds || [],
        parentId:detail.parentId || canonicalBinding?.parentId || '',
        parentDocumentName,
        parentMovementKey:artistListMovementLabelKey(clipped),
        isExplicitSubmovement:detail.isExplicitSubmovement === true,
        sourceOrder:rows.length,
        groupKey:artistListMovementGroupKey(clipped)
      }));
    });
  });
  const movementRows = artistListMergeCanonicalSubmovementRows(rows);
  const groups = new Map();
  movementRows.forEach(row => {
    const rowStart = artistListMovementSortStart(row);
    const rowEnd = artistListMovementSortEnd(row);
    const groupAnchorKey = row.groupKey.replace(/^(?:parent|movement):/, '');
    const rowKey = artistListMovementLabelKey(row);
    const group = groups.get(row.groupKey);
    if (!group) {
      groups.set(row.groupKey, {
        key:row.groupKey,
        start:rowStart,
        end:rowEnd,
        anchorStart:rowKey === groupAnchorKey ? rowStart : Infinity,
        anchorEnd:rowKey === groupAnchorKey ? rowEnd : Infinity,
        sourceOrder:row.sourceOrder
      });
      return;
    }
    group.start = Math.min(group.start, rowStart);
    group.end = Math.max(group.end, rowEnd);
    if (rowKey === groupAnchorKey) {
      group.anchorStart = Math.min(group.anchorStart, rowStart);
      group.anchorEnd = Math.min(group.anchorEnd, rowEnd);
    }
    group.sourceOrder = Math.min(group.sourceOrder, row.sourceOrder);
  });
  const groupOrder = new Map([...groups.values()]
    .sort((a, b) => {
      const startA = Number.isFinite(a.anchorStart) ? a.anchorStart : a.start;
      const startB = Number.isFinite(b.anchorStart) ? b.anchorStart : b.start;
      const endA = Number.isFinite(a.anchorEnd) ? a.anchorEnd : a.end;
      const endB = Number.isFinite(b.anchorEnd) ? b.anchorEnd : b.end;
      return startA - startB || endA - endB || a.sourceOrder - b.sourceOrder;
    })
    .map((group, index) => [group.key, index]));
  const parentEntries=[...groups.values()].sort((a,b) => groupOrder.get(a.key) - groupOrder.get(b.key)).map(group => {
    const children=movementRows.filter(row => row.groupKey === group.key).sort((a,b) =>
      artistListMovementSortStart(a) - artistListMovementSortStart(b)
      || artistListMovementSortEnd(a) - artistListMovementSortEnd(b)
      || a.sourceOrder - b.sourceOrder
    );
    const countryIds=[...new Set(children.flatMap(child => child.countryIds || [child.countryId]).filter(Boolean))];
    const countryNames=children.flatMap(child => child.countryNames || [child.countryName]).filter(Boolean).filter((name,index,array) => array.findIndex(candidate => loc(candidate) === loc(name)) === index);
    const first=children[0];
    return {
      ...first,
      name:artistListParentMovementName(group.key,children),
      start:group.start,
      end:group.end,
      sourceStart:group.start,
      sourceEnd:group.end,
      countryIds,
      countryNames,
      groupKey:group.key,
      children,
      sourceOrder:group.sourceOrder
    };
  });
  return parentEntries;
}
function artistListMovementRowKey(entry) {
  if (entry.children) return entry.groupKey;
  const countryIds = (entry.countryIds || [entry.countryId]).filter(Boolean).join(',');
  return [
    artistListMovementLabelKey(entry),
    entry.sourceStart ?? entry.start ?? '',
    entry.sourceEnd ?? entry.end ?? '',
    countryIds
  ].join('|');
}
function orderedArtistListMovementEntries(entries) {
  if (!artistListManualMovementOrder.length) return entries;
  const currentKeys = entries.map(artistListMovementRowKey);
  const currentKeySet = new Set(currentKeys);
  artistListManualMovementOrder = artistListManualMovementOrder.filter(key => currentKeySet.has(key));
  if (!artistListManualMovementOrder.length) return entries;
  const manualOrder = new Map(artistListManualMovementOrder.map((key, index) => [key, index]));
  const defaultOrder = new Map(currentKeys.map((key, index) => [key, index]));
  return [...entries].sort((a, b) => {
    const keyA = artistListMovementRowKey(a);
    const keyB = artistListMovementRowKey(b);
    const rankA = manualOrder.has(keyA) ? manualOrder.get(keyA) : artistListManualMovementOrder.length + defaultOrder.get(keyA);
    const rankB = manualOrder.has(keyB) ? manualOrder.get(keyB) : artistListManualMovementOrder.length + defaultOrder.get(keyB);
    return rankA - rankB;
  });
}
function artistListShouldMergeCanonicalSubmovement(row) {
  // Explicit atlas children are real, separately named schools or phases.
  return false;
}
function artistListMergeCanonicalSubmovementRows(rows) {
  const merged = new Map();
  const ordered = [];
  const mergeNames = (left = [], right = []) => [...left, ...right].filter(Boolean).filter((name, index, array) =>
    array.findIndex(candidate => loc(candidate) === loc(name)) === index
  );
  rows.forEach(row => {
    if (!artistListShouldMergeCanonicalSubmovement(row)) {
      ordered.push(row);
      return;
    }
    // Regional development IDs are evidence and artist data, not separate submovements.
    // Collapse them into their shared parent box; explicit school/phase boxes are supplied
    // separately through the parent's atlasChildren definition.
    const key = row.groupKey;
    const countryIds = (row.countryIds || [row.countryId]).filter(Boolean);
    const countryNames = (row.countryNames || [row.countryName]).filter(Boolean);
    const existing = merged.get(key);
    if (!existing) {
      const copy = {
        ...row,
        countryIds:[...new Set(countryIds)],
        countryNames:mergeNames([], countryNames),
        mergedCanonicalSubmovement:true
      };
      merged.set(key, copy);
      ordered.push(copy);
      return;
    }
    existing.start = Math.min(existing.start, row.start);
    existing.end = Math.max(existing.end, row.end);
    existing.sourceStart = Math.min(existing.sourceStart ?? existing.start, row.sourceStart ?? row.start);
    existing.sourceEnd = Math.max(existing.sourceEnd ?? existing.end, row.sourceEnd ?? row.end);
    existing.countryIds = [...new Set([...existing.countryIds, ...countryIds])];
    existing.countryNames = mergeNames(existing.countryNames, countryNames);
    existing.artistIds = [...new Set([...(existing.artistIds || []), ...(row.artistIds || [])])];
    existing.primaryArtistIds = [...new Set([...(existing.primaryArtistIds || []), ...(row.primaryArtistIds || [])])];
    existing.furtherArtistIds = [...new Set([...(existing.furtherArtistIds || []), ...(row.furtherArtistIds || [])])];
    existing.countryOrder = Math.min(existing.countryOrder, row.countryOrder);
    existing.movementOrder = Math.min(existing.movementOrder, row.movementOrder);
    existing.detailOrder = Math.min(existing.detailOrder, row.detailOrder);
    existing.sourceOrder = Math.min(existing.sourceOrder, row.sourceOrder);
  });
  return ordered;
}
