#!/usr/bin/env node
/* Read-only project health check for local development and handoff. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {normalizeArtistsPayload, validateArtistsPayload} = require('../data-contract');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'delivery', 'logs']);

function walk(directory, predicate, result = []) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(path.join(directory, entry.name), predicate, result);
    } else if (predicate(entry.name)) {
      result.push(path.join(directory, entry.name));
    }
  }
  return result;
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function checkCommand(label, command, args) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${label} failed${detail ? `:\n${detail}` : ''}`);
  }
  return label;
}

function main() {
  const javascript = walk(root, name => name.endsWith('.js'));
  const jsonFiles = walk(path.join(root, 'data'), name => name.endsWith('.json'));
  const checked = [];

  for (const file of javascript) checked.push(checkCommand(`syntax ${relative(file)}`, process.execPath, ['--check', file]));
  for (const file of jsonFiles) JSON.parse(fs.readFileSync(file, 'utf8'));

  const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8'));
  const validation = validateArtistsPayload(normalizeArtistsPayload(artists));
  if (!validation.valid) throw new Error(`artists data contract failed:\n${validation.errors.join('\n')}`);

  [
    ['movement links', 'tools/validate-movement-links.js'],
    ['country art data', 'tools/validate-country-art-data.js'],
    ['Renaissance country table', 'tools/verify-renaissance-country-table.js'],
    ['URL download approval guard', 'tools/check-url-download-approval.js']
  ].forEach(([label, script]) => checked.push(checkCommand(label, process.execPath, [script])));

  const env = fs.existsSync(path.join(root, '.env')) && /ART_ATLAS_ADMIN_PASSWORD\s*=\s*\S+/.test(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  console.log(JSON.stringify({
    ok: true,
    javascriptFiles: javascript.length,
    jsonFiles: jsonFiles.length,
    administratorConfigured: env,
    artistStats: validation.stats,
    sourceWarnings: validation.warnings.length,
    checks: checked.length
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
