#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {workHasLocalImage} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const manifestFile = path.join(root, 'data', 'further-artist-image-download-manifest.json');
const commonsApi = 'https://commons.wikimedia.org/w/api.php';
const stopWords = new Set(['a','an','and','at','by','for','from','in','of','on','the','to','untitled','with']);

requireUrlFileDownloadApproval({
  purpose:'Build the user-approved, one-work-per-further-artist Wikimedia Commons image manifest.',
  url:commonsApi
});

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(token => token.length > 2 && !stopWords.has(token));
}

function candidateScore(candidate, artistName, workTitle) {
  const title = normalize(candidate.fileTitle.replace(/^File:/i, '').replace(/\.[^.]+$/, ''));
  const artistTokens = tokens(artistName);
  const workTokens = tokens(workTitle);
  const artistMatches = artistTokens.filter(token => title.includes(token)).length;
  const workMatches = workTokens.filter(token => title.includes(token)).length;
  const compactTitle = title.replace(/\s+/g, '');
  const compactWork = normalize(workTitle).replace(/\s+/g, '');
  const exactWork = compactWork.length > 5 && compactTitle.includes(compactWork);
  const derivative = /\b(detail|study|page|poster|postcard|copy|after|sketch)\b/.test(title);
  return {
    score:artistMatches * 4 + workMatches * 3 + (exactWork ? 8 : 0) - (derivative ? 14 : 0),
    artistMatches,
    workMatches,
    exactWork,
    derivative
  };
}

function extensionFor(mime, fileTitle) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  const extension = path.extname(fileTitle).toLowerCase();
  return ['.jpg','.jpeg','.png','.webp','.gif'].includes(extension) ? extension : '.jpg';
}

async function searchCommons(item) {
  const artistName = item.artist.name.en || item.artist.name.ko;
  const workTitle = item.work.title.en || item.work.title.ko;
  const queries = [`${artistName} ${workTitle}`];
  const found = new Map();
  for (const query of queries) {
    const params = new URLSearchParams({
      action:'query', generator:'search', gsrnamespace:'6', gsrsearch:query, gsrlimit:'10',
      prop:'imageinfo', iiprop:'url|mime|size|extmetadata', iiurlwidth:'1400',
      format:'json', formatversion:'2', origin:'*'
    });
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(`${commonsApi}?${params}`, {
        headers:{'User-Agent':'ArtThroughTime/0.1 (educational local archive; Wikimedia Commons image manifest)'}
      });
      if (response.status !== 429) break;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    if (!response.ok) throw new Error(`${item.artist.id}: Commons API ${response.status}`);
    const payload = await response.json();
    for (const page of payload.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !String(info.mime || '').startsWith('image/')) continue;
      const scored = candidateScore({fileTitle:page.title}, artistName, workTitle);
      found.set(page.title, {
        ...scored,
        fileTitle:page.title,
        pageUrl:info.descriptionurl,
        downloadUrl:info.thumburl,
        mime:info.mime,
        width:info.thumbwidth || info.width,
        height:info.thumbheight || info.height,
        license:info.extmetadata?.LicenseShortName?.value || '',
        credit:info.extmetadata?.Credit?.value || '',
        artistCredit:info.extmetadata?.Artist?.value || ''
      });
    }
    if ([...found.values()].some(candidate => candidate.exactWork && candidate.artistMatches && !candidate.derivative)) break;
  }
  return [...found.values()].sort((a,b) => b.score - a.score);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        results[index] = {error:error.message};
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit, items.length)}, worker));
  return results;
}

async function main() {
  const representatives = JSON.parse(fs.readFileSync(representativesFile, 'utf8'));
  const pending = representatives.furtherArtists.flatMap(category => category.artists.map(item => ({...item, categoryId:category.categoryId}))).filter(item => !workHasLocalImage(item.work, item.artist.id));
  const searches = await mapLimit(pending, 2, searchCommons);
  const items = pending.map((item, index) => {
    const candidates = Array.isArray(searches[index]) ? searches[index] : [];
    const top = candidates[0];
    const workTokenCount = tokens(item.work.title.en || item.work.title.ko).length;
    const requiredWorkMatches = Math.min(2, Math.max(1, workTokenCount));
    const confident = Boolean(top && !top.derivative && top.artistMatches >= 1 && (top.exactWork || top.workMatches >= requiredWorkMatches));
    const extension = top ? extensionFor(top.mime, top.fileTitle) : '.jpg';
    return {
      categoryId:item.categoryId,
      artistId:item.artist.id,
      artistName:item.artist.name,
      workId:item.work.id,
      workTitle:item.work.title,
      targetPath:`data/images/${item.artist.id}/${item.work.id}${extension}`,
      reviewStatus:confident ? 'candidate' : 'unresolved',
      selected:confident ? top : null,
      candidates:candidates.slice(0,3),
      ...(searches[index]?.error ? {error:searches[index].error} : {})
    };
  });
  const manifest = {
    schema:1,
    scope:'user-approved-temporary-further-artist-image-download',
    sourceSite:'Wikimedia Commons',
    sourceApi:commonsApi,
    generatedAt:new Date().toISOString(),
    policy:'작가당 확정 대표작 1점만 받으며 Commons 파일 페이지의 공개 라이선스와 작품 일치를 검토한 candidate만 다운로드한다.',
    counts:{
      pending:items.length,
      candidates:items.filter(item => item.reviewStatus === 'candidate').length,
      unresolved:items.filter(item => item.reviewStatus === 'unresolved').length
    },
    items
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(manifest.counts, null, 2));
  console.log(path.relative(root, manifestFile).replace(/\\/g, '/'));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
