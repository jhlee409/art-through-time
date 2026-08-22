const $ = selector => document.querySelector(selector);
const text = value => value?.ko || value?.en || value || '';
const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

let topics = [];
let selected = null;
let listDirection = 'asc';
const sessionStorageKey = 'art-atlas-access-session-v1';
const topicSidebarWidthStorageKey = 'art-through-time-topic-sidebar-width-v1';
const adminToken = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionStorageKey) || 'null');
    return session?.role === 'admin' && session.token ? session.token : '';
  } catch (_) { return ''; }
};
function setupTopicSidebarResize() {
  const shell = $('.topics-shell');
  const sidebar = $('.topic-sidebar');
  if (!shell || !sidebar) return;
  const mobileQuery = window.matchMedia('(max-width: 800px)');
  const minWidth = 215;
  const maxPreferredWidth = 520;
  const maxWidth = () => Math.max(minWidth, Math.min(maxPreferredWidth, Math.floor(window.innerWidth * 0.52)));
  const setWidth = (value, save = false) => {
    if (mobileQuery.matches) {
      shell.style.removeProperty('--topic-sidebar-width');
      return;
    }
    const width = Math.round(Math.max(minWidth, Math.min(maxWidth(), Number(value) || minWidth)));
    shell.style.setProperty('--topic-sidebar-width', `${width}px`);
    if (save) localStorage.setItem(topicSidebarWidthStorageKey, String(width));
  };
  const savedWidth = Number(localStorage.getItem(topicSidebarWidthStorageKey));
  if (savedWidth) setWidth(savedWidth);
  const handle = document.createElement('div');
  handle.className = 'sidebar-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', '주제 목록 너비 조절');
  sidebar.append(handle);
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mobileQuery.matches) return;
    event.preventDefault();
    document.body.classList.add('sidebar-resizing');
    let lastWidth = sidebar.getBoundingClientRect().width;
    const resize = move => {
      const shellRect = shell.getBoundingClientRect();
      lastWidth = move.clientX - shellRect.left;
      setWidth(lastWidth);
    };
    const stop = () => {
      document.removeEventListener('pointermove', resize);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
      document.body.classList.remove('sidebar-resizing');
      setWidth(lastWidth, true);
    };
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    document.addEventListener('pointermove', resize);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
  });
  window.addEventListener('resize', () => {
    const width = Number(localStorage.getItem(topicSidebarWidthStorageKey));
    if (width) setWidth(width);
    else if (mobileQuery.matches) shell.style.removeProperty('--topic-sidebar-width');
  });
}
setupTopicSidebarResize();
async function logoutTopicPage() {
  const token = adminToken();
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (_) {}
  try {
    sessionStorage.removeItem(sessionStorageKey);
    localStorage.setItem('art-atlas-logout-signal', String(Date.now()));
  } catch (_) {}
  location.assign('index.html?login=1');
}

const MOVEMENT_ORDER = { '초기 르네상스': 10, '전성기 르네상스': 20, '매너리즘': 30, '바로크': 40 };
const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 240%22%3E%3Crect width=%22320%22 height=%22240%22 fill=%22%23ede8dc%22/%3E%3Cpath d=%22M82 154l44-51 35 37 24-25 53 59H82z%22 fill=%22%23c6cfc0%22/%3E%3Ccircle cx=%22222%22 cy=%2270%22 r=%2220%22 fill=%22%23d9d5ca%22/%3E%3Ctext x=%22160%22 y=%22212%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2214%22 fill=%22%23758078%22%3EImage unavailable%3C/text%3E%3C/svg%3E';
const normalize = value => String(value || '').toLowerCase().replace(/[\s\-–—·,./()]/g, '');
const imageErrorHandler = `this.onerror=null;this.src='${fallbackImage}';this.classList.add('image-fallback')`;
const topicImage = work => work?.thumbnail || fallbackImage;
const workMetaLine = work => [work?.artist, work?.year].map(value => String(value || '').trim()).filter(Boolean).join(' · ');

