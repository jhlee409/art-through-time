#!/usr/bin/env node
const artists = require('../data/artists.json');
const catalog = require('../data/image-catalog.json');
const movementIndex = require('../data/미술사조/index.json');

const origin = String(process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');

async function response(pathname) {
  const result = await fetch(`${origin}${pathname}`);
  if (!result.ok) throw new Error(`${pathname}: HTTP ${result.status}`);
  return result;
}

async function json(pathname) {
  return response(pathname).then(result => result.json());
}

async function main() {
  const entryPaths = ['/', '/?artistList=1', '/?countryArt=1', `/?artist=${encodeURIComponent(artists.artists[0].id)}`];
  for (const pathname of entryPaths) {
    const html = await response(pathname).then(result => result.text());
    if (!html.includes('app/app-core.js') || !html.includes('app/app-artists.js') || !html.includes('app/app-atlas.js') || !html.includes('app/app-detail.js')) {
      throw new Error(`${pathname}: application scripts are missing`);
    }
  }

  const staticData = [
    '/data/art-taxonomy.json',
    '/data/art-movement-canonical.json',
    '/data/art-movements.json',
    '/data/country-art-events.json',
    '/data/country-movement-backgrounds.json',
    '/data/featured-works.json'
  ];
  await Promise.all(staticData.map(json));
  await response('/extras.css');

  const full = await json('/api/artists');
  const index = await json('/api/artists-index');
  const movements = await json('/api/movement-documents');
  if ((full.artists || []).length !== artists.artists.length) throw new Error('/api/artists count mismatch');
  if ((index.artists || []).length !== artists.artists.length) throw new Error('/api/artists-index count mismatch');
  if ((index.artists || []).some(artist => Array.isArray(artist.works))) throw new Error('/api/artists-index includes work arrays');
  if (Object.keys(movements.documents || {}).length !== Object.keys(movementIndex.documents || {}).length) throw new Error('/api/movement-documents count mismatch');

  const movementDocumentPaths = [...new Set(Object.values(movements.documents || {}).flatMap(document => Object.values(document || {})))];
  const movementImagePaths = new Set();
  for (const documentPath of movementDocumentPaths) {
    const pathname = `/${String(documentPath).split('/').map(encodeURIComponent).join('/')}`;
    const html = await response(pathname).then(result => result.text());
    for (const imageTag of html.matchAll(/<img\b[^>]*>/gi)) {
      for (const match of imageTag[0].matchAll(/\b(?:src|data-art-atlas-highres)=(?:"([^"]+)"|'([^']+)')/gi)) {
        const source = match[1] || match[2] || '';
        if (!source || source.startsWith('#')) continue;
        if (/^(?:data:|https?:)?\/\//i.test(source)) throw new Error(`${documentPath}: external or inline image source (${source})`);
        const imageUrl = new URL(source, `${origin}${pathname}`);
        if (imageUrl.origin !== origin) throw new Error(`${documentPath}: image source leaves the local origin (${source})`);
        movementImagePaths.add(imageUrl.pathname);
      }
    }
  }
  for (const pathname of movementImagePaths) {
    const result = await response(pathname);
    if (!String(result.headers.get('content-type') || '').startsWith('image/')) {
      throw new Error(`${pathname}: movement asset is not served as an image`);
    }
    await result.body?.cancel();
  }

  const removedRulesEndpoint = ['/api/rules', 'check-and-apply'].join('/');
  const removedRulesResponse = await fetch(`${origin}${removedRulesEndpoint}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{}'
  });
  if (![403, 404].includes(removedRulesResponse.status)) {
    throw new Error(`${removedRulesEndpoint}: expected HTTP 403 or 404, received ${removedRulesResponse.status}`);
  }

  const artistSampleIndexes = [...new Set(Array.from({length:12}, (_, index) => Math.round(index * (artists.artists.length - 1) / 11)))];
  const detailChecks = await Promise.all(artistSampleIndexes.map(async index => {
    const artist = artists.artists[index];
    const payload = await json(`/api/artists/${encodeURIComponent(artist.id)}`);
    if (payload.artist?.id !== artist.id) throw new Error(`${artist.id}: detail API ID mismatch`);
    if ((payload.artist.works || []).length !== (artist.works || []).length) throw new Error(`${artist.id}: detail API work count mismatch`);
    return 1;
  }));

  const images = catalog.images || [];
  const sampleIndexes = [...new Set([0, 1, Math.floor(images.length / 4), Math.floor(images.length / 2), Math.floor(images.length * 3 / 4), images.length - 2, images.length - 1])]
    .filter(index => index >= 0 && index < images.length);
  for (const index of sampleIndexes) {
    const item = images[index];
    const result = await response(`/${item.path.split('/').map(encodeURIComponent).join('/')}`);
    const bytes = (await result.arrayBuffer()).byteLength;
    if (!String(result.headers.get('content-type') || '').startsWith('image/') || bytes !== item.bytes) {
      throw new Error(`${item.path}: served image metadata mismatch`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    origin,
    entryPages: entryPaths.length,
    staticDataFiles: staticData.length,
    sampledArtistDetails: detailChecks.length,
    movementDocuments: Object.keys(movements.documents || {}).length,
    movementDocumentFiles: movementDocumentPaths.length,
    movementImages: movementImagePaths.size,
    removedEndpoints: 1,
    sampledImages: sampleIndexes.length
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
