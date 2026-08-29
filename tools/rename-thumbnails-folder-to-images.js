#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skippedDirectories = new Set(['.git', 'node_modules', 'logs', 'backups', 'delivery']);
const textExtensions = new Set([
  '.html', '.css', '.js', '.json', '.md', '.txt', '.svg',
  '.yml', '.yaml', '.env', '.example'
]);

function walk(directory, result = []) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) walk(path.join(directory, entry.name), result);
      continue;
    }
    if (textExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name === 'AGENTS.md') {
      result.push(path.join(directory, entry.name));
    }
  }
  return result;
}

function replaceReferences(source) {
  return source
    .replaceAll('data/images/', 'data/images/')
    .replaceAll('data\\\\images\\\\', 'data\\\\images\\\\')
    .replaceAll('data\\images\\', 'data\\images\\')
    .replaceAll('../images/', '../images/')
    .replaceAll('..\\\\images\\\\', '..\\\\images\\\\')
    .replaceAll('images/', 'images/')
    .replaceAll('images\\\\', 'images\\\\')
    .replaceAll("'images'", "'images'")
    .replaceAll('"images"', '"images"')
    .replaceAll('`images`', '`images`')
    .replaceAll('data, \'thumbnails\'', 'data, \'images\'')
    .replaceAll('dataDir, \'thumbnails\'', 'dataDir, \'images\'')
    .replaceAll('path.join(dataDir, \'thumbnails\')', 'path.join(dataDir, \'images\')');
}

function main() {
  const changed = [];
  for (const file of walk(root)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = replaceReferences(before);
    if (after === before) continue;
    fs.writeFileSync(file, after, 'utf8');
    changed.push(path.relative(root, file).replace(/\\/g, '/'));
  }
  console.log(JSON.stringify({changed: changed.length, files: changed}, null, 2));
}

main();
