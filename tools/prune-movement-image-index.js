#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementRoot = path.join(root, 'data', '미술사조');
const indexFile = path.join(movementRoot, 'images', 'index.json');
const apply = process.argv.includes('--apply');
const payload = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const stale = [];

for (const [source, item] of Object.entries(payload.images || {})) {
  const local = String(item?.local || '').replace(/\\/g, '/');
  const file = path.resolve(movementRoot, local);
  if (local && file.startsWith(`${movementRoot}${path.sep}`) && fs.existsSync(file)) continue;
  stale.push({source, local});
  if (apply) delete payload.images[source];
}

if (apply && stale.length) fs.writeFileSync(indexFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  ok: apply || stale.length === 0,
  mode: apply ? 'apply' : 'check',
  entries: Object.keys(payload.images || {}).length,
  staleEntries: stale.length
}, null, 2));
if (!apply && stale.length) {
  console.error(stale.map(item => `${item.local || '(empty)'} <- ${item.source}`).join('\n'));
  process.exitCode = 1;
}
