const techniqueList=document.querySelector('#technique-list'), techniqueContent=document.querySelector('#technique-content'), techniqueSort=document.querySelector('#technique-sort');
const techniqueSidebar=document.querySelector('.technique-sidebar');
const techniqueStorageKey='art-through-time-last-technique', uHangulModeStorageKey='ArtThroughTime.uHangulMode.v7', fontStorageKey='art-atlas-font', techniqueSortStorageKey='art-through-time-technique-sort', techniqueFilterStorageKey='art-through-time-technique-filter-v1', techniqueSidebarWidthStorageKey='art-through-time-technique-sidebar-width-v1', sessionStorageKey='art-atlas-access-session-v1';
const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const copy={ko:{title:'미술 기법 및 용어',definition:'정의',development:'발전의 흐름',sort:'정렬',chronological:'시대순',korean:'가나다순',delete:'삭제',deleteConfirm:'“{name}”의 기법·용어 정보와 설명을 삭제할까요?\n이미지 파일은 보관됩니다.',empty:'등록된 기법·용어가 없습니다.',loadError:'기법·용어 자료를 불러오지 못했습니다.'},en:{title:'Art Techniques and Terms',definition:'Definition',development:'Development',sort:'Sort',chronological:'Chronological',korean:'Korean name',delete:'Delete',deleteConfirm:'Delete the information and description for “{name}”?\nImage files will be kept.',empty:'No techniques or terms are listed.',loadError:'Could not load technique and term information.'}};
const requestedUHangulMode=new URLSearchParams(location.search).get('uhangul');
const initialUHangulMode=['original','uhangul','korean'].includes(requestedUHangulMode)?requestedUHangulMode:'korean';
let language='ko', uHangulMode=initialUHangulMode, font=localStorage.getItem(fontStorageKey)||'uhangul', techniqueSortOrder=localStorage.getItem(techniqueSortStorageKey)==='korean'?'korean':'chronological', activeTechniqueFilter=localStorage.getItem(techniqueFilterStorageKey)||'all', techniques=[], techniqueSourceItems=[], techniqueComparisonLinks={}, hiddenComparisonIds=[];
const techniqueFilterOptions=[
  {id:'all',ko:'전체',en:'All'},
  {id:'제작 기법',ko:'제작 기법',en:'Making'},
  {id:'빛·색채',ko:'빛·색채',en:'Light & colour'},
  {id:'공간·원근',ko:'공간·원근',en:'Space'},
  {id:'구도·인체',ko:'구도·인체',en:'Composition'},
  {id:'매체·공예',ko:'매체·공예',en:'Media'},
  {id:'장르·주제',ko:'장르·주제',en:'Genre'}
];
if(!techniqueFilterOptions.some(option=>option.id===activeTechniqueFilter))activeTechniqueFilter='all';
const text=(value,locale=language)=>value?.[locale]||value?.ko||value?.en||'';
const normalizedArtistName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const artistListNameOverrides={
  leonardodavinci:'다 빈치',
  giottodibondone:'조토',
  giotto:'조토',
  albrechtdurer:'뒤러',
  michelangelo:'미켈란젤로',
  michelangelobuonarroti:'미켈란젤로',
  titian:'티치아노',
  tintoretto:'틴토레토',
  caravaggio:'카라바조',
  diegovelazquez:'벨라스케스',
  rembrandtvanrijn:'렘브란트',
  johannesvermeer:'베르메르',
  jmwturner:'터너',
  vincentvangogh:'반 고흐',
  caspardavidfriedrich:'프리드리히',
  antoinewatteau:'바토',
  claudeorrain:'로랭',
  claudelorrain:'로랭',
  claudemonet:'모네'
};
const artistNameParticles=new Set(['반','판','폰','데','드','델','다','디','더','르','라','레','테르']);
function koreanNameFirst(name){const source=String(name||'').trim();if(!source.includes(','))return source;const [family,given]=source.split(',').map(part=>part.trim()).filter(Boolean);return [given,family].filter(Boolean).join(' ')||source;}
function familyFirstKorean(name,originalName){const source=koreanNameFirst(name);if(String(source||'').includes(','))return source;const korean=String(source||'').trim().split(/\s+/),original=String(originalName||'').trim().split(/\s+/);if(korean.length<2||original.length<2)return korean.join(' ');const prefixes=new Set(['van','von','de','del','della','da','di','du','la','le','der','den','ten','ter','st.','saint']);let familyLength=1;for(let index=original.length-2;index>=0&&prefixes.has(original[index].toLowerCase());index--)familyLength++;if(familyLength>=korean.length)return korean.join(' ');return `${korean.slice(-familyLength).join(' ')}, ${korean.slice(0,-familyLength).join(' ')}`;}
function mapArtistParts(value,mapper){const ko=text(value,'ko'),en=text(value,'en');if(!/[·;]/.test(ko)||!/[·;]/.test(en))return mapper(ko,en);const koParts=ko.split(/\s*[·;]\s*/),enParts=en.split(/\s*[·;]\s*/);if(koParts.length!==enParts.length)return mapper(ko,en);return koParts.map((part,index)=>mapper(part,enParts[index])).join(' · ');}
function artistStandardKoreanName(value){return koreanNameFirst(text(value,'ko'));}
function artistUHangulDisplay(value){return mapArtistParts(value,(ko,en)=>familyFirstKorean(ko,en));}
function artistListKoreanName(value){return mapArtistParts(value,(ko,en)=>{const override=artistListNameOverrides[normalizedArtistName(en)]||artistListNameOverrides[normalizedArtistName(ko)];if(override)return override;const source=koreanNameFirst(ko);const words=source.replace(/,/g,' ').split(/\s+/).filter(Boolean);if(words.length<=1)return source;let start=words.length-1;while(start>0&&artistNameParticles.has(words[start-1]))start--;return words.slice(start).join(' ');});}
const artistDisplay=value=>language==='ko'?artistListKoreanName(value):text(value);
function comparisonPairs(items, comparisonLinks={}, hiddenIds=[]){
  const byId=id=>items.find(item=>item.id===id);
  const oil={...byId('glazing'),id:'oil-painting',introduced:1400,name:{ko:'유화',en:'Oil painting'},subtitle:{ko:'기름을 매체로 쓰는 느린 건조의 회화',en:'Slow-drying paint with oil as its binder'},definition:{ko:'유화는 안료를 건성유에 섞어 사용하는 회화 매체입니다. 건조가 느려 수정과 섬세한 색의 층을 만들기 좋고, 캔버스·목판·금속 등 다양한 바탕에 사용할 수 있습니다.',en:'Oil painting uses pigment mixed with a drying oil. Its slow drying time permits reworking and finely layered colour on canvas, panel, and other supports.'},explanation:{ko:'프레스코와 달리 작업 시간이 비교적 길고, 투명한 층·불투명한 층·두꺼운 붓질을 모두 활용할 수 있습니다. 글레이징과 임파스토는 유화에서 특히 중요한 표현 방법입니다.',en:'Unlike fresco, it allows longer working time and can use transparent layers, opaque layers, or thick brushwork. Glazing and impasto are especially important oil-painting methods.'}};
  const pairs=[
    ['disegno-colorito','디세뇨 - 콜로리토','Disegno - Colorito','disegno','colorito'],
    ['fresco-oil','프레스코 - 유화','Fresco - Oil painting','fresco','oil-painting'],
    ['tempera-oil','템페라 - 유화','Tempera - Oil painting','tempera','oil-painting'],
    ['chiaroscuro-sfumato','키아로스쿠로 - 스푸마토','Chiaroscuro - Sfumato','chiaroscuro','sfumato'],
    ['linear-aerial-perspective','선원근법 - 공기원근법','Linear perspective - Aerial perspective','linear-perspective','aerial-perspective'],
    ['glazing-impasto','글레이징 - 임파스토','Glazing - Impasto','glazing','impasto']
  ];
  const hidden=new Set(Array.isArray(hiddenIds)?hiddenIds:[]);
  const pairItems=pairs.map(([id,ko,en,leftId,rightId])=>{const left=leftId==='oil-painting'?oil:byId(leftId),right=rightId==='oil-painting'?oil:byId(rightId),tags=[...new Set([...(left?.tags||[]),...(right?.tags||[])])];return {id,introduced:Math.min(left?.introduced||9999,right?.introduced||9999),name:{ko,en},tags,comparison:true,left,right,links:Array.isArray(comparisonLinks[id])?comparisonLinks[id]:[]};}).filter(pair=>pair.left&&pair.right&&!hidden.has(pair.id));
  const pairedIds=new Set(pairs.flatMap(([, , ,leftId,rightId])=>[leftId,rightId]).filter(id=>id!=='oil-painting'));
  return [...pairItems,...items.filter(item=>!pairedIds.has(item.id))];
}
function adminToken(){try{const session=JSON.parse(sessionStorage.getItem(sessionStorageKey)||'null');return session?.role==='admin'&&session.token?session.token:'';}catch(_){return '';}}
const uHangulAttributes=(value,display='',listDisplay='')=>{const original=text(value,'en'),korean=artistStandardKoreanName(value),shown=display||korean,listed=listDisplay||'';if(!original&&!korean&&!shown&&!listed)return '';return ` data-uh-original="${esc(original)}" data-uh-korean="${esc(korean)}" data-uh-display-korean="${esc(shown)}"${listed?` data-uh-list-korean="${esc(listed)}"`:''}`;};
function setUHangulMode(mode){uHangulMode=['original','uhangul'].includes(mode)?mode:'korean';sessionStorage.setItem(uHangulModeStorageKey,uHangulMode);window.dispatchEvent(new CustomEvent('uhangulmodechange',{detail:{mode:uHangulMode}}));}
function sortedTechniques(){return [...techniques].sort((a,b)=>techniqueSortOrder==='korean'?text(a.name,'ko').localeCompare(text(b.name,'ko'),'ko'):Number(a.introduced)-Number(b.introduced)||text(a.name,'ko').localeCompare(text(b.name,'ko'),'ko'));}
function renderTechniqueSort(){
  if(!techniqueSort)return;
  const label=copy[language][techniqueSortOrder]||copy[language].chronological;
  techniqueSort.textContent=techniqueSortOrder==='korean'?'▼':'▲';
  techniqueSort.title=label;
  techniqueSort.setAttribute('aria-label',`${copy[language].sort}: ${label}`);
  techniqueSort.dataset.sortOrder=techniqueSortOrder;
}
function renderLanguage(){document.documentElement.lang=language;document.title=`${copy[language].title} · Art Through Time`;document.querySelector('#technique-sidebar-title').textContent=copy[language].title;document.querySelector('#technique-sort-label').textContent=copy[language].sort;renderTechniqueSort();renderTechniqueFilters();document.querySelectorAll('[data-display-mode]').forEach(button=>{const active=button.dataset.displayMode===uHangulMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});window.dispatchEvent(new CustomEvent('uhangulmodechange',{detail:{mode:uHangulMode}}));}
function renderFont(){document.querySelectorAll('[data-font]').forEach(button=>button.classList.toggle('active',button.dataset.font===font));}
async function deleteTechnique(id){const technique=techniques.find(item=>item.id===id),token=adminToken();if(!technique||!token)return;const message=copy[language].deleteConfirm.replace('{name}',text(technique.name));if(!confirm(message))return;const response=await fetch('/api/techniques',{method:'DELETE',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({id})}),result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)return alert(result.error||'Could not delete technique');techniqueSourceItems=Array.isArray(result.techniques)?result.techniques:techniqueSourceItems.filter(item=>item.id!==id);techniqueComparisonLinks=result.comparisonLinks&&typeof result.comparisonLinks==='object'?result.comparisonLinks:techniqueComparisonLinks;hiddenComparisonIds=Array.isArray(result.hiddenComparisonIds)?result.hiddenComparisonIds:hiddenComparisonIds;techniques=comparisonPairs(techniqueSourceItems,techniqueComparisonLinks,hiddenComparisonIds);const next=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey))||sortedTechniques()[0];if(next)renderTechnique(next);else{renderLanguage();renderEmpty();}}
const techniqueLinks=technique=>Array.isArray(technique?.links)?technique.links.filter(link=>typeof link?.url==='string'&&link.url):[];
async function saveTechniqueLinks(technique,links){const token=adminToken();if(!token)return false;const response=await fetch('/api/techniques',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({id:technique.id,links})}),result=await response.json().catch(()=>({}));if(!response.ok||!result.ok){alert(result.error||'Could not save technique links');return false;}Object.assign(technique,result.technique);if(technique.comparison)techniqueComparisonLinks[technique.id]=techniqueLinks(technique);else techniqueSourceItems=techniqueSourceItems.map(item=>item.id===technique.id?{...item,links:techniqueLinks(technique)}:item);techniques=techniques.map(item=>item.id===technique.id?technique:item);return true;}
function moveTechniqueLink(links,fromIndex,toIndex){const next=links.map(link=>({...link})),[link]=next.splice(fromIndex,1);if(link)next.splice(toIndex,0,link);return next;}
function setupTechniqueLinkButtons(root,technique){const buttons=[...root.querySelectorAll('.technique-link-button')];buttons.forEach(button=>button.onclick=event=>{event.preventDefault();if(button.dataset.suppressClick==='true'){delete button.dataset.suppressClick;return;}const link=techniqueLinks(technique)[Number(button.dataset.techniqueLinkIndex)];if(link?.url)window.open(link.url,'_blank','noopener');});if(!adminToken()||buttons.length<2)return;buttons.forEach(button=>button.addEventListener('pointerdown',event=>{if(event.button!==0)return;const controls=button.closest('.technique-link-controls'),startIndex=Number(button.dataset.techniqueLinkIndex);if(!controls||!Number.isFinite(startIndex))return;event.preventDefault();let dragging=false,pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;const move=pointerEvent=>{if(pointerEvent.pointerId!==pointerId)return;if(!dragging&&Math.hypot(pointerEvent.clientX-startX,pointerEvent.clientY-startY)>5){dragging=true;controls.classList.add('link-reorder-active');button.classList.add('link-dragging');}if(!dragging)return;const target=[...controls.querySelectorAll('.technique-link-button')].find(item=>{if(item===button)return false;const rect=item.getBoundingClientRect();return pointerEvent.clientX>=rect.left&&pointerEvent.clientX<=rect.right&&pointerEvent.clientY>=rect.top&&pointerEvent.clientY<=rect.bottom;});if(!target)return;const ordered=[...controls.querySelectorAll('.technique-link-button')],buttonIndex=ordered.indexOf(button),targetIndex=ordered.indexOf(target);if(buttonIndex<0||targetIndex<0||buttonIndex===targetIndex)return;controls.insertBefore(button,targetIndex>buttonIndex?target.nextSibling:target);};const cleanup=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);document.removeEventListener('pointercancel',cancel);controls.classList.remove('link-reorder-active');button.classList.remove('link-dragging');try{button.releasePointerCapture(pointerId);}catch(_){}};const cancel=pointerEvent=>{if(pointerEvent.pointerId!==pointerId)return;cleanup();renderTechnique(technique);};const stop=async pointerEvent=>{if(pointerEvent.pointerId!==pointerId)return;const endIndex=[...controls.querySelectorAll('.technique-link-button')].indexOf(button);cleanup();button.dataset.suppressClick='true';setTimeout(()=>delete button.dataset.suppressClick,500);if(!dragging){const link=techniqueLinks(technique)[startIndex];if(link?.url)window.open(link.url,'_blank','noopener');return;}if(endIndex<0||endIndex===startIndex)return renderTechnique(technique);const previous=techniqueLinks(technique),next=moveTechniqueLink(previous,startIndex,endIndex);controls.classList.add('link-renumber-pending');const delay=new Promise(resolve=>setTimeout(resolve,3000));if(!await saveTechniqueLinks(technique,next))return renderTechnique(technique);await delay;renderTechnique(technique);};button.setPointerCapture(pointerId);document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);document.addEventListener('pointercancel',cancel);}));}
function renderEmpty(){localStorage.removeItem(techniqueStorageKey);techniqueList.innerHTML='';techniqueContent.innerHTML=`<p class="technique-empty">${esc(copy[language].empty)}</p>`;}
function setupSidebarWheelScroll(){
  if(!techniqueSidebar||!techniqueList)return;
  techniqueSidebar.addEventListener('wheel',event=>{
    if(event.target.closest?.('select'))return;
    const maxScroll=techniqueList.scrollHeight-techniqueList.clientHeight;
    if(maxScroll<=0)return;
    const scale=event.deltaMode===1?16:event.deltaMode===2?techniqueList.clientHeight:1;
    const next=Math.max(0,Math.min(maxScroll,techniqueList.scrollTop+(event.deltaY*scale)));
    techniqueList.scrollTop=next;
    event.preventDefault();
  },{passive:false});
}
function syncTechniqueListScroll(){
  if(!techniqueSidebar||!techniqueList)return;
  if(window.matchMedia('(max-width: 760px)').matches){
    techniqueList.style.removeProperty('height');
  }else{
    const sidebarRect=techniqueSidebar.getBoundingClientRect();
    const listRect=techniqueList.getBoundingClientRect();
    const languageControl=techniqueSidebar.querySelector('.technique-language');
    const sidebarStyle=getComputedStyle(techniqueSidebar);
    const bottomEdge=languageControl
      ?languageControl.getBoundingClientRect().top
      :sidebarRect.bottom-parseFloat(sidebarStyle.paddingBottom);
    techniqueList.style.height=`${Math.max(0,Math.floor(bottomEdge-listRect.top))}px`;
  }
  techniqueList.classList.toggle('is-scrollable',techniqueList.scrollHeight>techniqueList.clientHeight+1);
}
function scheduleTechniqueListScrollSync(){requestAnimationFrame(syncTechniqueListScroll);}
function setupTechniqueSidebarResize(){
  const shell=document.querySelector('.technique-shell');
  if(!shell||!techniqueSidebar)return;
  const mobileQuery=window.matchMedia('(max-width: 760px)');
  const minWidth=215, maxPreferredWidth=520;
  const maxWidth=()=>Math.max(minWidth,Math.min(maxPreferredWidth,Math.floor(window.innerWidth*.52)));
  const setWidth=(value,save=false)=>{
    if(mobileQuery.matches){
      shell.style.removeProperty('--technique-sidebar-width');
      return;
    }
    const width=Math.round(Math.max(minWidth,Math.min(maxWidth(),Number(value)||minWidth)));
    shell.style.setProperty('--technique-sidebar-width',`${width}px`);
    if(save)localStorage.setItem(techniqueSidebarWidthStorageKey,String(width));
    scheduleTechniqueListScrollSync();
  };
  const savedWidth=Number(localStorage.getItem(techniqueSidebarWidthStorageKey));
  if(savedWidth)setWidth(savedWidth);
  const handle=document.createElement('div');
  handle.className='sidebar-resize-handle';
  handle.setAttribute('role','separator');
  handle.setAttribute('aria-orientation','vertical');
  handle.setAttribute('aria-label',language==='ko'?'기법 목록 너비 조절':'Resize technique list');
  techniqueSidebar.append(handle);
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||mobileQuery.matches)return;
    event.preventDefault();
    document.body.classList.add('sidebar-resizing');
    let lastWidth=techniqueSidebar.getBoundingClientRect().width;
    const resize=move=>{
      const shellRect=shell.getBoundingClientRect();
      lastWidth=move.clientX-shellRect.left;
      setWidth(lastWidth);
    };
    const stop=()=>{
      document.removeEventListener('pointermove',resize);
      document.removeEventListener('pointerup',stop);
      document.removeEventListener('pointercancel',stop);
      document.body.classList.remove('sidebar-resizing');
      setWidth(lastWidth,true);
    };
    try{handle.setPointerCapture(event.pointerId);}catch(_){}
    document.addEventListener('pointermove',resize);
    document.addEventListener('pointerup',stop);
    document.addEventListener('pointercancel',stop);
  });
  window.addEventListener('resize',()=>{
    const width=Number(localStorage.getItem(techniqueSidebarWidthStorageKey));
    if(width)setWidth(width);
    else if(mobileQuery.matches)shell.style.removeProperty('--technique-sidebar-width');
  });
}
function setupTechniqueLinkEntry(technique) {
  const entry=techniqueContent.querySelector('.technique-link-entry');
  techniqueContent.querySelector('.technique-link-add')?.addEventListener('click',()=>{entry.classList.toggle('hidden');if(!entry.classList.contains('hidden'))entry.querySelector('input').focus();});
  if(entry)entry.onsubmit=async event=>{event.preventDefault();const input=entry.querySelector('input');let url;try{url=new URL(input.value.trim());if(!['http:','https:'].includes(url.protocol))throw new Error();}catch(_){input.setCustomValidity(language==='ko'?'http 또는 https 주소를 입력하세요.':'Enter an http or https URL.');input.reportValidity();input.setCustomValidity('');return;}if(await saveTechniqueLinks(technique,[...techniqueLinks(technique),{url:url.href}]))renderTechnique(technique);};
}
function renderTechnique(technique){
  localStorage.setItem(techniqueStorageKey,technique.id);
  renderLanguage();
  renderFont();
  const token=adminToken();
  techniqueList.innerHTML=sortedTechniques().map(item=>{const canDelete=Boolean(token);return `<div class="technique-list-row"><button class="technique-item ${item.id===technique.id?'active':''}${canDelete?' has-delete':''}" data-technique="${esc(item.id)}"${canDelete?` data-delete-technique="${esc(item.id)}" title="${esc(copy[language].delete)}"`:''}><span class="technique-name"${uHangulAttributes(item.name)}>${esc(text(item.name,'ko'))}</span><small class="technique-year">${esc(item.introduced)}</small></button></div>`;}).join('');
  techniqueList.querySelectorAll('[data-technique]').forEach(button=>button.addEventListener('click',event=>{const deleteId=button.dataset.deleteTechnique,rect=button.getBoundingClientRect(),clickedDelete=event.detail>0&&event.clientX-rect.left<38;if(deleteId&&clickedDelete)return deleteTechnique(deleteId);renderTechnique(techniques.find(item=>item.id===button.dataset.technique));}));
  requestAnimationFrame(applyTechniqueSearchFilter);
  const savedLinks=techniqueLinks(technique),addLinkLabel=language==='ko'?'자료 추가':'Add resource',linkInputLabel=language==='ko'?'자료 URL을 입력하세요':'Enter a resource URL',confirmLinkLabel=language==='ko'?'확인':'Add',linkButtons=savedLinks.map((link,index)=>`<button class="technique-link-button" type="button" data-technique-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index+1}. ${link.url}`)}">${index+1}</button>`).join(''),linkAdd=token?`<button class="technique-link-add" type="button" title="${esc(addLinkLabel)}" aria-label="${esc(addLinkLabel)}">+</button>`:'',linkControls=`<span class="technique-link-controls">${linkButtons}</span>`,linkEntry=token?`<form class="technique-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(linkInputLabel)}" required><button type="submit">${esc(confirmLinkLabel)}</button></form>`:'';
  if(technique.comparison){
    const side=item=>`<article class="technique-comparison-side"><header><p class="eyebrow">${esc(item.introduced)}</p><h2${uHangulAttributes(item.name)}>${esc(text(item.name))}</h2><p class="subtitle">${esc(text(item.subtitle))}</p></header><section><h3>${esc(copy[language].definition)}</h3><p>${esc(text(item.definition))}</p><p>${esc(text(item.explanation))}</p></section>${item.examples?.[0]?`<article class="technique-comparison-example"><img src="${esc(item.examples[0].image)}" alt="${esc(`${text(item.examples[0].artist)} ${text(item.examples[0].title)}`)}"><div><p class="example-year">${esc(item.examples[0].year)} · ${esc(text(item.examples[0].role))}</p><h3>${esc(text(item.examples[0].title))}</h3><p class="artist"${uHangulAttributes(item.examples[0].artist,artistUHangulDisplay(item.examples[0].artist),artistListKoreanName(item.examples[0].artist))}>${esc(artistDisplay(item.examples[0].artist))}</p></div></article>`:''}</article>`;
    techniqueContent.innerHTML=`<header><p class="eyebrow">TECHNIQUE COMPARISON</p><div class="technique-title-row"><h1${uHangulAttributes(technique.name)}>${esc(text(technique.name))}</h1>${linkAdd}${linkControls}</div><p class="subtitle">두 기법이 무엇을 우선하고 어떤 화면 효과를 만드는지 나란히 비교합니다.</p>${linkEntry}</header><section class="technique-comparison">${side(technique.left)}${side(technique.right)}</section>`;
    renderLanguage();
    setupTechniqueLinkEntry(technique);
    setupTechniqueLinkButtons(techniqueContent,technique);
    scheduleTechniqueListScrollSync();
    return;
  }
  const examples=Array.isArray(technique.examples)?technique.examples:[];
  const development=examples.length?`<section class="development"><h2>${esc(copy[language].development)}</h2>${examples.map(example=>`<article class="technique-example"><div class="example-image"><img src="${esc(example.image)}" alt="${esc(`${text(example.artist)} ${text(example.title)}`)}"></div><div class="example-note"><p class="example-year">${esc(example.year)} · ${esc(text(example.role))}</p><h3>${esc(text(example.title))}</h3><p class="artist ${font === 'uhangul' ? 'uhangul-font' : ''}"${uHangulAttributes(example.artist,artistUHangulDisplay(example.artist),artistListKoreanName(example.artist))}>${esc(artistDisplay(example.artist))}</p><p>${esc(text(example.note))}</p></div></article>`).join('')}</section>`:'';
  techniqueContent.innerHTML=`<header><p class="eyebrow">TECHNIQUE · ${esc(technique.introduced)}</p><div class="technique-title-row"><h1${uHangulAttributes(technique.name)}>${esc(text(technique.name))}</h1>${linkAdd}${linkControls}</div><p class="subtitle">${esc(text(technique.subtitle))}</p>${linkEntry}</header><section class="definition"><h2>${esc(copy[language].definition)}</h2><p>${esc(text(technique.definition))}</p><p>${esc(text(technique.explanation))}</p></section>${development}`;
  renderLanguage();
  setupTechniqueLinkEntry(technique);
  setupTechniqueLinkButtons(techniqueContent,technique);
  scheduleTechniqueListScrollSync();
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-display-mode]');if(!button)return;setUHangulMode(button.dataset.displayMode);const selected=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey));if(selected)renderTechnique(selected);else renderLanguage();});
techniqueSort.addEventListener('click',()=>{techniqueSortOrder=techniqueSortOrder==='korean'?'chronological':'korean';localStorage.setItem(techniqueSortStorageKey,techniqueSortOrder);const selected=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey))||sortedTechniques()[0];if(selected)renderTechnique(selected);else renderTechniqueSort();});
document.querySelectorAll('[data-font]').forEach(button=>button.addEventListener('click',()=>{font=button.dataset.font;localStorage.setItem(fontStorageKey,font);const selected=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey));if(selected)renderTechnique(selected);else{renderFont();}}));
setupSidebarWheelScroll();
setupTechniqueSidebarResize();
window.addEventListener('resize',scheduleTechniqueListScrollSync);
if('ResizeObserver' in window)new ResizeObserver(scheduleTechniqueListScrollSync).observe(techniqueSidebar);
async function loadTechniques(){
  let response=await fetch('/api/techniques',{cache:'no-store'}).catch(()=>null);
  // An already-running server may predate the management API. Reading the local
  // data file keeps the reference material available while that server is restarted.
  if(!response?.ok) response=await fetch('data/techniques.json',{cache:'no-store'});
  if(!response.ok) throw new Error('Could not load techniques');
  return response.json();
}
const techniqueLogoutButton=document.querySelector('.technique-logout')||document.createElement('button');
techniqueLogoutButton.type='button'; techniqueLogoutButton.className='technique-logout'; techniqueLogoutButton.textContent='로그아웃';
document.querySelector('.technique-language').after(techniqueLogoutButton);
techniqueLogoutButton.onclick=async()=>{const saved=JSON.parse(sessionStorage.getItem('art-atlas-access-session-v1')||'null');try{await fetch('/api/auth/logout',{method:'POST',headers:saved?.token?{Authorization:`Bearer ${saved.token}`}:{}});}catch(_){}try{sessionStorage.removeItem('art-atlas-access-session-v1');localStorage.setItem('art-atlas-logout-signal',String(Date.now()));}catch(_){}location.assign('index.html?login=1');};
loadTechniques().then(data=>{techniqueSourceItems=data.techniques||[];techniqueComparisonLinks=data.comparisonLinks||{};hiddenComparisonIds=data.hiddenComparisonIds||[];techniques=comparisonPairs(techniqueSourceItems,techniqueComparisonLinks,hiddenComparisonIds);const selected=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey))||sortedTechniques()[0];if(selected)renderTechnique(selected);else{renderLanguage();renderEmpty();}}).catch(()=>{renderLanguage();techniqueContent.innerHTML=`<p class="technique-empty">${esc(copy[language].loadError)}</p>`;});