function openTopicImageWindow(work) {
  const image = topicImage(work);
  if (!image || image === fallbackImage) return;
  const popup = window.open('', 'artAtlasTopicImage', 'popup=yes,width=1180,height=860,scrollbars=yes,resizable=yes');
  if (!popup) return alert('이미지 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.');
  const src = JSON.stringify(new URL(image, location.href).href).replace(/</g, '\\u003c');
  const title = JSON.stringify(String(work.title || '')).replace(/</g, '\\u003c');
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(work.title || 'Image')}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#10120f;color:#f7f4ec;font-family:system-ui,sans-serif}#toolbar{height:42px;box-sizing:border-box;display:flex;align-items:center;padding:0 16px;background:#242820;font-size:12px;color:#c8cdc2}#stage{height:calc(100% - 42px);position:relative;overflow:hidden;touch-action:none;cursor:grab;user-select:none}#stage.dragging{cursor:grabbing}#artwork{position:absolute;top:50%;left:50%;max-width:none;max-height:none;transform:translate(-50%,-50%);pointer-events:none;user-select:none}</style></head><body><div id="toolbar">왼쪽 버튼을 누른 채 드래그: 이동 · 휠 위로: 확대 · 휠 아래로: 축소</div><div id="stage"><img id="artwork" alt=""></div><script>const src=${src},title=${title},stage=document.querySelector('#stage'),image=document.querySelector('#artwork');document.title=title||'Image';image.src=src;image.alt=title;let zoom=1,x=0,y=0,drag=null;const clamp=()=>{const maxX=Math.max(0,(image.offsetWidth-stage.clientWidth)/2),maxY=Math.max(0,(image.offsetHeight-stage.clientHeight)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));};const draw=()=>{if(!image.naturalWidth)return;const base=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);image.style.width=Math.max(1,image.naturalWidth*base*zoom)+'px';image.style.height=Math.max(1,image.naturalHeight*base*zoom)+'px';clamp();image.style.transform='translate(calc(-50% + '+x+'px), calc(-50% + '+y+'px))';};image.addEventListener('load',draw);window.addEventListener('resize',draw);stage.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y};stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');});stage.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;x=drag.startX+event.clientX-drag.x;y=drag.startY+event.clientY-drag.y;draw();});const stop=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;stage.classList.remove('dragging');};stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);stage.addEventListener('wheel',event=>{event.preventDefault();const oldZoom=zoom,ratio=event.deltaY<0?1.1:1/1.1;zoom=Math.max(.5,Math.min(6,zoom*ratio));const actualRatio=zoom/oldZoom,rect=stage.getBoundingClientRect(),pointX=event.clientX-rect.left-stage.clientWidth/2,pointY=event.clientY-rect.top-stage.clientHeight/2;x=x*actualRatio+pointX*(1-actualRatio);y=y*actualRatio+pointY*(1-actualRatio);draw();},{passive:false});<\/script></body></html>`);
  popup.document.close();
}

