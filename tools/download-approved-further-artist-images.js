#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {existingLocalPathForWork, resolveExistingLocalImagePath, canonicalArtworkPath} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const manifestFile = path.join(root, 'data', 'further-artist-image-download-manifest.json');
const curatedFile = path.join(root, 'data', 'approved-further-artist-image-sources.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const maxBytes = 15 * 1024 * 1024;

requireUrlFileDownloadApproval({
  purpose:'Download only reviewed further-artist representative images listed in the approved manifest.',
  url:'https://upload.wikimedia.org/'
});

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const curated = JSON.parse(fs.readFileSync(curatedFile, 'utf8'));
  const representatives = JSON.parse(fs.readFileSync(representativesFile, 'utf8'));
  const workMap = new Map(representatives.furtherArtists.flatMap(category => category.artists.map(item => [`${item.artist.id}|${item.work.id}`, item.work])));
  const manifestApproved = manifest.items.filter(item => item.reviewStatus === 'candidate' && item.selected && !item.selected.derivative);
  const curatedApproved = curated.items.filter(item => item.reviewStatus !== 'downloaded').map(item => ({
    ...item,
    reviewStatus:'candidate',
    selected:{
      fileTitle:item.fileTitle,
      pageUrl:item.pageUrl,
      downloadUrl:item.downloadUrl || `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(item.fileTitle)}?width=1400`,
      license:item.license,
      derivative:false
    }
  }));
  const approved = [...new Map([...manifestApproved, ...curatedApproved].map(item => [`${item.artistId}|${item.workId}`, item])).values()];
  const results = [];
  const errors = [];
  const persist = () => {
    manifest.counts = {
      pending:manifest.items.length,
      downloaded:manifest.items.filter(item => item.reviewStatus === 'downloaded').length,
      candidates:manifest.items.filter(item => item.reviewStatus === 'candidate').length,
      unresolved:manifest.items.filter(item => item.reviewStatus === 'unresolved').length
    };
    writeJson(representativesFile, representatives);
    writeJson(manifestFile, manifest);
    writeJson(curatedFile, curated);
  };
  for (const item of approved) {
    try {
      const work = workMap.get(`${item.artistId}|${item.workId}`);
      if (!work) throw new Error(`${item.artistId}: representative work is missing`);
      const canonicalTarget = canonicalArtworkPath(
        {id:item.artistId, name:item.artistName},
        work,
        path.extname(item.targetPath) || '.jpg'
      );
      let localPath = existingLocalPathForWork(work, item.artistId) || resolveExistingLocalImagePath(item.targetPath);
      let absolute = localPath ? path.join(root, localPath) : path.join(root, item.targetPath);
      let buffer;
      if (localPath && fs.existsSync(absolute) && fs.statSync(absolute).size > 0) {
        buffer = fs.readFileSync(absolute);
      } else {
        const source = new URL(item.selected.downloadUrl);
        const approvedHost = source.hostname === 'upload.wikimedia.org'
          || (source.hostname === 'commons.wikimedia.org' && source.pathname.startsWith('/wiki/Special:Redirect/file/'));
        if (source.protocol !== 'https:' || !approvedHost) {
          throw new Error(`${item.artistId}: unapproved image host ${source.hostname}`);
        }
        let response;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          response = await fetch(source, {
            headers:{'User-Agent':'ArtThroughTime/0.1 (user-approved educational image download)'},
            signal:AbortSignal.timeout(30000)
          });
          if (response.status !== 429) break;
          const retryAfter = Number(response.headers.get('retry-after') || 0);
          const waitMs = Math.min(30000, Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        if (!response.ok) throw new Error(`${item.artistId}: image download ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) throw new Error(`${item.artistId}: expected image response, got ${contentType}`);
        const declaredBytes = Number(response.headers.get('content-length') || 0);
        if (declaredBytes > maxBytes) throw new Error(`${item.artistId}: image exceeds ${maxBytes} bytes`);
        buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > maxBytes) throw new Error(`${item.artistId}: invalid image size ${buffer.length}`);
        localPath = canonicalTarget;
        absolute = path.join(root, localPath);
        fs.mkdirSync(path.dirname(absolute), {recursive:true});
        fs.writeFileSync(absolute, buffer);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      item.targetPath = localPath;
      work.localImage = localPath;
      work.sourceUrl = item.selected.pageUrl;
      work.license = item.selected.license;
      work.institution = 'Wikimedia Commons';
      item.reviewStatus = 'downloaded';
      item.downloadedAt = new Date().toISOString();
      item.bytes = buffer.length;
      const curatedItem = curated.items.find(entry => entry.artistId === item.artistId && entry.workId === item.workId);
      if (curatedItem) {
        curatedItem.reviewStatus = 'downloaded';
        curatedItem.downloadedAt = item.downloadedAt;
      }
      results.push({artistId:item.artistId, workId:item.workId, targetPath:localPath, bytes:buffer.length});
      persist();
      console.log(`downloaded ${item.artistId} (${buffer.length} bytes)`);
    } catch (error) {
      errors.push({artistId:item.artistId, workId:item.workId, message:error.message});
      console.error(error.message);
    }
  }
  persist();
  console.log(JSON.stringify({downloaded:results.length, failed:errors.length, results, errors}, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
