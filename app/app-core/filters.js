function years(artist) { return artist.birth ? `${artist.birth} — ${artist.death || '…'}` : t('unknown'); }
function artworkMovement(work, artist) { return loc(work?.movement) || loc(artistMovementFallbacks[artist?.qid]); }
function primaryMovement(artist) {
  if (artist?.qid === 'Q47551') return language === 'ko' ? '르네상스 · 베네치아 화파' : 'Renaissance · Venetian School';
  const artistMovement = loc(artist?.movement) || loc(artistMovementFallbacks[artist?.qid]);
  if (artistMovement) return artistMovement;
  const counts = new Map();
  (artist.works || []).forEach(work => { const movement = artworkMovement(work,artist); if (movement) counts.set(movement, (counts.get(movement) || 0) + 1); });
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || '';
}
function movementContributionWorksForArtist(artist, sourceWorks=artist?.works || []) {
  const visibleKeys = new Set((sourceWorks || []).map(selectionKey).filter(Boolean));
  const selected = selectArtistWorks(artist?.works || [], artistImportedWorkLimit, artist);
  return selected
    .filter(work => work.movementContribution)
    .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
    .slice(0,3)
    .map(work => (artist.works || []).find(item => selectionKey(item) === selectionKey(work)) || work)
    .filter(work => work && (!visibleKeys.size || visibleKeys.has(selectionKey(work)) || work.image || work.thumbnail));
}
function compactMovementName(value='') { return String(value).normalize('NFKC').toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g,''); }
function movementIsContextOnly(movement) {
  const names = typeof movement === 'string' ? [movement] : [movement?.name?.en, movement?.name?.ko];
  return names.some(name => movementContextOnlyNames.has(compactMovementName(name)));
}
function movementFilterSpec(label, includes=[], extra={}) {
  const keys = new Set([label?.ko, label?.en, ...includes].filter(Boolean).map(compactMovementName));
  return {
    ...extra,
    id: extra.id || compactMovementName(label?.en || label?.ko || ''),
    label,
    includes,
    keys
  };
}
const artistMovementFilterHierarchy = [
  movementFilterSpec({ko:'르네상스', en:'Renaissance'}, [
    'Italian Renaissance','High Renaissance','Northern Renaissance','German Renaissance','Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','French Renaissance','Danish Renaissance','Nordic Renaissance','Venetian School','Venetian school','Venetian Renaissance','Proto-Renaissance',
    '이탈리아 르네상스','전성기 르네상스','북유럽 르네상스','북방 르네상스','독일 르네상스','초기 네덜란드 회화','플랑드르파','네덜란드 및 플랑드르 르네상스 회화','프랑스 르네상스','덴마크 르네상스','북유럽 르네상스','베네치아 화파','베네치아 르네상스','선르네상스'
  ], {
    id: 'group:renaissance',
    children: [
      movementFilterSpec({ko:'이탈리아 르네상스', en:'Italian Renaissance'}, ['Italian Renaissance','High Renaissance','Proto-Renaissance','이탈리아 르네상스','전성기 르네상스','선르네상스']),
      movementFilterSpec({ko:'베네치아 화파', en:'Venetian School'}, ['Venetian School','Venetian school','Venetian Renaissance','베네치아 화파','베네치아 르네상스']),
      movementFilterSpec({ko:'북유럽 르네상스', en:'Northern Renaissance'}, ['Northern Renaissance','북유럽 르네상스','북방 르네상스','German Renaissance','독일 르네상스','Danube School','도나우파','Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','플랑드르 르네상스','Flemish Renaissance','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {
        children: [
          movementFilterSpec({ko:'독일 르네상스', en:'German Renaissance'}, ['German Renaissance','독일 르네상스','Danube School','도나우파'], {
            children: [
              movementFilterSpec({ko:'도나우파', en:'Danube School'}, ['Danube School','도나우파'])
            ]
          }),
          movementFilterSpec({ko:'저지대 르네상스', en:'Low Countries Renaissance'}, ['Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','플랑드르 르네상스','Flemish Renaissance','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {
            children: [
              movementFilterSpec({ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'}, ['Early Netherlandish painting','초기 네덜란드 회화','플랑드르파']),
              movementFilterSpec({ko:'플랑드르 르네상스', en:'Flemish Renaissance'}, ['Flemish Renaissance','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','플랑드르 르네상스','네덜란드 및 플랑드르 르네상스 회화'])
            ]
          })
        ]
      }),
      movementFilterSpec({ko:'프랑스 르네상스', en:'French Renaissance'}, ['French Renaissance','프랑스 르네상스']),
      movementFilterSpec({ko:'덴마크 르네상스', en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스']),
      movementFilterSpec({ko:'노르딕 르네상스', en:'Nordic Renaissance'}, ['Nordic Renaissance','북유럽 르네상스','노르딕 르네상스'])
    ]
  }),
  movementFilterSpec({ko:'매너리즘', en:'Mannerism'}, ['Mannerism','매너리즘'], {
    id:'mannerism',
    children: [
      movementFilterSpec({ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'}, ['Florentine-Roman Mannerism','Florentine Mannerism','Roman Mannerism','피렌체-로마 매너리즘','피렌체·로마 매너리즘']),
      movementFilterSpec({ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'}, ['Parma and Emilian Mannerism','Parma Mannerism','Emilian Mannerism','파르마와 에밀리아 계열','파르마·에밀리아 매너리즘']),
      movementFilterSpec({ko:'퐁텐블로파', en:'School of Fontainebleau'}, ['School of Fontainebleau','Fontainebleau School','퐁텐블로파']),
      movementFilterSpec({ko:'스페인 매너리즘', en:'Spanish Mannerism'}, ['Spanish Mannerism','스페인 매너리즘']),
      movementFilterSpec({ko:'네덜란드 매너리즘', en:'Dutch Mannerism'}, ['Dutch Mannerism','Haarlem Mannerism','Netherlandish Mannerism','네덜란드 매너리즘','하를럼 매너리즘']),
      movementFilterSpec({ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}, ['Prague Court Mannerism','Habsburg Court Mannerism','Rudolfine Mannerism','프라하 궁정 매너리즘','프라하·합스부르크 궁정','루돌프 2세 궁정 매너리즘'])
    ]
  }),
  movementFilterSpec({ko:'바로크', en:'Baroque'}, ['Baroque art','Italian Baroque painting','Flemish Baroque painting','Spanish Baroque','Dutch Baroque','Dutch Golden Age painting','바로크','이탈리아 바로크 회화','플랑드르 바로크 회화','스페인 바로크','네덜란드 바로크','네덜란드 황금기 회화'], {
    id:'baroque',
    children: [
      movementFilterSpec({ko:'이탈리아 바로크 회화', en:'Italian Baroque painting'}, ['Italian Baroque painting','이탈리아 바로크 회화']),
      movementFilterSpec({ko:'플랑드르 바로크 회화', en:'Flemish Baroque painting'}, ['Flemish Baroque painting','플랑드르 바로크 회화']),
      movementFilterSpec({ko:'네덜란드 황금기 회화', en:'Dutch Golden Age painting'}, ['Dutch Golden Age painting','Dutch Baroque','네덜란드 황금기 회화','네덜란드 바로크'])
    ]
  }),
  movementFilterSpec({ko:'낭만주의', en:'Romanticism'}, ['German Romanticism','Romanticism','낭만주의','독일 낭만주의'], {id:'romanticism'})
];
function movementFilterTreeKeys(node) {
  return new Set([...(node?.keys || []), ...(node?.children || []).flatMap(child => [...movementFilterTreeKeys(child)])]);
}
function findMovementFilterNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const found = findMovementFilterNode(node.children, id);
    if (found) return found;
  }
  return null;
}
function filterMovementTreeForArtists(node, direct) {
  const children = (node.children || []).map(child => filterMovementTreeForArtists(child, direct)).filter(Boolean);
  return [...(node.keys || [])].some(key => direct.has(key)) || children.length ? {...node, children} : null;
}
const artistMovementFilterGroups = artistMovementFilterHierarchy.map(group => ({...group, keys:movementFilterTreeKeys(group)}));
const artistMovementFilterOrder = [
  'Mannerism','Baroque','Rococo','Neoclassicism','Romanticism','Realism','Impressionism','Post-Impressionism','Fauvism','Cubism','Dada','Surrealism',
  'Biedermeier','Symbolism','Expressionism','New Objectivity','Bauhaus','Danube School','Dutch Golden Age painting','Arts and Crafts movement'
].map((name, index) => [compactMovementName(name), index]);
const artistMovementFilterOrderIndex = new Map(artistMovementFilterOrder);
const artistMovementDisplayRules = [
  movementFilterSpec({ko:'이탈리아 르네상스', en:'Italian Renaissance'}, ['Italian Renaissance','High Renaissance','Proto-Renaissance','이탈리아 르네상스','전성기 르네상스','선르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'베네치아 화파', en:'Venetian School'}, ['Venetian School','Venetian school','Venetian Renaissance','베네치아 화파','베네치아 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'북유럽 르네상스', en:'Northern Renaissance'}, ['Northern Renaissance','북유럽 르네상스','북방 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'독일 르네상스', en:'German Renaissance'}, ['German Renaissance','독일 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'도나우파', en:'Danube School'}, ['Danube School','도나우파'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'도나우파', en:'Danube School'}}),
  movementFilterSpec({ko:'네덜란드·플랑드르 르네상스', en:'Netherlandish and Flemish Renaissance'}, ['Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'프랑스 르네상스', en:'French Renaissance'}, ['French Renaissance','프랑스 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'덴마크 르네상스', en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스'], {parent:{ko:'북방 르네상스', en:'Northern Renaissance'}, documentLabel:{ko:'북방 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'노르딕 르네상스', en:'Nordic Renaissance'}, ['Nordic Renaissance','북유럽 르네상스','노르딕 르네상스'], {parent:{ko:'북방 르네상스', en:'Northern Renaissance'}, documentLabel:{ko:'북방 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'플랑드르 바로크 회화', en:'Flemish Baroque painting'}, ['Flemish Baroque painting','플랑드르 바로크 회화'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'이탈리아 바로크 회화', en:'Italian Baroque painting'}, ['Italian Baroque painting','이탈리아 바로크 회화'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'네덜란드 황금기 회화', en:'Dutch Golden Age painting'}, ['Dutch Golden Age painting','Dutch Baroque','네덜란드 황금기 회화','네덜란드 바로크'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'바로크', en:'Baroque'}, ['Baroque art','바로크']),
  movementFilterSpec({ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'}, ['Florentine-Roman Mannerism','Florentine Mannerism','Roman Mannerism','피렌체-로마 매너리즘','피렌체·로마 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'}, ['Parma and Emilian Mannerism','Parma Mannerism','Emilian Mannerism','파르마와 에밀리아 계열','파르마·에밀리아 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'퐁텐블로파', en:'School of Fontainebleau'}, ['School of Fontainebleau','Fontainebleau School','퐁텐블로파'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'스페인 매너리즘', en:'Spanish Mannerism'}, ['Spanish Mannerism','스페인 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'네덜란드 매너리즘', en:'Dutch Mannerism'}, ['Dutch Mannerism','Haarlem Mannerism','Netherlandish Mannerism','네덜란드 매너리즘','하를럼 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}, ['Prague Court Mannerism','Habsburg Court Mannerism','Rudolfine Mannerism','프라하 궁정 매너리즘','프라하·합스부르크 궁정','루돌프 2세 궁정 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'독일 낭만주의', en:'German Romanticism'}, ['German Romanticism','독일 낭만주의'], {parent:{ko:'낭만주의', en:'Romanticism'}, documentLabel:{ko:'낭만주의', en:'Romanticism'}}),
  movementFilterSpec({ko:'낭만주의', en:'Romanticism'}, ['Romanticism','낭만주의']),
  movementFilterSpec({ko:'러시아 바로크', en:'Russian Baroque'}, ['Russian Baroque','러시아 바로크'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'러시아 사실주의', en:'Russian Realism'}, ['Russian Realism','러시아 사실주의'], {parent:{ko:'사실주의', en:'Realism'}, documentLabel:{ko:'사실주의', en:'Realism'}}),
  movementFilterSpec({ko:'후기 인상주의', en:'Post-Impressionism'}, ['Post-Impressionism','Post-impressionism','후기 인상주의','후기인상주의'])
];
const artistMovementClassificationOverrides = {
  Q17169:{ko:'베네치아 화파', en:'Venetian School'},
  Q8459:{ko:'베네치아 화파', en:'Venetian School'},
  Q47551:{ko:'베네치아 화파', en:'Venetian School'},
  Q9319:{ko:'베네치아 화파', en:'Venetian School'},
  Q9440:{ko:'베네치아 화파', en:'Venetian School'},
  Q102272:{ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'},
  Q68631:{ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'},
  Q43270:{ko:'플랑드르 르네상스', en:'Flemish Renaissance'},
  Q5580:{ko:'독일 르네상스', en:'German Renaissance'},
  Q48319:{ko:'독일 르네상스', en:'German Renaissance'},
  Q191748:{ko:'독일 르네상스', en:'German Renaissance'},
  Q153746:{ko:'도나우파', en:'Danube School'},
  Q610556:{ko:'도나우파', en:'Danube School'},
  Q207929:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q312617:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q9348:{ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'},
  Q7803:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q333366:{ko:'퐁텐블로파', en:'School of Fontainebleau'},
  Q301:{ko:'스페인 매너리즘', en:'Spanish Mannerism'},
  Q165367:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q442484:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q329811:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q447682:{ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'},
  Q7751:{ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}
};
function movementEntry(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const label = value.trim();
    return label ? {id:compactMovementName(label), label} : null;
  }
  const label = loc(value);
  const id = compactMovementName(value.en || value.ko || label);
  return id && label ? {id, label} : null;
}
function artistMovementEntries(artist) {
  const override = artistMovementClassificationOverrides[artist?.qid] || artistMovementClassificationOverrides[artist?.id];
  const entries = [movementEntry(override), movementEntry(artist?.movement), movementEntry(artistMovementFallbacks[artist?.qid])];
  if (!entries.some(Boolean)) entries.push(movementEntry(primaryMovement(artist)));
  const seen = new Set();
  return entries.filter(entry => entry && !seen.has(entry.id) && seen.add(entry.id));
}
function artistMovementDisplayInfo(artist) {
  const entry = artistMovementEntries(artist)[0] || movementEntry(primaryMovement(artist));
  if (!entry) return {label:'', documentLabel:''};
  const rule = artistMovementDisplayRules.find(item => item.keys.has(entry.id));
  if (!rule) return {label:entry.label, parentLabel:entry.label, documentLabel:entry.label};
  const label = loc(rule.label) || entry.label;
  const parent = loc(rule.parent);
  const display = parent && compactMovementName(label) !== compactMovementName(parent) ? `${label} - ${parent}` : label;
  return {label:display, parentLabel:parent || label, documentLabel:loc(rule.documentLabel) || label};
}
function artistMatchesMovementFilter(artist) {
  if (!artistMovementFilter) return true;
  const entries = artistMovementEntries(artist);
  const node = findMovementFilterNode(artistMovementFilterHierarchy, artistMovementFilter);
  if (node) return entries.some(entry => movementFilterTreeKeys(node).has(entry.id));
  return entries.some(entry => entry.id === artistMovementFilter);
}
function artistMovementFilterOptions() {
  const direct = new Map();
  (artists || []).forEach(artist => artistMovementEntries(artist).forEach(entry => {
    if (!direct.has(entry.id)) direct.set(entry.id, {id:entry.id, label:entry.label});
  }));
  const hierarchy = artistMovementFilterHierarchy.map(group => filterMovementTreeForArtists(group, direct)).filter(Boolean);
  const consumed = new Set(hierarchy.flatMap(group => [...movementFilterTreeKeys(group)]));
  const directOptions = [...direct.values()]
    .filter(option => option.label && !consumed.has(option.id))
    .filter((option,index,self) => self.findIndex(item => compactMovementName(item.label) === compactMovementName(option.label)) === index)
    .sort((a,b) => (artistMovementFilterOrderIndex.get(a.id) ?? 9999) - (artistMovementFilterOrderIndex.get(b.id) ?? 9999) || a.label.localeCompare(b.label, language));
  return [...hierarchy, ...directOptions];
}
function movementFilterLabelForValue(groups, value) {
  if (!value) return t('allMovements');
  return loc(findMovementFilterNode(groups, value)?.label) || t('allMovements');
}
function selectArtistMovementFilter(value='') {
  artistMovementFilter = value;
  artistMovementFilterMenuOpen = false;
  renderList();
}
function renderArtistMovementFilter() {
  const trigger = $('#artist-movement-filter-trigger');
  const menu = $('#artist-movement-filter-menu');
  if (!trigger || !menu) return;
  const groups = artistMovementFilterOptions();
  if (artistMovementFilter && !findMovementFilterNode(groups, artistMovementFilter)) artistMovementFilter = '';
  const expandSelectedAncestors = nodes => (nodes || []).some(node => {
    if (node.id === artistMovementFilter) return true;
    const containsSelection = expandSelectedAncestors(node.children);
    if (containsSelection) expandedArtistMovementGroups.add(node.id);
    return containsSelection;
  });
  expandSelectedAncestors(groups);
  trigger.textContent = movementFilterLabelForValue(groups, artistMovementFilter);
  trigger.title = t('movementFilter');
  trigger.setAttribute('aria-label', t('movementFilter'));
  trigger.setAttribute('aria-expanded', String(artistMovementFilterMenuOpen));
  menu.classList.toggle('hidden', !artistMovementFilterMenuOpen);
  const itemButton = (option, className='') => `<button type="button" class="artist-movement-filter-option ${className}${artistMovementFilter === option.id ? ' active' : ''}" role="option" aria-selected="${artistMovementFilter === option.id}" data-movement-filter-value="${esc(option.id)}">${esc(option.label)}</button>`;
  const groupMarkup = (group, depth=0) => {
    const children = group.children || [];
    if (!children.length) return itemButton(group, depth ? `artist-movement-filter-child depth-${depth}` : '');
    const collapsible = children.length > 1;
    const expanded = !collapsible || expandedArtistMovementGroups.has(group.id);
    const toggleLabel = expanded
      ? (language === 'ko' ? `${group.label} 하위 사조 접기` : `Collapse ${group.label}`)
      : (language === 'ko' ? `${group.label} 하위 사조 펼치기` : `Expand ${group.label}`);
    return `<div class="artist-movement-filter-group depth-${depth}${expanded ? ' expanded' : ''}" data-movement-filter-group="${esc(group.id)}"><div class="artist-movement-filter-group-row">${itemButton(group, depth ? 'artist-movement-filter-parent artist-movement-filter-child' : 'artist-movement-filter-parent')}${collapsible ? `<button type="button" class="artist-movement-filter-toggle" data-movement-filter-toggle="${esc(group.id)}" aria-expanded="${expanded}" aria-label="${esc(toggleLabel)}">${expanded ? '▴' : '▾'}</button>` : ''}</div>${expanded ? `<div class="artist-movement-filter-children">${children.map(child => groupMarkup(child, depth + 1)).join('')}</div>` : ''}</div>`;
  };
  menu.innerHTML = `<button type="button" class="artist-movement-filter-option artist-movement-filter-all${!artistMovementFilter ? ' active' : ''}" role="option" aria-selected="${!artistMovementFilter}" data-movement-filter-value="">${esc(t('allMovements'))}</button>${groups.map(groupMarkup).join('')}`;
  menu.querySelectorAll('[data-movement-filter-value]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      selectArtistMovementFilter(button.dataset.movementFilterValue || '');
    };
  });
  menu.querySelectorAll('[data-movement-filter-toggle]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const groupId = button.dataset.movementFilterToggle;
      if (expandedArtistMovementGroups.has(groupId)) expandedArtistMovementGroups.delete(groupId);
      else expandedArtistMovementGroups.add(groupId);
      artistMovementFilterMenuOpen = true;
      renderArtistMovementFilter();
    };
  });
  const clear = $('#artist-movement-filter-clear');
  if (clear) {
    clear.hidden = !artistMovementFilter;
    clear.title = t('clearMovementFilter');
    clear.setAttribute('aria-label', t('clearMovementFilter'));
  }
}
function movementDocumentKey(label='') {
  const compact = compactMovementName(label);
  if (!compact) return '';
  const documentNames = Object.keys(movementDocuments || {});
  const direct = documentNames.find(name => compactMovementName(name) === compact);
  if (direct) return direct;
  const knownMovement = movementCountries.flatMap(country => country.movements || []).find(movement => [movement.name?.ko, movement.name?.en].some(name => compactMovementName(name) === compact));
  if (knownMovement?.name?.en && movementDocuments?.[knownMovement.name.en]?.['1']) return knownMovement.name.en;
  // Country-level movements often share a single explanation document with
  // their parent movement. Resolve that documented parent before falling back
  // to an external encyclopedia search.
  const displayRule = artistMovementDisplayRules.find(rule => rule.keys.has(compact));
  const hierarchyGroup = artistMovementFilterHierarchy.find(group => movementFilterTreeKeys(group).has(compact));
  const documentedCandidate = [
    displayRule?.documentLabel?.en,
    displayRule?.documentLabel?.ko,
    displayRule?.parent?.en,
    displayRule?.parent?.ko,
    hierarchyGroup?.label?.en,
    hierarchyGroup?.label?.ko
  ].find(candidate => candidate && movementDocuments?.[candidate]?.['1']);
  if (documentedCandidate) return documentedCandidate;
  const aliases = {
    '후기인상주의':'Post-Impressionism',
    '이탈리아르네상스':'Renaissance',
    '전성기르네상스':'Renaissance',
    '선르네상스':'Renaissance',
    '베네치아화파':'Renaissance',
    '베네치아르네상스':'Renaissance',
    '플랑드르바로크회화':'Baroque',
    '이탈리아바로크회화':'Baroque',
    '네덜란드황금기회화':'Baroque',
    'dutchgoldenagepainting':'Baroque',
    '네덜란드바로크':'Baroque',
    'dutchbaroque':'Baroque',
    '독일낭만주의':'Romanticism',
    'highrenaissance':'Renaissance',
    'rococopainting':'Rococo'
  };
  const alias = aliases[compact];
  return alias && movementDocuments?.[alias]?.['1'] ? alias : '';
}
function normalizeMovementView(value) {
  let start = Number(value?.start);
  let end = Number(value?.end);
  if (!Number.isFinite(start)) start = defaultMovementView.start;
  if (!Number.isFinite(end)) end = defaultMovementView.end;
  start = Math.min(movementAtlasEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementAtlasEnd, Math.round(end)));
  let density = Number(value?.density);
  if (!Number.isFinite(density)) density = defaultMovementView.density;
  density = Math.round(Math.min(movementDensityMaximum, Math.max(movementDensityMinimum, density)) * 100) / 100;
  const eventCategory = historicalEventCategories.includes(value?.eventCategory) ? value.eventCategory : defaultMovementView.eventCategory;
  return {
    // An empty array is a valid "clear all" choice; only a missing or malformed value uses the default.
    countries: Array.isArray(value?.countries) ? value.countries : [...defaultMovementView.countries],
    start,
    end,
    showHistoricalEvents: value?.showHistoricalEvents !== false,
    eventCategory,
    density,
  };
}
function parseMovementView() {
  try { return normalizeMovementView(JSON.parse(localStorage.getItem(movementStorageKey) || JSON.stringify(defaultMovementView))); }
  catch (_) { return normalizeMovementView(defaultMovementView); }
}
function normalizeCountryArtView(value) {
  let start = Number(value?.start), end = Number(value?.end), density = Number(value?.density);
  if (!Number.isFinite(start)) start = defaultCountryArtView.start;
  if (!Number.isFinite(end)) end = defaultCountryArtView.end;
  if (!Number.isFinite(density)) density = defaultCountryArtView.density;
  start = Math.min(movementCountryEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementCountryEnd, Math.round(end)));
  density = Math.round(Math.min(countryArtDensityMaximum, Math.max(countryArtDensityMinimum, density)) * 100) / 100;
  return {country:allMovementCountryIds.includes(value?.country) ? value.country : defaultCountryArtView.country, start, end, density};
}
function parseCountryArtView() {
  try { return normalizeCountryArtView(JSON.parse(localStorage.getItem(countryArtStorageKey) || JSON.stringify(defaultCountryArtView))); }
  catch (_) { return normalizeCountryArtView(defaultCountryArtView); }
}
function persistCountryArtView() { localStorage.setItem(countryArtStorageKey, JSON.stringify(countryArtView)); }
function normalizeArtistListView(value) {
  let start = Number(value?.start), end = Number(value?.end), density = Number(value?.density);
  if (!Number.isFinite(start)) start = defaultArtistListView.start;
  if (!Number.isFinite(end)) end = defaultArtistListView.end;
  if (!Number.isFinite(density)) density = defaultArtistListView.density;
  start = Math.min(movementCountryEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementCountryEnd, Math.round(end)));
  density = Math.round(Math.min(artistListDensityMaximum, Math.max(artistListDensityMinimum, density)) * 100) / 100;
  const countries = [...new Set((Array.isArray(value?.countries) ? value.countries : defaultArtistListView.countries).filter(id => allMovementCountryIds.includes(id)))];
  return {countries, start, end, density};
}
function parseArtistListView() {
  try { return normalizeArtistListView(JSON.parse(localStorage.getItem(artistListStorageKey) || JSON.stringify(defaultArtistListView))); }
  catch (_) { return normalizeArtistListView(defaultArtistListView); }
}
function persistArtistListView() { localStorage.setItem(artistListStorageKey, JSON.stringify(artistListView)); }
async function hydrateArtistProfile(artist) {
  const hasOriginalName = /[A-Za-z]/.test(artist?.name?.en || '');
  if (!artist?.qid || (artist.profileResolved && hasOriginalName) || profileRequests.has(artist.id)) return;
  profileRequests.add(artist.id);
  try {
    const response = await fetch(`/api/artist-profile?qid=${encodeURIComponent(artist.qid)}`);
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.name?.en) { artist.name = {...profile.name, ko:/[가-힣]/.test(artist.name?.ko || '') ? artist.name.ko : profile.name.ko}; artist.birth = profile.birth || artist.birth; artist.death = profile.death || artist.death; artist.nationality = profile.nationality || artist.nationality; artist.profileResolved = true; persist(); if (selectedId === artist.id) render(); }
  } catch (_) { /* Keep the locally stored name if the profile cannot be read. */ }
}