function openTopicMosaicWindow(topic) {
  const works = topicWorks(topic).filter(work => topicImage(work) && topicImage(work) !== fallbackImage);
  if (!works.length) return alert('모자이크로 볼 이미지가 없습니다.');
  const frame = document.querySelector('.topic-image-frame')?.getBoundingClientRect();
  const tileWidth = Math.max(144, Math.round((frame?.width || 315) * 0.72));
  const tileHeight = Math.max(144, Math.round((frame?.height || 320) * 0.72));
  const title = text(topic.name) || '모자이크 보기';
  const storageKey = `art-atlas-topic-mosaic-order-${String(topic.id || title)}`;
  const items = works.map(work => ({
    id: String(work.id || ''),
    src: new URL(topicImage(work), location.href).href,
    title: String(work.title || ''),
    artist: String(work.artist || ''),
    year: String(work.year || '')
  }));
  const popup = window.open('', 'artAtlasTopicMosaic', 'popup=yes,width=1280,height=900,scrollbars=yes,resizable=yes');
  if (!popup) return alert('모자이크 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.');
  const payload = JSON.stringify({title, tileWidth, tileHeight, storageKey, items}).replace(/</g, '\\u003c');
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)} · 모자이크</title><style>:root{--tile-w:${tileWidth}px;--tile-h:${tileHeight}px;--tile-gap:1em}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#10120f;color:#f7f4ec;font-family:system-ui,'Noto Sans KR',sans-serif}body{overflow:auto}.toolbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:43px;padding:9px 14px;background:#242820;color:#d7ddd4;box-shadow:0 6px 18px #0005}.toolbar-left{display:flex;align-items:center;gap:10px;min-width:0}.toolbar button{min-height:28px;border:1px solid #8e9b8b;border-radius:4px;background:#fffdf8;color:#28352d;padding:6px 10px;font:700 12px/1 system-ui,sans-serif;white-space:nowrap}.toolbar button:hover{background:#dfe8d9}.toolbar strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.toolbar span{font-size:12px;color:#bfc8bd}.mosaic{display:grid;grid-template-columns:repeat(auto-fill,var(--tile-w));grid-auto-rows:var(--tile-h);place-content:start;gap:var(--tile-gap);padding:var(--tile-gap);overflow:visible}.tile{position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto;width:var(--tile-w);height:var(--tile-h);margin:0;border:1px solid #10120f;background:#1d211b;cursor:grab;overflow:hidden}.tile.dragging{opacity:.42;cursor:grabbing}.tile img{display:block;width:100%;height:100%;min-height:0;object-fit:contain;background:#242820;pointer-events:none;user-select:none}.caption{display:block;max-height:38px;overflow:hidden;padding:4px 5px;background:rgba(0,0,0,.82);color:#fffdf8;font-size:10px;line-height:1.25;pointer-events:none}.mosaic-hover{position:fixed;z-index:300;display:none;width:calc(var(--tile-w) * 2);height:calc(var(--tile-h) * 2);border:3px solid #fffdf8;background:#0f120f;box-shadow:0 18px 46px #000b;pointer-events:none}.mosaic-hover img{display:block;width:100%;height:100%;object-fit:contain;background:#0f120f}</style></head><body><div class="toolbar"><div class="toolbar-left"><button type="button" class="reset-order">원래위치로</button><strong></strong></div><span>이미지에 커서: 2배 확대 · 드래그: 위치 이동 · 창 크기에 따라 스크롤</span></div><main class="mosaic"></main><div class="mosaic-hover"><img alt=""></div><script>const data=${payload};const originalItems=data.items.map(item=>({...item}));document.title=data.title+' · 모자이크';document.documentElement.style.setProperty('--tile-w',data.tileWidth+'px');document.documentElement.style.setProperty('--tile-h',data.tileHeight+'px');document.querySelector('.toolbar strong').textContent=data.title+' · '+data.items.length+'점';const mosaic=document.querySelector('.mosaic'),hover=document.querySelector('.mosaic-hover'),hoverImage=hover.querySelector('img');let dragged=null;function escText(value){return String(value||'').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));}function label(item){return [item.artist,item.title,item.year].filter(Boolean).join(' · ');}function saveOrder(){try{localStorage.setItem(data.storageKey,JSON.stringify(data.items.map(item=>item.id)));}catch(_){}}function restoreLastOrder(){try{const order=JSON.parse(localStorage.getItem(data.storageKey)||'[]');if(!Array.isArray(order)||!order.length)return;const byId=new Map(data.items.map(item=>[item.id,item]));const next=order.map(id=>byId.get(id)).filter(Boolean);data.items.forEach(item=>{if(!order.includes(item.id))next.push(item);});if(next.length===data.items.length)data.items=next;}catch(_){}}function previewMove(event){const gap=16;let left=event.clientX+gap,top=event.clientY+gap;hover.style.display='block';const width=hover.offsetWidth,height=hover.offsetHeight;if(left+width>innerWidth-8)left=event.clientX-width-gap;if(top+height>innerHeight-8)top=event.clientY-height-gap;left=Math.max(8,left);top=Math.max(52,top);hover.style.left=left+'px';hover.style.top=top+'px';}function render(){mosaic.innerHTML=data.items.map((item,index)=>'<article class="tile" draggable="true" data-index="'+index+'"><img src="'+escText(item.src)+'" alt="'+escText(item.title)+'"><span class="caption">'+escText(label(item))+'</span></article>').join('');mosaic.querySelectorAll('.tile').forEach(tile=>{tile.addEventListener('dragstart',event=>{dragged=tile;hover.style.display='none';tile.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',tile.dataset.index);});tile.addEventListener('dragend',()=>{tile.classList.remove('dragging');dragged=null;});tile.addEventListener('pointerenter',event=>{const item=data.items[Number(tile.dataset.index)];hoverImage.src=item.src;hoverImage.alt=item.title;previewMove(event);});tile.addEventListener('pointermove',previewMove);tile.addEventListener('pointerleave',()=>{hover.style.display='none';});});}function reorder(from,to){if(from===to||from<0||to<0)return;const item=data.items.splice(from,1)[0];data.items.splice(to,0,item);saveOrder();render();}mosaic.addEventListener('dragover',event=>{if(!dragged)return;event.preventDefault();event.dataTransfer.dropEffect='move';});mosaic.addEventListener('drop',event=>{if(!dragged)return;event.preventDefault();const target=event.target.closest('.tile');if(!target)return;reorder(Number(dragged.dataset.index),Number(target.dataset.index));});document.querySelector('.reset-order').onclick=()=>{data.items=originalItems.map(item=>({...item}));saveOrder();render();};restoreLastOrder();render();</script></body></html>`);
  popup.document.close();
}