// The technique list is intentionally compact: chronological ascending or
// descending order only.  Preserve older saved values as the same two modes.
copy.ko.chronological='오름차순'; copy.ko.korean='내림차순';
copy.en.chronological='Ascending'; copy.en.korean='Descending';
function sortedTechniques(){const direction=techniqueSortOrder==='korean'?-1:1;return [...techniques].sort((a,b)=>direction*text(a.name,'ko').localeCompare(text(b.name,'ko'),'ko'));}

// Compact language toggle and artist-list-style technique/term finder for the sidebar.
const techniqueSearch=document.createElement('div');
techniqueSearch.className='technique-search';
techniqueSearch.innerHTML='<input class="technique-search-input" type="search" autocomplete="off" placeholder="기법·용어 검색" aria-label="기법·용어 검색">';
document.querySelector('#technique-sidebar-title')?.after(techniqueSearch);
const techniqueSearchInput=techniqueSearch.querySelector('.technique-search-input');
const techniqueFilters=document.createElement('div');
techniqueFilters.className='technique-filter-chips';
techniqueFilters.setAttribute('role','group');
techniqueFilters.setAttribute('aria-label','기법·용어 분류 필터');
techniqueSearch.after(techniqueFilters);
const normalizedTechniqueSearch=value=>String(value||'').toLocaleLowerCase().replace(/[\s\-–—·,./()]/g,'').trim();
function techniqueTags(technique){
  if(!technique)return [];
  if(Array.isArray(technique.tags))return technique.tags;
  if(technique.comparison)return [...new Set([...(techniqueTags(technique.left)),...(techniqueTags(technique.right))])];
  return [];
}
function techniqueMatchesSearch(technique, query) {
  if(!query) return true;
  const values=[technique?.name?.ko,technique?.name?.en,technique?.subtitle?.ko,technique?.subtitle?.en,...techniqueTags(technique)].map(normalizedTechniqueSearch);
  return values.some(value=>value.includes(query));
}
function techniqueMatchesFilter(technique){
  return activeTechniqueFilter==='all'||techniqueTags(technique).includes(activeTechniqueFilter);
}
function visibleTechniques(){
  const query=normalizedTechniqueSearch(techniqueSearchInput?.value);
  return sortedTechniques().filter(technique=>techniqueMatchesSearch(technique,query)&&techniqueMatchesFilter(technique));
}
function renderTechniqueFilters(){
  if(!techniqueFilters)return;
  techniqueFilters.innerHTML=techniqueFilterOptions.map(option=>`<button class="technique-filter-chip ${option.id===activeTechniqueFilter?'active':''}" type="button" data-technique-filter="${esc(option.id)}" aria-pressed="${option.id===activeTechniqueFilter?'true':'false'}">${esc(option[language]||option.ko)}</button>`).join('');
}
function applyTechniqueSearchFilter(){
  const query=normalizedTechniqueSearch(techniqueSearchInput?.value);
  let visibleCount=0;
  techniqueList.querySelectorAll('[data-technique]').forEach(button=>{
    const technique=techniques.find(item=>item.id===button.dataset.technique);
    const visible=techniqueMatchesSearch(technique,query)&&techniqueMatchesFilter(technique);
    button.closest('.technique-list-row')?.classList.toggle('search-hidden',!visible);
    if(visible)visibleCount+=1;
  });
  techniqueList.querySelector('.technique-search-empty')?.remove();
  if((query||activeTechniqueFilter!=='all')&&!visibleCount)techniqueList.insertAdjacentHTML('beforeend',`<p class="technique-search-empty">${language==='ko'?'일치하는 기법·용어가 없습니다.':'No matching techniques or terms.'}</p>`);
  scheduleTechniqueListScrollSync();
}
function renderTechniqueSearchResults(){
  applyTechniqueSearchFilter();
}
techniqueFilters.addEventListener('click',event=>{
  const button=event.target.closest('[data-technique-filter]');
  if(!button)return;
  activeTechniqueFilter=button.dataset.techniqueFilter;
  localStorage.setItem(techniqueFilterStorageKey,activeTechniqueFilter);
  renderTechniqueFilters();
  const current=techniques.find(item=>item.id===localStorage.getItem(techniqueStorageKey));
  if(current&&techniqueMatchesFilter(current)&&techniqueMatchesSearch(current,normalizedTechniqueSearch(techniqueSearchInput?.value))){
    applyTechniqueSearchFilter();
    return;
  }
  const next=visibleTechniques()[0];
  if(next)renderTechnique(next);
  else applyTechniqueSearchFilter();
});
techniqueSearchInput?.addEventListener('input',renderTechniqueSearchResults);
techniqueSearchInput?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){techniqueSearchInput.value='';renderTechniqueSearchResults();techniqueSearchInput.blur();return;}
  if(event.key==='Enter'){
    event.preventDefault();
    const match=visibleTechniques()[0];
    if(match)renderTechnique(match);
  }
});

