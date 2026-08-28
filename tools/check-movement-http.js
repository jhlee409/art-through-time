#!/usr/bin/env node
const canonical = require('../data/art-movement-canonical.json');
const index = require('../data/미술사조/index.json');

const origin = process.argv[2] || 'http://127.0.0.1:4173';
const documents = [
  ...canonical.parents.filter(parent => parent.role === 'document').map(parent => ({
    key: parent.documentKey,
    state: 'complete',
    cards: parent.categoryIds.length
  })),
  ...canonical.contextReferences.map(context => ({key: context.documentKey, state: 'structure', cards: null}))
];

Promise.all(documents.map(async document => {
  const relative = index.documents[document.key]['1'];
  const response = await fetch(`${origin}/${encodeURI(relative)}`);
  const html = await response.text();
  const state = /data-art-atlas-sync-state=["']([^"']+)/i.exec(html)?.[1] || '';
  const cards = (html.match(/<article\b[^>]*class=["'][^"']*movement-work-card/gi) || []).length;
  if (!response.ok || state !== document.state || (document.cards !== null && cards !== document.cards)) {
    throw new Error(`${document.key}: status=${response.status}, state=${state}, cards=${cards}/${document.cards}`);
  }
  return relative;
})).then(results => {
  console.log(JSON.stringify({ok: true, documents: results.length, origin}, null, 2));
}).catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
