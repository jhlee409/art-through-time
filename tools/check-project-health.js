#!/usr/bin/env node
/* Read-only project health check for local development and handoff. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {normalizeArtistsPayload, validateArtistsPayload} = require('../data-contract');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'delivery', 'logs']);
const imageDirectories = ['data/images', 'data/topic-images', 'data/미술사조/images', 'data/techniques'];
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
    return fs.existsSync(absolute) ? walk(absolute, name => /\.(?:jpe?g|jfif|png|webp|gif)$/i.test(name)) : [];
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
  const appModules = ['app/app-core.js', 'app/app-artists.js', 'app/app-atlas.js', 'app/app-detail.js', 'app/app.js'];
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

  return 'application module split';
}

function checkRemovedFeatureRemnants() {
  const obsoleteFiles = [
    'tools/consolidate-high-resolution-into-thumbnails.js',
    'tools/rename-thumbnails-folder-to-images.js'
  ];
  for (const file of obsoleteFiles) {
    if (fs.existsSync(path.join(root, file))) throw new Error(`obsolete migration tool still exists: ${file}`);
  }
  if (fs.existsSync(path.join(root, 'data', 'high-resolution'))) {
    throw new Error('obsolete data/high-resolution directory still exists');
  }

  const relationshipUpdates = fs.readdirSync(path.join(root, 'data'))
    .filter(name => /^relationship-updates-.*\.json$/i.test(name));
  if (relationshipUpdates.length) {
    throw new Error(`obsolete relationship-map data still exists: ${relationshipUpdates.join(', ')}`);
  }

  const removedRulesEndpoint = ['/api/rules', 'check-and-apply'].join('/');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  if (serverSource.includes(removedRulesEndpoint)) {
    throw new Error(`removed rules endpoint still exists: ${removedRulesEndpoint}`);
  }

  const interfaceSource = [
    'index.html', 'app/app-core.js', 'app/app-artists.js', 'app/app-atlas.js',
    'app/app-detail.js', 'app/app.js', 'styles.css', 'extras.css'
  ].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  for (const fragment of ['relationship-map', 'rule-check-button', 'rules-check-button']) {
    if (interfaceSource.includes(fragment)) throw new Error(`removed interface fragment still exists: ${fragment}`);
  }

  return 'removed feature remnants';
}

function checkArtistPersistenceGuards() {
  const appSource = fs.readFileSync(path.join(root, 'app', 'app-core.js'), 'utf8');
  const loadStart = appSource.indexOf('async function loadData()');
  const loadEnd = appSource.indexOf('async function markLegacyManualWorks()', loadStart);
  if (loadStart < 0 || loadEnd < 0) throw new Error('Could not inspect the loadData persistence boundary');
  if (/\b(?:await\s+)?saveArtistsNow\s*\(/.test(appSource.slice(loadStart, loadEnd))) throw new Error('loadData must not persist artist files during a page visit');

  const preserved = normalizeArtistsPayload({
    metadata:{createdAt:'2026-01-01T00:00:00.000Z',representativeContentSchema:1},
    artists:[]
  }, {touch:false});
  if (preserved.metadata.representativeContentSchema !== 1) throw new Error('artist normalization discards custom collection metadata');
  if (!appSource.includes('const movementNameParts =') || !appSource.includes('function movementNamesMatch(left,right)') || !appSource.includes('return movementNamesMatch(work?.movement,artist?.movement);')) throw new Error('movement contribution matching must compare normalized localized movement names');
  if (!appSource.includes("work?.movementContributionReason !== 'artist-movement-characteristic'")) throw new Error('curated movement contributions must take precedence over automatic scoring');
  const serverDataSource = fs.readFileSync(path.join(root, 'server-data.js'), 'utf8');
  if (!serverDataSource.includes('previousWorks.size !== currentWorks.length')) throw new Error('artist metadata must be touched when a work is deleted');
  const consolidationSource = fs.readFileSync(path.join(root, 'tools', 'consolidate-generated-artists.js'), 'utf8');
  for (const [file, source] of [['app/app-core.js', appSource], ['server-data.js', serverDataSource], ['tools/consolidate-generated-artists.js', consolidationSource]]) {
    if (!source.includes('hasLocalArtworkAsset')) throw new Error(`${file} must preserve works with local artwork assets beyond the imported-work limit`);
  }
  if (!consolidationSource.includes('!isGeneratedWork(work) || hasLocalArtworkAsset(work)')) throw new Error('artist consolidation must retain locally materialized generated works before merging');
  return 'artist persistence guards';
}

function main() {
  const javascript = walk(root, name => name.endsWith('.js'));
  const jsonFiles = walk(path.join(root, 'data'), name => name.endsWith('.json'));
  const checked = [];

  for (const file of javascript) checked.push(checkCommand(`syntax ${relative(file)}`, process.execPath, ['--check', file]));
  for (const file of jsonFiles) JSON.parse(fs.readFileSync(file, 'utf8'));
  checked.push(checkApplicationModuleSplit());
  checked.push(checkRemovedFeatureRemnants());
  checked.push(checkArtistPersistenceGuards());

  const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8'));
  const artistIndex = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists-index.json'), 'utf8'));
  if ((artistIndex.artists || []).length !== (artists.artists || []).length) throw new Error('artists-index.json artist count differs from artists.json');
  if ((artistIndex.artists || []).some(artist => Array.isArray(artist.works) || artist._detailLoaded !== false)) throw new Error('artists-index.json must not contain works');
  const validation = validateArtistsPayload(normalizeArtistsPayload(artists));
  if (!validation.valid) throw new Error(`artists data contract failed:\n${validation.errors.join('\n')}`);

  const movementIndex = JSON.parse(fs.readFileSync(path.join(root, 'data', '미술사조', 'index.json'), 'utf8'));
  const movementCanonical = JSON.parse(fs.readFileSync(path.join(root, 'data', 'art-movement-canonical.json'), 'utf8'));
  const activeMovementDocuments = Object.keys(movementIndex.documents || {}).length;
  const targetMovementDocuments = movementCanonical.counts.documentParents + movementCanonical.counts.contextReferences;
  const movementRebuildInProgress = activeMovementDocuments < targetMovementDocuments;
  checked.push(`movement documents ${movementRebuildInProgress ? 'rebuild transition' : 'complete'} (${activeMovementDocuments}/${targetMovementDocuments})`);

  const movementCompletionChecks = [
    ['movement HTML v1 migration', 'tools/validate-movement-documents-v1.js'],
    ['movement ID sync runtime', 'tools/validate-movement-sync-v1-runtime.js'],
    ['movement phase 6 completion', 'tools/complete-movement-sync-v1.js'],
    ['movement learning guides', 'tools/sync-movement-learning-guides.js', '--check']
  ];
  const healthChecks = [
    ['movement links', 'tools/validate-movement-links.js'],
    ['movement canonical taxonomy', 'tools/validate-movement-canonical.js'],
    ['movement sync contract', 'tools/validate-movement-sync-contract.js'],
    ['movement representatives', 'tools/validate-movement-representatives.js'],
    ['cross-tab linkage', 'tools/validate-cross-tab-linkage.js'],
    ...(!movementRebuildInProgress ? movementCompletionChecks : []),
    ['movement image paths', 'tools/validate-movement-image-paths.js'],
    ['country art data', 'tools/validate-country-art-data.js'],
    ['project linkage', 'tools/validate-project-linkage.js'],
    ['legacy artwork image paths', 'tools/migrate-legacy-artwork-images.js'],
    ['movement image cache index', 'tools/prune-movement-image-index.js'],
    ['image catalog', 'tools/build-image-catalog.js', '--check'],
    ['URL download approval guard', 'tools/check-url-download-approval.js']
  ];
  healthChecks.forEach(([label, script, ...args]) => checked.push(checkCommand(label, process.execPath, [script,...args])));

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
