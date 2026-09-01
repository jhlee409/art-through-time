#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = require('../data/art-movement-canonical.json');
const guides = require('../data/art-movement-learning-guides.json');
const representatives = require('../data/art-movement-representatives.json');
const learningMap = require('../data/art-movement-learning-map.json');
const index = require('../data/미술사조/index.json');
const args = new Set(process.argv.slice(2));
const documentArg = [...args].find(arg => arg.startsWith('--document='));
const onlyDocumentId = documentArg ? documentArg.slice('--document='.length).trim() : '';

const style = `<style id="art-atlas-learning-guide-style">
#movement-learning-guide{padding:38px 0;border-top:1px solid var(--line,#d8d4cc);border-bottom:1px solid var(--line,#d8d4cc);background:var(--panel,#f7f7f5)}
#movement-learning-guide .movement-learning-guide-inner{width:100%;max-width:none;margin:0;padding-left:var(--art-atlas-document-gutter,clamp(20px,3vw,48px));padding-right:var(--art-atlas-document-gutter,clamp(20px,3vw,48px))}
#movement-learning-guide .movement-learning-guide-kicker{margin:0 0 .35rem;color:var(--accent,#8a641e);font-weight:800}
#movement-learning-guide h2{margin:.1rem 0 1.15rem;font-size:clamp(1.9rem,3.4vw,3.1rem);line-height:1.18}
#movement-learning-guide .movement-learning-guide-orientation{max-width:none;margin:0 0 1.5rem;font-size:1.08rem;line-height:1.8}
#movement-learning-guide .movement-learning-guide-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px 34px}
#movement-learning-guide .movement-learning-guide-block{padding-top:14px;border-top:2px solid var(--line,#d8d4cc)}
#movement-learning-guide .movement-learning-guide-block h3{margin:0 0 .65rem;font-size:clamp(1.3rem,2.25vw,1.75rem);line-height:1.32}
#movement-learning-guide .movement-learning-guide-block ul,#movement-learning-guide .movement-learning-guide-block ol{margin:0;padding-left:1.35rem}
#movement-learning-guide .movement-learning-guide-block li{margin:.42rem 0}
#movement-learning-guide .movement-learning-guide-categories li>strong{display:block;color:var(--accent,#8a641e)}
#movement-learning-guide .movement-learning-guide-categories li>span{display:block;margin-top:.12rem;word-break:keep-all;overflow-wrap:break-word}
#movement-learning-guide .movement-learning-guide-boundary{grid-column:1/-1}
#movement-learning-guide .movement-learning-guide-boundary p{max-width:none;margin:.45rem 0}
#movement-learning-guide .movement-learning-guide-source{margin:1.15rem 0 0;font-size:.9rem;color:var(--muted,#666)}
#movement-learning-guide .movement-learning-guide-source a{color:inherit}
@media(max-width:720px){#movement-learning-guide .movement-learning-guide-grid{grid-template-columns:1fr}#movement-learning-guide .movement-learning-guide-boundary{grid-column:auto}}
</style>`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
}

function documentLevelLabel(parent, isContext) {
  if (isContext) return '1400년 이전 미술 참고';
  return ({detailed:'상세 학습',bridge:'연결 학습',reference:'참고 학습'})[parent.documentLevel] || '핵심 학습';
}

function renderCategories(parent) {
  const learningMovement = learningMap.movements?.[parent.id];
  if (learningMovement?.nodes?.length) {
    const roleLabels = { anchor: '기준점', variation: '주요 변주', comparison: '비교 축' };
    const nodes = learningMovement.nodes.map(node => `<li><strong>${esc(node.label?.ko || node.id)} <small>(${roleLabels[node.role] || '학습 항목'})</small></strong><span>${esc(node.feature || '')}</span></li>`);
    const comparisons = (learningMovement.comparisonAxes || []).map(axis => `<li><strong>${esc(axis.label?.ko || axis.id)} <small>(${roleLabels[axis.role] || '비교 축'})</small></strong><span>${esc(axis.description || '')}</span></li>`);
    const comparisonBlock = comparisons.length
      ? `<div class="movement-learning-guide-block"><h3>함께 비교할 사례</h3><ul class="movement-learning-guide-categories">${comparisons.join('')}</ul></div>`
      : '';
    return `<div class="movement-learning-guide-block"><h3>조형 기준점과 주요 변주</h3><ul class="movement-learning-guide-categories">${nodes.join('')}</ul></div>${comparisonBlock}`;
  }
  const representativeMap = new Map(representatives.categories.map(entry => [entry.categoryId, entry]));
  const categories = (parent.categoryIds || []).map(categoryId => {
    const category = canonical.categories.find(item => item.id === categoryId);
    const representative = representativeMap.get(categoryId);
    assert(category && representative, `${parent.id}: category guide source is missing (${categoryId})`);
    return `<li><strong>${esc(category.name.ko)}</strong><span>${esc(representative.feature)}</span></li>`;
  });
  if (!categories.length) return '';
  return `<div class="movement-learning-guide-block"><h3>핵심 범주 비교</h3><ul class="movement-learning-guide-categories">${categories.join('')}</ul></div>`;
}

