const fs = require('node:fs/promises');
const path = require('node:path');
const {normalizeArtistsPayload, validateArtistsPayload, firebaseExport} = require('../data-contract');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const artistsFile = path.join(dataDir, 'artists.json');
const rolesFile = path.join(dataDir, 'access-control.json');
const movementsFile = path.join(dataDir, 'art-movements.json');
const manifestFile = path.join(dataDir, 'migration-assets.json');
const exportFile = path.join(root, 'exports', 'firebase-import-latest.json');
const write = process.argv.includes('--write');

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function filesBelow(folder, type) {
  const entries = await fs.readdir(folder, {withFileTypes:true}).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const result = [];
  for (const entry of entries) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(absolute, type));
    else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      result.push({path:path.relative(root, absolute).replace(/\\/g, '/'), type, bytes:stat.size});
    }
  }
  return result;
}

async function assetManifest() {
  const assets = [
    ...await filesBelow(path.join(dataDir, 'images'), 'thumbnail'),
    ...await filesBelow(path.join(dataDir, '미술사조', 'images'), 'movement-image')
  ];
  return {schema:1, generatedAt:new Date().toISOString(), assets};
}

async function main() {
  const original = await readJson(artistsFile, {artists:[]});
  const normalized = normalizeArtistsPayload(original, {touch:write, actor:'migration-tool'});
  const validation = validateArtistsPayload(normalized);
  const manifest = await assetManifest();
  const roles = await readJson(rolesFile, {schema:1, roles:{}, defaultRole:'viewer'});
  const movements = await readJson(movementsFile, {countries:[]});
  const output = firebaseExport(normalized, movements, roles, manifest.assets, manifest.generatedAt);
  const report = {schema:1, checkedAt:manifest.generatedAt, validation, assetCount:manifest.assets.length};

  if (!validation.valid) throw new Error(`Validation failed:\n${validation.errors.join('\n')}`);
  if (write) {
    await fs.mkdir(path.dirname(exportFile), {recursive:true});
    await fs.writeFile(artistsFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await fs.writeFile(path.join(dataDir, 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(exportFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({write, ...report, exportFile:path.relative(root, exportFile).replace(/\\/g, '/')}, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
