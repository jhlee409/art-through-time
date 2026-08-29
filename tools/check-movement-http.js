#!/usr/bin/env node
const canonical = require('../data/art-movement-canonical.json');
const representatives = require('../data/art-movement-representatives.json');
const index = require('../data/미술사조/index.json');

const origin = process.argv[2] || 'http://127.0.0.1:4173';
const furtherArtistCount = new Map((representatives.furtherArtists || []).map(entry => [entry.categoryId, (entry.artists || []).length]));
const cardCount = categoryIds => categoryIds.reduce((sum, categoryId) => sum + 1 + (furtherArtistCount.get(categoryId) || 0), 0);
const documents = [
  ...canonical.parents.filter(parent => parent.role === 'document').map(parent => ({
    key: parent.documentKey,
    state: 'complete',
    cards: cardCount(parent.categoryIds)
  })),
  ...canonical.contextReferences.map(context => ({key: context.documentKey, state: 'structure', cards: null}))
];

Promise.all(documents.map(async document => {
  const relative = index.documents[document.key]['1'];
  const response = await fetch(`${origin}/${encodeURI(relative)}`);
  const html = await response.text();
  const state = /data-art-atlas-sync-state=["']([^"']+)/i.exec(html)?.[1] || '';
  const cards = (html.match(/<article\b[^>]*class=["'][^"']*movement-work-card/gi) || []).length;
  const guideVersion = /<html\b[^>]*data-art-atlas-learning-guide-version=["']([^"']+)/i.exec(html)?.[1] || '';
  const guide = /<section\b[^>]*id=["']movement-learning-guide["'][^>]*>[\s\S]*?<\/section>/i.exec(html)?.[0] || '';
  const guideCategories = (guide.match(/class=["']movement-learning-guide-categories["']/gi) || []).length;
  const expectedGuideCategories = document.cards === null ? 0 : 1;
  const responsiveGuide = /@media\(max-width:720px\)[^{]*\{[^}]*movement-learning-guide-grid\{grid-template-columns:1fr\}/i.test(html);
  if (!response.ok || state !== document.state || (document.cards !== null && cards !== document.cards) || guideVersion !== '1' || !guide.includes('data/art-movement-learning-guides.json') || guideCategories !== expectedGuideCategories || !responsiveGuide) {
    throw new Error(`${document.key}: status=${response.status}, state=${state}, cards=${cards}/${document.cards}, guide=${guideVersion}, guideCategories=${guideCategories}/${expectedGuideCategories}, responsive=${responsiveGuide}`);
  }
  return relative;
})).then(results => {
  console.log(JSON.stringify({ok: true, documents: results.length, origin}, null, 2));
}).catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