function renderGuide(id, parent, guide, isContext) {
  const hasLearningMap = Boolean(learningMap.movements?.[parent.id]?.nodes?.length);
  const learningMapGuideStyle = hasLearningMap
    ? '<style>.movement-learning-guide-grid{grid-template-columns:minmax(0,1fr)!important}</style>'
    : '';
  const source = guide.source
    ? `<p class="movement-learning-guide-source">학술 참고: <a href="${esc(guide.source.url)}" target="_blank" rel="noopener">${esc(guide.source.label)}</a></p>`
    : '';
  return `<section id="movement-learning-guide" data-art-atlas-learning-guide-version="1" data-art-atlas-content-source="data/art-movement-learning-guides.json"${hasLearningMap ? ' data-art-atlas-learning-map-guide="true"' : ''}>
${learningMapGuideStyle}<div class="movement-learning-guide-inner">
<p class="movement-learning-guide-kicker">${esc(documentLevelLabel(parent,isContext))}</p>
<h2>초심자 학습 길잡이</h2>
<p class="movement-learning-guide-orientation">${esc(guide.orientation)}</p>
<div class="movement-learning-guide-grid">
<div class="movement-learning-guide-block"><h3>작품에서 볼 것</h3><ol>${guide.visualKeys.map(item => `<li>${esc(item)}</li>`).join('')}</ol></div>
${renderCategories(parent)}
<div class="movement-learning-guide-block movement-learning-guide-boundary"><h3>인접 사조와 구분</h3><p>${esc(guide.distinction)}</p><p><strong>흔한 오해:</strong> ${esc(guide.misconception)}</p></div>
</div>${source}
</div>
</section>`;
}

function setRootVersion(html) {
  return html.replace(/<html\b[^>]*>/i, tag => {
    if (/\bdata-art-atlas-learning-guide-version=/i.test(tag)) {
      return tag.replace(/\bdata-art-atlas-learning-guide-version=("[^"]*"|'[^']*')/i, 'data-art-atlas-learning-guide-version="1"');
    }
    return tag.replace(/>$/, ' data-art-atlas-learning-guide-version="1">');
  });
}

function synchronizeDocument(documentId, parent, relative, isContext=false) {
  const file = path.join(root, relative);
  const guide = guides.documents[documentId];
  assert(guide, `${documentId}: learning guide is missing`);
  assert(Array.isArray(guide.visualKeys) && guide.visualKeys.length === 3, `${documentId}: exactly three visual keys are required`);
  assert(guide.orientation && guide.distinction && guide.misconception, `${documentId}: guide text is incomplete`);
  assert(guide.orientation.length >= 90, `${documentId}: orientation is too short for a beginner guide`);
  guide.visualKeys.forEach((item,index) => assert(item.length >= 30, `${documentId}: visual key ${index + 1} is too short`));
  assert(guide.distinction.length >= 60 && guide.misconception.length >= 60, `${documentId}: distinction or misconception guidance is too short`);
  if (guide.source) assert(/^https:\/\//.test(guide.source.url) && guide.source.label, `${documentId}: source must use a labeled HTTPS URL`);
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  html = html.replace(/<style id="art-atlas-learning-guide-style">[\s\S]*?<\/style>\s*/i, '');
  html = html.replace(/<section\b[^>]*id="movement-learning-guide"[^>]*>[\s\S]*?<\/section>\s*/i, '');
  assert(/<\/head>/i.test(html) && /<main\b[^>]*>/i.test(html), `${documentId}: head or main element is missing`);
  html = html.replace(/<\/head>/i, `${style}</head>`);
  html = html.replace(/<main\b[^>]*>/i, tag => `${tag}\n${renderGuide(documentId,parent,guide,isContext)}\n`);
  html = setRootVersion(html);
  const normalizeForComparison = value => value
    .replace(/<a\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-artist-link\b)[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/\r\n/g, '\n');
  if (normalizeForComparison(html) === normalizeForComparison(original)) return false;
  if (!args.has('--check') && !args.has('--dry-run')) fs.writeFileSync(file, html, 'utf8');
  return true;
}

function main() {
  const registeredParents = canonical.parents.filter(parent => parent.role === 'document' && index.documents?.[parent.documentKey]?.['1']);
  const registeredContexts = canonical.contextReferences.filter(context => index.documents?.[context.documentKey]?.['1']);
  const registeredIds = [
    ...registeredParents.map(parent => parent.id),
    ...registeredContexts.map(context => context.id)
  ];
  const guideIds = Object.keys(guides.documents);
  assert(registeredIds.every(id => guideIds.includes(id)), 'Every registered movement document must have a learning guide');
  if (onlyDocumentId) assert(registeredIds.includes(onlyDocumentId), `Unknown or inactive learning guide document: ${onlyDocumentId}`);
  const changed = [];
  registeredParents.filter(parent => !onlyDocumentId || parent.id === onlyDocumentId).forEach(parent => {
    const relative = index.documents?.[parent.documentKey]?.['1'];
    assert(relative, `${parent.id}: indexed document is missing`);
    if (synchronizeDocument(parent.id,parent,relative)) changed.push(parent.id);
  });
  registeredContexts.filter(context => !onlyDocumentId || context.id === onlyDocumentId).forEach(context => {
    const relative = index.documents?.[context.documentKey]?.['1'];
    assert(relative, `${context.id}: indexed document is missing`);
    if (synchronizeDocument(context.id,{...context,categoryIds:[]},relative,true)) changed.push(context.id);
  });
  if (args.has('--check') && changed.length) throw new Error(`Learning guides are out of sync: ${changed.join(', ')}`);
  console.log(JSON.stringify({documents: onlyDocumentId ? 1 : registeredIds.length, changed: changed.length, mode: args.has('--check') ? 'check' : (args.has('--dry-run') ? 'dry-run' : 'write')}, null, 2));
}

main();
