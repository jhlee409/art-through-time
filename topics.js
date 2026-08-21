const $ = selector => document.querySelector(selector);
const text = value => value?.ko || value?.en || value || '';
const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

let topics = [];
let selected = null;
let listDirection = 'asc';
const sessionStorageKey = 'art-atlas-access-session-v1';
const adminToken = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionStorageKey) || 'null');
    return session?.role === 'admin' && session.token ? session.token : '';
  } catch (_) { return ''; }
};
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
  $('#title').textContent = text(selected.name);
  $('#hint').textContent = selected.description?.ko || '';
  $('#axis').innerHTML = `<div class="topic-axis">${items.map(work => `
    <section class="topic-row">
      <div class="topic-axis-label"><strong>${esc(work.year)}</strong><span>${esc(work.movement)}</span></div>
      <article class="topic-card">
        <img src="${esc(topicImage(work))}" alt="${esc(work.title)}" onerror="${esc(imageErrorHandler)}">
        <div class="topic-zoom-preview" aria-hidden="true"><img src="${esc(topicImage(work))}" alt="" onerror="${esc(imageErrorHandler)}"></div>
        <strong>${esc(work.title)}</strong><small>${esc(work.artist)}</small>
        <button type="button" data-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 설명 보기"></button>
        ${adminToken() ? `<button class="topic-delete-artwork" type="button" data-delete-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 삭제" title="그림 삭제">×</button>` : ''}
        ${adminToken() ? `<button class="topic-replace-image" type="button" data-replace-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 이미지 교체" title="이미지 교체">＋</button>` : ''}
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
  $('#sort-asc').classList.toggle('active', listDirection === 'asc');
  $('#sort-desc').classList.toggle('active', listDirection === 'desc');
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
  const button = event.target.closest('[data-work-id]');
  if (!button) return;
  const work = selected.works.find(item => item.id === button.dataset.workId);
  $('#detail').classList.add('show');
  $('#detail').innerHTML = `<button class="close-topic-detail" aria-label="닫기">×</button><h2>${esc(work.title)}</h2><p>${esc(work.artist)} · ${esc(work.year)}</p><p><b>${esc(work.movement)}</b></p><p>${esc(work.description)}</p>`;
};
$('#detail').onclick = event => { if (event.target.closest('.close-topic-detail')) $('#detail').classList.remove('show'); };
$('#topic-search').oninput = renderList;
$('#sort-asc').onclick = () => { listDirection = 'asc'; renderList(); };
$('#sort-desc').onclick = () => { listDirection = 'desc'; renderList(); };
$('#topic-logout').onclick = logoutTopicPage;

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
