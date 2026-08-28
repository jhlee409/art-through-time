#!/usr/bin/env node
/* Read-only project health check for local development and handoff. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {normalizeArtistsPayload, validateArtistsPayload} = require('../data-contract');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'delivery', 'logs']);
const imageDirectories = ['data/thumbnails', 'data/high-resolution', 'data/topic-images', 'data/미술사조/images', 'data/techniques'];
const oversizedImageLimit = 10 * 1024 * 1024;

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

function summarizeOversizedImages() {
  const files = imageDirectories.flatMap(directory => {
    const absolute = path.join(root, directory);
    return fs.existsSync(absolute) ? walk(absolute, name => /\.(?:jpe?g|png|webp|gif)$/i.test(name)) : [];
  });
  const inspected = files.map(file => {
    try {
      return {file, size: fs.statSync(file).size, accessible: true};
    } catch (error) {
      return {file, size: 0, accessible: false, error: error.code || error.message};
    }
  });
  const oversized = inspected
    .filter(item => item.size > oversizedImageLimit)
    .sort((left, right) => right.size - left.size);
  return {
    count: oversized.length,
    inaccessible: inspected.filter(item => !item.accessible).length,
    limitMB: Math.round(oversizedImageLimit / 1024 / 1024),
    examples: oversized.slice(0, 10).map(item => ({
      file: relative(item.file),
      mb: Number((item.size / 1024 / 1024).toFixed(2))
    }))
  };
}

function checkApplicationModuleSplit() {
  const appModules = ['app-core.js', 'app-artists.js', 'app-atlas.js', 'app-detail.js', 'app.js'];
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  let previousPosition = -1;
  for (const file of appModules) {
    const position = indexHtml.indexOf(`src="${file}"`);
    if (position < 0) throw new Error(`index.html is missing application module: ${file}`);
    if (position <= previousPosition) throw new Error(`index.html application module order is invalid: ${file}`);
    previousPosition = position;
  }

  const contentSource = fs.readFileSync(path.join(root, 'server-content.js'), 'utf8');
  for (const file of appModules) {
    if (!contentSource.includes(`'${file}'`)) throw new Error(`server-content.js does not allow public application module: ${file}`);
  }

  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  if (!serverSource.includes('readAppSourceText()')) throw new Error('server rule checks do not read split application sources');
  for (const file of appModules) {
    if (!serverSource.includes(`'${file}'`)) throw new Error(`server rule checks do not include application module: ${file}`);
  }
  return 'application module split';
}

function main() {
  const javascript = walk(root, name => name.endsWith('.js'));
  const jsonFiles = walk(path.join(root, 'data'), name => name.endsWith('.json'));
  const checked = [];

  for (const file of javascript) checked.push(checkCommand(`syntax ${relative(file)}`, process.execPath, ['--check', file]));
  for (const file of jsonFiles) JSON.parse(fs.readFileSync(file, 'utf8'));
  checked.push(checkApplicationModuleSplit());

  const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8'));
  const artistIndex = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists-index.json'), 'utf8'));
  if ((artistIndex.artists || []).length !== (artists.artists || []).length) throw new Error('artists-index.json artist count differs from artists.json');
  if ((artistIndex.artists || []).some(artist => Array.isArray(artist.works) || artist._detailLoaded !== false)) throw new Error('artists-index.json must not contain works');
  const validation = validateArtistsPayload(normalizeArtistsPayload(artists));
  if (!validation.valid) throw new Error(`artists data contract failed:\n${validation.errors.join('\n')}`);

  [
    ['movement links', 'tools/validate-movement-links.js'],
    ['movement canonical taxonomy', 'tools/validate-movement-canonical.js'],
    ['movement sync contract', 'tools/validate-movement-sync-contract.js'],
    ['movement HTML v1 migration', 'tools/validate-movement-documents-v1.js'],
    ['movement representative content', 'tools/validate-movement-representatives.js'],
    ['movement ID sync runtime', 'tools/validate-movement-sync-v1-runtime.js'],
    ['movement phase 6 completion', 'tools/complete-movement-sync-v1.js'],
    ['country art data', 'tools/validate-country-art-data.js'],
    ['Renaissance country table', 'tools/verify-renaissance-country-table.js'],
    ['URL download approval guard', 'tools/check-url-download-approval.js']
  ].forEach(([label, script]) => checked.push(checkCommand(label, process.execPath, [script])));

  const env = fs.existsSync(path.join(root, '.env')) && /ART_ATLAS_ADMIN_PASSWORD\s*=\s*\S+/.test(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const oversizedImages = summarizeOversizedImages();
  console.log(JSON.stringify({
    ok: true,
    javascriptFiles: javascript.length,
    jsonFiles: jsonFiles.length,
    administratorConfigured: env,
    artistStats: validation.stats,
    sourceWarnings: validation.warnings.length,
    oversizedImages,
    checks: checked.length
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