function topicWorks(topic) {
  return (topic?.works || []).slice().sort((a, b) =>
    (a.sequence || 999) - (b.sequence || 999) ||
    (MOVEMENT_ORDER[a.movement] || 999) - (MOVEMENT_ORDER[b.movement] || 999) ||
    (a.sortYear || 9999) - (b.sortYear || 9999)
  );
}

function render() {
  const items = topicWorks(selected);
  $('#topic-add-artwork').hidden = !adminToken();
  $('#topic-mosaic-view').hidden = !items.some(work => topicImage(work) && topicImage(work) !== fallbackImage);
  $('#title').textContent = text(selected.name);
  $('#hint').textContent = selected.description?.ko || '';
  $('#axis').innerHTML = `<div class="topic-axis">${items.map(work => `
    <section class="topic-row">
      <div class="topic-axis-label"><strong>${esc(work.year)}</strong><span>${esc(work.movement)}</span></div>
      <article class="topic-card">
        <div class="topic-image-frame">
          <img src="${esc(topicImage(work))}" alt="${esc(work.title)}" onerror="${esc(imageErrorHandler)}">
          <button class="topic-image-action topic-detail-artwork" type="button" data-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 설명 보기" title="설명 보기">i</button>
          <button class="topic-image-action topic-preview-artwork" type="button" data-preview-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 크게 보기" title="크게 보기">⌕</button>
          ${adminToken() ? `<button class="topic-image-action topic-delete-artwork" type="button" data-delete-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 삭제" title="그림 삭제">×</button>` : ''}
          ${adminToken() ? `<button class="topic-image-action topic-replace-image" type="button" data-replace-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 이미지 교체" title="이미지 교체">↗</button>` : ''}
          <div class="topic-zoom-preview" aria-hidden="true"><img src="${esc(topicImage(work))}" alt="" onerror="${esc(imageErrorHandler)}"></div>
        </div>
        <strong>${esc(work.title)}</strong><small>${esc(work.artist)}</small>
      </article>
    </section>`).join('')}</div>`;
}

