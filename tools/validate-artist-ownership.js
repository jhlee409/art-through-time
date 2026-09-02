#!/usr/bin/env node
/* Ensures a generated artist record and its generated works still belong to one artist. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsPath = path.join(root, 'data', 'artists.json');
const normalizePath = value => String(value || '').trim().replace(/\\/g, '/');
const issues = [];

function check(condition, message) {
  if (!condition) issues.push(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function main() {
  const artists = readJson('data/artists.json').artists || [];
  const qids = new Map();
  let generatedArtists = 0;
  let generatedWorks = 0;

  for (const artist of artists) {
    const qid = String(artist.qid || '').trim();
    if (qid) {
      check(!qids.has(qid), `Duplicate artist QID: ${qid} (${qids.get(qid)} and ${artist.id})`);
      qids.set(qid, artist.id);
    }

    if (!artist.generated?.file) continue;
    generatedArtists += 1;
    const generatedFile = normalizePath(artist.generated.file);
    const absoluteFile = path.join(root, generatedFile);
    check(fs.existsSync(absoluteFile), `Generated artist file is missing: ${artist.id}|${generatedFile}`);
    if (!fs.existsSync(absoluteFile)) continue;

    const generated = JSON.parse(fs.readFileSync(absoluteFile, 'utf8'));
    check(generated.qid === qid, `Generated source QID mismatch: ${artist.id}|artist=${qid}|source=${generated.qid || '(empty)'}`);
    check(!generated.artistId || generated.artistId === artist.id, `Generated source artist ID mismatch: ${artist.id}|source=${generated.artistId}`);
    const sourceWorkIds = new Set((generated.works || []).map(work => work?.id).filter(Boolean));
    for (const work of artist.works || []) {
      if (work.origin !== 'generated') continue;
      generatedWorks += 1;
      if (!sourceWorkIds.has(work.id)) {
        const verification = work.ownershipVerification || {};
        check(
          verification.source === 'wikidata-P170'
            && verification.artistQid === qid
            && verification.sourceWorkId === work.id
            && /^\d{4}-\d{2}-\d{2}T/.test(String(verification.verifiedAt || '')),
          `Generated work outside source snapshot requires verified ownership: ${artist.id}|${work.id}|${generatedFile}`
        );
      }
    }
  }

  console.log(JSON.stringify({
    ok: issues.length === 0,
    artists: artists.length,
    generatedArtists,
    generatedWorks,
    issues
  }, null, 2));
  if (issues.length) process.exitCode = 1;
}

main();
