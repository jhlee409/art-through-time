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
const fallbackImage = 'data/thumbnails/_placeholder/artwork-placeholder.png';
const normalize = value => String(value || '').toLowerCase().replace(/[\s\-–—·,./()]/g, '');

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

function similarity(topic, query) {
  if (!query) return 1;
  const terms = [text(topic.name), ...(topic.keywords || [])].map(normalize).filter(Boolean);
  const compactQuery = normalize(query);
  const words = query.toLowerCase().split(/[\s\-–—·,./()]+/).filter(Boolean).map(normalize);
  return Math.max(...terms.map(term => {
    if (term.includes(compactQuery) || compactQuery.includes(term)) return 100;
    const wordScore = words.reduce((score, word) => score + (term.includes(word) ? 20 : 0), 0);
    return wordScore + Math.max(0, 14 - editDistance(compactQuery, term) * 3);
  }));
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
  $('#title').textContent = text(selected.name);
  $('#hint').textContent = selected.description?.ko || '';
  $('#axis').innerHTML = `<div class="topic-axis">${items.map(work => `
    <section class="topic-row">
      <div class="topic-axis-label"><strong>${esc(work.year)}</strong><span>${esc(work.movement)}</span></div>
      <article class="topic-card">
        <img src="${esc(work.thumbnail || fallbackImage)}" alt="${esc(work.title)}" onerror="this.onerror=null;this.src='${fallbackImage}'">
        <div class="topic-zoom-preview" aria-hidden="true"><img src="${esc(work.thumbnail || fallbackImage)}" alt=""></div>
        <strong>${esc(work.title)}</strong><small>${esc(work.artist)}</small>
        <button type="button" data-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 설명 보기"></button>
        ${adminToken() ? `<button class="topic-delete-artwork" type="button" data-delete-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 삭제" title="그림 삭제">×</button>` : ''}
        ${adminToken() ? `<button class="topic-replace-image" type="button" data-replace-work-id="${esc(work.id)}" aria-label="${esc(work.title)} 이미지 교체" title="이미지 교체">＋</button>` : ''}
      </article>
    </section>`).join('')}</div>`;
}

function renderList() {
  const query = $('#topic-search').value.trim();
  const visible = topics
    .map(topic => ({ topic, score: similarity(topic, query) }))
    .filter(item => !query || item.score >= 20)
    .sort((a, b) => query ? b.score - a.score : text(a.topic.name).localeCompare(text(b.topic.name), 'ko') * (listDirection === 'asc' ? 1 : -1));
  $('#topics').innerHTML = visible.length
    ? `${query ? '<p class="topic-candidates">유사한 후보</p>' : ''}${visible.map(({ topic }) => `<button data-id="${esc(topic.id)}">${esc(text(topic.name))}</button>`).join('')}`
    : '<p class="topic-candidates empty">유사한 주제·사건 후보가 없습니다.</p>';
  $('#sort-asc').classList.toggle('active', listDirection === 'asc');
  $('#sort-desc').classList.toggle('active', listDirection === 'desc');
  if (!selected && visible[0]) { selected = visible[0].topic; render(); }
}

$('#topics').onclick = event => {
  const topic = topics.find(item => item.id === event.target.dataset.id);
  if (topic) { selected = topic; render(); }
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
let pendingTopicArtworkFile = null;
let pendingReplaceWorkId = '';
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
  const file = topicArtworkPicker.files[0];
  if (!file) return;
  pendingTopicArtworkFile = file;
  $('#topic-artwork-error').textContent = '';
  topicArtworkForm.reset();
  $('#topic-artwork-file-name').textContent = `선택한 파일: ${file.name}`;
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
  const file = pendingTopicArtworkFile;
  const startYear = Number($('#topic-artwork-start').value);
  const endYear = Number($('#topic-artwork-end').value);
  const error = $('#topic-artwork-error');
  if (!file || !selected || !token) { error.textContent = '관리자 로그인 후 이미지 파일을 선택하세요.'; return; }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) { error.textContent = '시작·끝 연도를 올바르게 입력하세요.'; return; }
  const form = new FormData();
  form.append('topicId', selected.id);
  form.append('title', $('#topic-artwork-title').value.trim());
  form.append('startYear', String(startYear));
  form.append('endYear', String(endYear));
  form.append('image', file);
  const submit = topicArtworkForm.querySelector('[type="submit"]');
  submit.disabled = true;
  error.textContent = '이미지를 저장하는 중입니다…';
  try {
    const response = await fetch('/api/topic-artworks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '저장하지 못했습니다.');
    topics = result.topics || topics;
    selected = topics.find(topic => topic.id === selected.id) || selected;
    pendingTopicArtworkFile = null;
    topicArtworkDialog.close();
    renderList();
    render();
  } catch (uploadError) { error.textContent = uploadError.message; }
  finally { submit.disabled = false; }
};

fetch('data/topics.json').then(response => response.json()).then(data => { topics = data.topics || []; renderList(); });