function renderList() {
  const query = $('#topic-search').value.trim();
  const compactQuery = normalize(query);
  const visible = topics
    .filter(topic => !query || [text(topic.name), ...(topic.keywords || [])].some(value => String(value || '').toLocaleLowerCase().includes(query.toLocaleLowerCase()) || normalize(value).includes(compactQuery)))
    .sort((a, b) => text(a.name).localeCompare(text(b.name), 'ko') * (listDirection === 'asc' ? 1 : -1));
  $('#topics').innerHTML = visible.length
    ? visible.map(topic => `<button class="${topic.id === selected?.id ? 'active' : ''}" data-id="${esc(topic.id)}">${esc(text(topic.name))}</button>`).join('')
    : '<p class="topic-candidates empty">일치하는 주제·사건이 없습니다.</p>';
  $('#topic-sort').value = listDirection;
  if (!selected && visible[0]) { selected = visible[0]; render(); }
}

$('#topics').onclick = event => {
  const topic = topics.find(item => item.id === event.target.dataset.id);
  if (topic) { selected = topic; renderList(); render(); }
};
$('#axis').onclick = event => {
  const deleteButton = event.target.closest('[data-delete-work-id]');
  if (deleteButton) {
    const work = selected?.works?.find(item => item.id === deleteButton.dataset.deleteWorkId);
    if (work) deleteTopicArtwork(work);
    return;
  }
  const replaceButton = event.target.closest('[data-replace-work-id]');
  if (replaceButton) {
    pendingReplaceWorkId = replaceButton.dataset.replaceWorkId;
    topicImageReplacePicker.value = '';
    topicImageReplacePicker.click();
    return;
  }
  const previewButton = event.target.closest('[data-preview-work-id]');
  if (previewButton) {
    const work = selected?.works?.find(item => item.id === previewButton.dataset.previewWorkId);
    if (work) openTopicImageWindow(work);
    return;
  }
  const button = event.target.closest('[data-work-id]');
  if (!button) return;
  const work = selected.works.find(item => item.id === button.dataset.workId);
  const meta = workMetaLine(work);
  $('#detail').classList.add('show');
  $('#detail').innerHTML = `<button class="close-topic-detail" aria-label="닫기">×</button><h2>${esc(work.title)}</h2>${meta ? `<p>${esc(meta)}</p>` : ''}${work.movement ? `<p><b>${esc(work.movement)}</b></p>` : ''}<p>${esc(work.description)}</p>`;
};
$('#detail').onclick = event => { if (event.target.closest('.close-topic-detail')) $('#detail').classList.remove('show'); };
$('#topic-search').oninput = renderList;
$('#topic-sort').onchange = event => { listDirection = event.currentTarget.value === 'desc' ? 'desc' : 'asc'; renderList(); };
$('#topic-logout').onclick = logoutTopicPage;
$('#topic-mosaic-view').onclick = () => { if (selected) openTopicMosaicWindow(selected); };