// The administrator delete target sits at the right edge of each list item.
techniqueList.addEventListener('click',event=>{
  const button=event.target.closest?.('.technique-item.has-delete');
  if(!button)return;
  const rect=button.getBoundingClientRect();
  const clickedDelete=event.detail>0&&event.clientX-rect.left>rect.width-38;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(clickedDelete)return showTechniqueDeleteMenu(button,button.dataset.deleteTechnique);
  const technique=techniques.find(item=>item.id===button.dataset.technique);
  if(technique)renderTechnique(technique);
},true);
let techniqueDeleteMenu;
function showTechniqueDeleteMenu(trigger,id){
  techniqueDeleteMenu?.remove();
  const rect=trigger.getBoundingClientRect();
  const menu=document.createElement('div');
  menu.className='technique-delete-menu';
  menu.innerHTML=`<button type="button">${esc(copy[language].delete)}</button>`;
  Object.assign(menu.style,{top:`${Math.min(window.innerHeight-42,rect.bottom+4)}px`,left:`${Math.max(8,rect.right-76)}px`});
  menu.querySelector('button').addEventListener('click',()=>{menu.remove();deleteTechnique(id);});
  document.body.append(menu);
  techniqueDeleteMenu=menu;
  setTimeout(()=>document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target)&&event.target!==trigger){menu.remove();if(techniqueDeleteMenu===menu)techniqueDeleteMenu=null;}},{once:true}),0);
}
