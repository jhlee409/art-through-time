function setupThumbnailArtworkLinks(artist, works) {
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  const workForButton = button => worksById.get(String(button?.dataset?.work || ''));
  timeline.querySelectorAll('.thumbnail-artwork-link-add').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const card = button.closest('.art-card');
      const entry = card?.querySelector('.thumbnail-artwork-link-entry');
      if (!entry) return;
      entry.classList.toggle('hidden');
      if (!entry.classList.contains('hidden')) entry.querySelector('input')?.focus();
    });
  });
  timeline.querySelectorAll('.thumbnail-artwork-link-entry').forEach(entry => {
    entry.onsubmit = async event => {
      event.preventDefault();
      const work = worksById.get(String(entry.dataset.work || ''));
      const input = entry.querySelector('input');
      if (!work || !input) return;
      let url;
      try {
        url = new URL(input.value.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      } catch (_) {
        input.setCustomValidity(language === 'ko' ? 'http 또는 https 주소를 입력하세요.' : 'Enter an http or https address.');
        input.reportValidity();
        input.setCustomValidity('');
        return;
      }
      const previousLinks = artworkLinks(work);
      setArtworkLinks(artist, work, [...previousLinks, savedLinkFromEntry(url,entry)]);
      if (!await saveArtistPresentationNow(artist,{workId:work.id,workLinks:artworkLinks(work)})) {
        setArtworkLinks(artist, work, previousLinks);
        alert(saveFailureMessage());
      }
      renderTimeline();
    };
  });
  setupSortableLinkButtons(timeline, {
    selector:'.thumbnail-artwork-link-button',
    controlsSelector:'.thumbnail-artwork-link-controls',
    indexAttribute:'artworkLinkIndex',
    getLinks:button => artworkLinks(workForButton(button)),
    setLinks:(links, button) => { const work = workForButton(button); if (work) setArtworkLinks(artist, work, links); },
    saveLinks:(links, button) => { const work = workForButton(button); return work ? saveArtistPresentationNow(artist,{workId:work.id,workLinks:links}) : Promise.resolve(false); },
    render:renderTimeline,
    contextMenu:(event, index, button) => {
      const work = workForButton(button);
      if (work) showArtworkLinkMenu(event, artist, work, index, renderTimeline);
    }
  });
}
function setupArtworkImageFallbacks() {
  timeline.querySelectorAll('.art-thumb img[data-fallback-src]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallbackSrc || '';
      if (!fallback || image.dataset.fallbackApplied === 'true') return;
      image.dataset.fallbackApplied = 'true';
      image.src = fallback;
    });
  });
}
function setupArtworkWikipediaLinks(artist, works) {
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  const unavailableLabel = language === 'ko' ? '작품 위키피디아 페이지가 확인되지 않았습니다.' : 'No artwork Wikipedia page was confirmed.';
  const wikipediaLabel = language === 'ko' ? '작품 위키피디아 페이지 열기' : 'Open artwork Wikipedia page';
  timeline.querySelectorAll('.artwork-wikipedia-link[data-wikipedia-pending="true"]').forEach(link => {
    const work = worksById.get(String(link.dataset.work || ''));
    if (!work) return;
    cachedArtworkWikipediaUrl(work, artist).then(url => {
      if (!link.isConnected) return;
      if (!url) {
        const title = document.createElement('strong');
        title.className = 'art-title';
        title.textContent = link.textContent;
        title.title = unavailableLabel;
        link.replaceWith(title);
        return;
      }
      link.href = url;
      link.title = wikipediaLabel;
      link.removeAttribute('data-wikipedia-pending');
      link.removeAttribute('aria-disabled');
    });
  });
}
function highResolutionImageWidth(src) {
  const key = String(src || '');
  if (!key) return Promise.resolve(0);
  if (!highResolutionWidthChecks.has(key)) {
    highResolutionWidthChecks.set(key, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth || 0);
      image.onerror = () => resolve(0);
      image.src = key;
    }));
  }
  return highResolutionWidthChecks.get(key);
}
function setupHighResolutionBadges(artist, works) {
  const label = language === 'ko'
    ? `가로 ${highResolutionMinimumWidth}px 이상 고해상도 이미지입니다.`
    : `High-resolution image at least ${highResolutionMinimumWidth}px wide.`;
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  timeline.querySelectorAll('.art-card[data-work]').forEach(card => {
    const work = worksById.get(String(card.dataset.work || ''));
    const image = card.querySelector('.art-thumb img');
    const highResSource = work?.highResImage && !isExternalImageSource(work.highResImage) ? work.highResImage : '';
    if (!highResSource || !image) return;
    highResolutionImageWidth(highResSource).then(width => {
      if (!image.isConnected || width < highResolutionMinimumWidth) return;
      image.classList.add('high-resolution-artwork');
      image.title = `${label} (${width}px)`;
      const badge = card.querySelector('.high-resolution-badge[data-highres-src]');
      if (badge) {
        badge.classList.remove('hidden');
        badge.title = `${label} (${width}px)`;
      }
    });
  });
}
function setupArtworkImageViewer(artist, works) {
  if(viewMode!=='timeline' || !timeline.classList.contains('artist-timeline-panel'))return;
  const worksById = new Map((works || []).map(work=>[String(work.id || ''),work]));
  timeline.querySelectorAll('.art-card[data-work]').forEach(card=>{
    const work=worksById.get(String(card.dataset.work || '')),image=card.querySelector('.art-thumb img');
    if(!work || !image)return;
    const highResSource=work.highResImage && !isExternalImageSource(work.highResImage) ? work.highResImage : '';
    const source=highResSource || artworkImageDisplay(work,{detail:true}).src || image.currentSrc || image.src;
    if(!source)return;
    image.classList.add('artwork-image-openable');
    image.addEventListener('dblclick',event=>{
      event.preventDefault();
      event.stopPropagation();
      openArtworkImageWindow(source,artworkDisplayTitle(work),{artist:language === 'ko' ? artistListKoreanName(artist) : loc(artist.name),title:artworkDisplayTitle(work),year:workYearLabel(work)});
    });
  });
}
function setupArtworkHoverPreview() {
  if (!artworkHoverPreview) {
    artworkHoverPreview = document.createElement('div');
    artworkHoverPreview.className = 'artwork-hover-preview hidden';
    artworkHoverPreview.innerHTML = '<img alt=""><div class="artwork-hover-caption"><span class="artwork-hover-main"></span><span class="artwork-hover-collection"></span></div>';
    document.body.append(artworkHoverPreview);
  }
  const previewImage = artworkHoverPreview.querySelector('img');
  const previewMain = artworkHoverPreview.querySelector('.artwork-hover-main');
  const previewCollection = artworkHoverPreview.querySelector('.artwork-hover-collection');
  const hide = () => artworkHoverPreview.classList.add('hidden');
  timeline.querySelectorAll('.art-thumb').forEach(thumb => {
    const image = thumb.querySelector('img');
    const button = thumb.querySelector('.artwork-preview-button');
    if (!image || !button) return;
    button.addEventListener('mouseenter', () => {
      const workId = thumb.closest('.art-card')?.dataset.work || '';
      const rect = thumb.getBoundingClientRect();
      const captionHeight = 44;
      const scale = Math.min(6, (window.innerWidth - 30) / rect.width, (window.innerHeight - captionHeight - 20) / rect.height) * .96;
      const previewWidth = rect.width * scale, imageHeight = rect.height * scale, previewHeight = imageHeight + captionHeight, gap = 14;
      const preferRight = rect.right + gap + previewWidth <= window.innerWidth - 10;
      const left = preferRight ? rect.right + gap : Math.max(10, rect.left - gap - previewWidth);
      const top = Math.max(10, Math.min(window.innerHeight - previewHeight - 10, rect.top - (previewHeight - rect.height) / 2));
      const card = thumb.closest('.art-card');
      const artist = artists.find(item => item.id === selectedId);
      const work = artist?.works?.find(item => item.id === card?.dataset.work);
      previewImage.src = image.currentSrc || image.src;
      previewImage.alt = image.alt;
      previewImage.style.height = `${imageHeight}px`;
      const artistLabel = card?.dataset.previewArtist || (artist ? artistDisplayName(artist) : '');
      const titleLabel = card?.dataset.previewTitle || (work ? loc(work.title) : image.alt);
      const yearLabel = card?.dataset.previewYear || workYearLabel(work) || (language === 'ko' ? '연도 미상' : 'Year unknown');
      const collectionLabel = card?.dataset.previewCollection || '';
      previewMain.textContent = [artistLabel, titleLabel, yearLabel].filter(Boolean).join(' · ');
      previewCollection.textContent = collectionLabel;
      previewCollection.classList.toggle('hidden', !collectionLabel);
      artworkHoverPreview.style.width = `${previewWidth}px`;
      artworkHoverPreview.style.height = `${previewHeight}px`;
      artworkHoverPreview.style.left = `${left}px`;
      artworkHoverPreview.style.top = `${top}px`;
      artworkHoverPreview.dataset.work = workId;
      artworkHoverPreview.classList.remove('hidden');
    });
    button.addEventListener('mouseleave', hide);
  });
}
const atlasHistoricalEvents = [
  {id:'printing-press',start:1450,name:{ko:'인쇄술의 확산',en:'Printing press spreads'},impact:{ko:'판화·도상·이론서의 대량 유통을 촉진했습니다.',en:'Accelerated the circulation of prints, images, and art theory.'}},
  {id:'fall-constantinople',start:1453,name:{ko:'콘스탄티노폴리스 함락',en:'Fall of Constantinople'},impact:{ko:'그리스어 고전 문헌과 학자들의 이탈리아 유입을 촉진했습니다.',en:'Helped bring Greek texts and scholars into Italian humanist circles.'}},
  {id:'reformation',start:1517,name:{ko:'종교 개혁',en:'Protestant Reformation'},impact:{ko:'성상 논쟁과 후원 구조 변화로 북유럽 종교 이미지의 역할을 바꾸었습니다.',en:'Reshaped religious imagery and patronage through iconoclasm and reform.'}},
  {id:'sack-of-rome',start:1527,name:{ko:'로마 약탈',en:'Sack of Rome'},impact:{ko:'황제군의 약탈은 교황권과 로마의 미술 후원 체계를 흔들고 화가들의 이동을 촉진해, 전성기 르네상스 이후 매너리즘의 불안정한 분위기를 강화했습니다.',en:'The imperial sack destabilized papal authority and Roman patronage, dispersing artists and intensifying the unsettled climate of Mannerism after the High Renaissance.'}},
  {id:'council-trent',start:1545,end:1563,name:{ko:'트리엔트 공의회',en:'Council of Trent'},impact:{ko:'가톨릭 미술의 명료성·감정성·교화 기능을 강화했습니다.',en:'Encouraged clarity, emotion, and didactic purpose in Catholic art.'}},
  {id:'scientific-revolution',start:1540,end:1700,name:{ko:'과학혁명',en:'Scientific Revolution'},impact:{ko:'관찰·실험·측정의 문화가 자연, 시각, 지식 재현의 방식을 새롭게 했습니다.',en:'Its culture of observation, experiment, and measurement reshaped ways of seeing nature and knowledge.'}},
  {id:'thirty-years-war',start:1618,end:1648,name:{ko:'30년 전쟁',en:'Thirty Years’ War'},impact:{ko:'유럽의 종교·정치 질서와 궁정·교회 후원을 크게 재편했습니다.',en:'Reordered European politics, religion, and systems of patronage.'}},
  {id:'italian-plague-1629',start:1629,end:1631,name:{ko:'이탈리아 페스트 유행',en:'Italian plague epidemic'},impact:{ko:'북부 이탈리아의 인구·도시 경제·후원망에 큰 충격을 주어 바로크 미술의 제작과 수요 환경에도 영향을 미쳤습니다.',en:'It disrupted population, urban economies, and patronage networks in northern Italy, affecting Baroque production and demand.'}},
  {id:'royal-academy',start:1648,name:{ko:'프랑스 왕립회화조각아카데미 설립',en:'French Royal Academy founded'},impact:{ko:'아카데미 교육·살롱·장르 위계의 제도적 기반이 되었습니다.',en:'Established academic training, Salons, and the hierarchy of genres.'}},
  {id:'great-plague-london',start:1665,end:1666,name:{ko:'런던 대페스트',en:'Great Plague of London'},impact:{ko:'도시 인구와 공공생활의 위기는 런던의 건축·출판·시각문화 환경을 일시적으로 크게 바꾸었습니다.',en:'The crisis in population and public life temporarily reshaped London’s architecture, publishing, and visual culture.'}},
  {id:'enlightenment',start:1680,end:1789,name:{ko:'계몽주의',en:'Enlightenment'},impact:{ko:'이성·공공성·고전 고대에 대한 관심이 신고전주의와 공적 미술 담론의 토대가 되었습니다.',en:'Its emphasis on reason, the public sphere, and classical antiquity helped ground Neoclassicism and public-art discourse.'}},
  {id:'marseille-plague',start:1720,end:1722,name:{ko:'마르세유 대페스트',en:'Great Plague of Marseille'},impact:{ko:'지중해 무역항의 검역·교역·도시 생활을 흔들어 프랑스 남부의 경제와 시각문화 유통에 영향을 주었습니다.',en:'It disrupted quarantine, trade, and urban life at a Mediterranean port, affecting southern French economies and visual circulation.'}},
  {id:'herculaneum-excavations',start:1738,name:{ko:'헤르쿨라네움 발굴 시작',en:'Excavations at Herculaneum begin'},impact:{ko:'고대 로마 미술과 장식에 대한 직접적 관심을 높여 신고전주의의 고고학적 토대를 넓혔습니다.',en:'Heightened direct interest in Roman art and decoration, expanding Neoclassicism’s archaeological foundation.'}},
  {id:'pompeii-excavations',start:1748,name:{ko:'폼페이 발굴 시작',en:'Excavations at Pompeii begin'},impact:{ko:'고대 벽화·건축·일상 문화의 발견이 유럽의 신고전주의 양식과 장식 예술에 영향을 주었습니다.',en:'Discoveries of ancient murals, architecture, and daily life influenced European Neoclassicism and decorative arts.'}},
  {id:'industrial-revolution',start:1760,end:1840,name:{ko:'산업혁명',en:'Industrial Revolution'},impact:{ko:'도시화·새 계층·새 재료가 미술의 주제와 시장을 바꾸었습니다.',en:'Urbanisation, new classes, and new materials changed art subjects and markets.'}},
  {id:'american-revolution',start:1775,end:1783,name:{ko:'미국 독립혁명',en:'American Revolution'},impact:{ko:'공화주의와 시민적 역사화의 상징 언어를 확산했습니다.',en:'Spread republican and civic imagery in history painting.'}},
  {id:'french-revolution',start:1789,end:1799,name:{ko:'프랑스 혁명',en:'French Revolution'},impact:{ko:'왕정 후원과 공공 이미지의 체계를 뒤흔들고 신고전주의 정치미술을 부각했습니다.',en:'Disrupted royal patronage and made Neoclassical political imagery central.'}},
  {id:'congress-vienna',start:1815,name:{ko:'빈 체제 성립',en:'Congress of Vienna order'},impact:{ko:'나폴레옹 전쟁 이후 독일 연방과 복고 질서가 형성되어 독일 낭만주의·비더마이어의 정치적 배경이 되었습니다.',en:'After the Napoleonic Wars, the German Confederation and Restoration order framed German Romanticism and Biedermeier culture.'}},
  {id:'metternich-system',start:1815,end:1848,name:{ko:'메테르니히 체제',en:'Metternich system'},impact:{ko:'검열과 보수적 질서가 공적 정치 표현을 억제하면서 사적 실내문화, 풍경, 시민적 일상에 대한 관심을 강화했습니다.',en:'Censorship and conservative order constrained public politics while intensifying interest in private interiors, landscape, and bourgeois everyday life.'}},
  {id:'railway-expansion',start:1830,end:1870,name:{ko:'철도의 보급',en:'Railway expansion'},impact:{ko:'사람·상품·이미지의 이동 속도를 높이고 도시화와 관광, 풍경을 바라보는 감각을 바꾸었습니다.',en:'It accelerated the movement of people, goods, and images, reshaping urbanisation, tourism, and perceptions of landscape.'}},
  {id:'july-revolution',start:1830,name:{ko:'프랑스 7월 혁명',en:'July Revolution in France'}},
  {id:'victorian-era',start:1837,end:1901,name:{ko:'빅토리아 시대',en:'Victorian era'},impact:{ko:'산업화·제국주의·도덕관·디자인 개혁이 라파엘 전파와 유미주의의 배경이 되었습니다.',en:'Industrialisation, empire, morality, and design reform framed the Pre-Raphaelites and Aestheticism.'}},
  {id:'february-revolution',start:1848,name:{ko:'프랑스 2월 혁명',en:'February Revolution in France'}},
  {id:'german-revolutions-1848',start:1848,end:1849,name:{ko:'독일 3월 혁명',en:'German revolutions of 1848-1849'},impact:{ko:'자유주의와 민족통일 요구가 폭발하며 비더마이어 이후의 시민사회, 정치 풍자, 사실주의적 문제의식을 자극했습니다.',en:'Liberal and national-unification demands reshaped civic culture, political satire, and realist social concerns after Biedermeier.'}},
  {id:'photography',start:1839,name:{ko:'사진술 공표',en:'Photography announced'},impact:{ko:'재현의 역할을 재정의하고 사실주의·인상주의의 시각 언어에 영향을 주었습니다.',en:'Redefined representation and influenced Realism and Impressionist vision.'}},
  {id:'camera-adoption',start:1840,end:1880,name:{ko:'사진기의 보급',en:'Camera adoption'},impact:{ko:'초상·기록·보도의 이미지 생산과 유통을 넓혀 회화와 대중 시각문화의 관계를 새롭게 만들었습니다.',en:'It expanded image-making and circulation for portraiture, documentation, and news, reshaping painting’s relationship with mass visual culture.'}},
  {id:'paint-tube',start:1841,name:{ko:'튜브 유화 물감 특허',en:'Oil paint tube patented'},impact:{ko:'야외 제작을 실용화해 인상주의의 작업 방식을 뒷받침했습니다.',en:'Made portable outdoor painting practical and supported Impressionist practice.'}},
  {id:'great-exhibition',start:1851,name:{ko:'런던 만국박람회',en:'Great Exhibition'},impact:{ko:'산업 디자인·재료·전시 문화에 대한 관심을 높였습니다.',en:'Elevated attention to industrial design, materials, and exhibition culture.'}},
  {id:'napoleon-iii-accession',start:1852,name:{ko:'나폴레옹 3세 즉위',en:'Napoleon III becomes Emperor'},impact:{ko:'제2제정기의 대규모 도시 정비·살롱 제도·국가 후원이 파리의 미술 환경을 크게 바꾸었습니다.',en:'Second Empire urban renewal, the Salon system, and state patronage profoundly reshaped Paris’s art world.'}},
  {id:'paris-commune',start:1871,name:{ko:'파리 코뮌',en:'Paris Commune'},impact:{ko:'파리의 정치·도시 문화와 예술가들의 사회적 참여 논쟁에 영향을 주었습니다.',en:'Affected Parisian political culture and debates over artists’ civic roles.'}},
  {id:'franco-prussian-war',start:1870,end:1871,name:{ko:'보불 전쟁',en:'Franco-Prussian War'},impact:{ko:'프랑스 제2제정 붕괴와 파리의 문화·제도 변화를 가져왔습니다.',en:'Brought the collapse of the Second Empire and transformed Parisian institutions.'}},
  {id:'cinema',start:1895,name:{ko:'영화의 공개 상영',en:'Public cinema screening'},impact:{ko:'움직임·시간·대중 시각문화에 대한 새로운 감각을 만들었습니다.',en:'Created new ways of seeing movement, time, and mass visual culture.'}},
  {id:'interpretation-of-dreams',start:1900,name:{ko:'프로이트 『꿈의 해석』 출간',en:'Freud publishes The Interpretation of Dreams'},impact:{ko:'무의식·꿈·욕망에 대한 관심을 확산시켜 초현실주의의 사상적 배경이 되었습니다.',en:'Popularised ideas of the unconscious, dreams, and desire that informed Surrealism.'}},
  {id:'world-war-i',start:1914,end:1918,name:{ko:'제1차 세계대전',en:'World War I'},impact:{ko:'전쟁 경험은 다다·표현주의·전위예술의 급진화를 촉발했습니다.',en:'War experience radicalised Dada, Expressionism, and the avant-garde.'}},
  {id:'russian-revolution',start:1917,name:{ko:'러시아 혁명',en:'Russian Revolution'},impact:{ko:'구성주의와 생산주의를 포함한 예술·디자인의 사회적 역할을 재정의했습니다.',en:'Redefined art and design’s social role through Constructivism and Productivism.'}},
  {id:'bauhaus',start:1919,name:{ko:'바우하우스 설립',en:'Bauhaus founded'},impact:{ko:'미술·공예·건축·산업 디자인의 통합 교육을 확산했습니다.',en:'Advanced integrated teaching across art, craft, architecture, and design.'}},
  {id:'great-depression',start:1929,end:1939,name:{ko:'대공황',en:'Great Depression'},impact:{ko:'공공미술 사업과 사회 현실을 다루는 미술을 확대했습니다.',en:'Expanded public-art programmes and socially engaged art.'}},
  {id:'world-war-ii',start:1939,end:1945,name:{ko:'제2차 세계대전',en:'World War II'},impact:{ko:'망명·파괴·전후 질서가 추상과 국제 미술 중심의 이동에 영향을 주었습니다.',en:'Exile, destruction, and postwar order reshaped abstraction and art centres.'}},
  {id:'television',start:1951,name:{ko:'텔레비전 대중화',en:'Television mass adoption'},impact:{ko:'대중매체 이미지가 팝아트와 비디오아트의 주요 재료가 되었습니다.',en:'Mass-media imagery became material for Pop Art and video art.'}},
  {id:'may-1968',start:1968,name:{ko:'1968년 5월 운동',en:'May 1968 protests'},impact:{ko:'제도 비판·참여·페미니즘·개념미술의 사회적 맥락을 강화했습니다.',en:'Strengthened social contexts for institutional critique, participation, and feminism.'}},
  {id:'moon-landing',start:1969,name:{ko:'달 착륙',en:'Moon landing'},impact:{ko:'기술·과학·지구 이미지에 대한 새로운 상상력을 자극했습니다.',en:'Stimulated new artistic imaginations of technology, science, and Earth.'}},
  {id:'berlin-wall',start:1989,name:{ko:'베를린 장벽 붕괴',en:'Fall of the Berlin Wall'},impact:{ko:'동서유럽 미술계의 교류와 전시 지형을 재편했습니다.',en:'Reconfigured exchange and exhibition networks across Europe.'}},
  {id:'world-wide-web',start:1991,name:{ko:'월드 와이드 웹 공개',en:'World Wide Web released'},impact:{ko:'넷아트와 온라인 유통·참여형 작업의 기반을 만들었습니다.',en:'Enabled net art, online circulation, and participatory practices.'}},
  {id:'september-11',start:2001,name:{ko:'9·11 테러',en:'September 11 attacks'},impact:{ko:'전쟁·감시·이주를 다루는 동시대 미술의 문제의식을 강화했습니다.',en:'Intensified contemporary art’s engagement with war, surveillance, and migration.'}},
  {id:'smartphone',start:2007,name:{ko:'스마트폰 시대의 시작',en:'Smartphone era begins'},impact:{ko:'이미지 제작·공유·관람의 일상적 경로를 바꾸었습니다.',en:'Changed everyday production, sharing, and viewing of images.'}},
  {id:'covid-19',start:2020,end:2023,name:{ko:'코로나19 팬데믹',en:'COVID-19 pandemic'},impact:{ko:'온라인 전시·원격 협업·디지털 관람을 빠르게 확산했습니다.',en:'Accelerated online exhibitions, remote collaboration, and digital viewing.'}},
  {id:'generative-ai',start:2022,name:{ko:'생성형 AI의 대중화',en:'Generative AI mainstreaming'},impact:{ko:'저작·창작·이미지 생산의 경계를 둘러싼 논의를 확장했습니다.',en:'Expanded debates over authorship, creativity, and image production.'}}
];
const religiousThoughtEventIds = new Set(['reformation', 'council-trent', 'enlightenment', 'interpretation-of-dreams']);
const scienceEconomyEventIds = new Set(['printing-press', 'italian-plague-1629', 'scientific-revolution', 'great-plague-london', 'marseille-plague', 'industrial-revolution', 'railway-expansion', 'camera-adoption', 'great-depression', 'moon-landing', 'covid-19']);
const artEventIds = new Set(['royal-academy', 'herculaneum-excavations', 'pompeii-excavations', 'photography', 'paint-tube', 'great-exhibition', 'cinema', 'bauhaus', 'television', 'world-wide-web', 'smartphone', 'generative-ai']);
const historicalEventCategory = event => {
  if (historicalEventCategories.includes(event?.category)) return event.category;
  if (religiousThoughtEventIds.has(event?.id)) return 'religion-thought';
  if (scienceEconomyEventIds.has(event?.id)) return 'science-economy';
  if (artEventIds.has(event?.id)) return 'art';
  return 'history';
};
const historicalEventCategoryLabel = category => ({
  history: language === 'ko' ? '사회·정치' : 'Social & political',
  'religion-thought': language === 'ko' ? '종교·사상' : 'Religion & thought',
  'science-economy': language === 'ko' ? '과학·경제' : 'Science & economy',
  art: language === 'ko' ? '미술사' : 'Art history'
}[category] || category);