const topicArtworkDialog = $('#topic-artwork-dialog');
const topicArtworkForm = $('#topic-artwork-form');
const topicArtworkPicker = $('#topic-artwork-picker');
const topicImageReplacePicker = $('#topic-image-replace-picker');
let pendingTopicArtworkFiles = [];
let pendingReplaceWorkId = '';
function inferredTopicArtworkTitle(file) {
  const fileName=String(file?.name || '').split(/[\\/]/).pop();
  try { return decodeURIComponent(fileName).replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').trim(); }
  catch (_) { return fileName.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').trim(); }
}
function inferredTopicArtworkYear(file) {
  const match=String(file?.name || '').match(/(?:^|[^0-9])([12][0-9]{3})(?:\s*[-–]\s*([12][0-9]{3}))?(?:[^0-9]|$)/);
  return match ? {start:match[1], end:match[2] || match[1]} : null;
}
function setTopicArtworkFiles(files) {
  pendingTopicArtworkFiles=files;
  const titleInput=$('#topic-artwork-title');
  const startInput=$('#topic-artwork-start');
  const endInput=$('#topic-artwork-end');
  const multiple=files.length>1;
  topicArtworkForm.reset();
  $('#topic-artwork-error').textContent='';
  titleInput.disabled=multiple;
  titleInput.required=!multiple;
  if(multiple) {
    titleInput.value='파일명에서 자동 입력';
    $('#topic-artwork-file-name').textContent=`선택한 파일: ${files.length}개`;
  } else {
    titleInput.value=inferredTopicArtworkTitle(files[0]);
    $('#topic-artwork-file-name').textContent=`선택한 파일: ${files[0].name}`;
  }
  const inferred=inferredTopicArtworkYear(files[0]);
  if(inferred) { startInput.value=inferred.start; endInput.value=inferred.end; }
}
async function deleteTopicArtwork(work) {
  const token = adminToken();
  if (!selected || !token) return;
  if (!confirm(`‘${work.title}’ 작품을 삭제할까요? 로컬 이미지가 연결된 경우 함께 삭제됩니다.`)) return;
  try {
    const response = await fetch('/api/topic-artwork', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ topicId: selected.id, workId: work.id })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '작품을 삭제하지 못했습니다.');
    topics = result.topics || topics;
    selected = topics.find(topic => topic.id === selected.id) || selected;
    $('#detail').classList.remove('show');
    render();
  } catch (deleteError) { alert(deleteError.message); }
}
$('#topic-add-artwork').onclick = () => {
  if (!selected || !adminToken()) return;
  topicArtworkPicker.value = '';
  topicArtworkPicker.click();
};
topicArtworkPicker.onchange = () => {
  const files = [...(topicArtworkPicker.files || [])];
  if (!files.length) return;
  setTopicArtworkFiles(files);
  topicArtworkDialog.showModal();
};
topicImageReplacePicker.onchange = async () => {
  const file = topicImageReplacePicker.files[0];
  const token = adminToken();
  if (!file || !pendingReplaceWorkId || !selected || !token) return;
  const form = new FormData();
  form.append('topicId', selected.id);
  form.append('workId', pendingReplaceWorkId);
  form.append('image', file);
  try {
    const response = await fetch('/api/topic-artwork-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '이미지를 교체하지 못했습니다.');
    topics = result.topics || topics;
    selected = topics.find(topic => topic.id === selected.id) || selected;
    render();
  } catch (replaceError) { alert(replaceError.message); }
  finally { pendingReplaceWorkId = ''; }
};
document.querySelector('[data-close-topic-dialog]').onclick = () => topicArtworkDialog.close();
topicArtworkForm.onsubmit = async event => {
  event.preventDefault();
  const token = adminToken();
  const files = pendingTopicArtworkFiles;
  const startYear = Number($('#topic-artwork-start').value);
  const endYear = Number($('#topic-artwork-end').value);
  const error = $('#topic-artwork-error');
  if (!files.length || !selected || !token) { error.textContent = '관리자 로그인 후 이미지 파일을 선택하세요.'; return; }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) { error.textContent = '시작·끝 연도를 올바르게 입력하세요.'; return; }
  const submit = topicArtworkForm.querySelector('[type="submit"]');
  submit.disabled = true;
  error.textContent = '이미지를 저장하는 중입니다…';
  try {
    for (const [index,file] of files.entries()) {
      error.textContent = files.length > 1 ? `이미지를 저장하는 중입니다… ${index+1}/${files.length}` : '이미지를 저장하는 중입니다…';
      const form = new FormData();
      form.append('topicId', selected.id);
      form.append('title', files.length > 1 ? inferredTopicArtworkTitle(file) : $('#topic-artwork-title').value.trim());
      form.append('startYear', String(startYear));
      form.append('endYear', String(endYear));
      form.append('image', file);
      const response = await fetch('/api/topic-artworks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '저장하지 못했습니다.');
      topics = result.topics || topics;
      selected = topics.find(topic => topic.id === selected.id) || selected;
    }
    pendingTopicArtworkFiles = [];
    topicArtworkDialog.close();
    renderList();
    render();
  } catch (uploadError) { error.textContent = uploadError.message; }
  finally { submit.disabled = false; }
};

fetch('data/topics.json').then(response => response.json()).then(data => { topics = data.topics || []; renderList(); });
