#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementIndex = require('../data/미술사조/index.json');
const documentPaths = [...new Set(Object.values(movementIndex.documents || {}).flatMap(document => Object.values(document || {})))];
const issues = [];
const referenced = new Set();

function attr(tag, name) {
  return new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(value => value !== undefined) || '';
}

for (const documentPath of documentPaths) {
  const documentFile = path.join(root, documentPath);
  const html = fs.readFileSync(documentFile, 'utf8');
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    for (const attribute of ['src', 'data-art-atlas-highres']) {
      const value = attr(match[0], attribute);
      if (!value) continue;
      if (/^(?:data:|https?:)?\/\//i.test(value)) {
        issues.push(`${documentPath}: ${attribute} must use a local image (${value})`);
        continue;
      }
      const file = value.startsWith('/') ? path.join(root, value.slice(1)) : path.resolve(path.dirname(documentFile), value);
      const localPath = path.relative(root, file).replace(/\\/g, '/');
      referenced.add(localPath);
      if (!fs.existsSync(file)) issues.push(`${documentPath}: missing ${attribute} image (${value})`);
    }
  }
}

console.log(JSON.stringify({
  ok: issues.length === 0,
  documents: documentPaths.length,
  images: referenced.size,
  issues: issues.length
}, null, 2));
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
}
