/* Checks artist-relation impact-event data whenever a timeline image is added. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(root, 'data', 'artist-relations.json');
const artistsFile = path.join(root, 'data', 'artists.json');
const auditFile = path.join(root, 'data', 'artist-relation-impact-audits.json');
const historicalPattern = /전쟁|침략|점령|혁명|내전|포위|강제 이주|페스트|역병|war|invasion|occupation|revolution|civil war|siege|forced migration|plague|epidemic/i;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
function text(value) { return String(value || '').trim(); }
function bilingual(value) { return value && typeof value === 'object' && text(value.ko) && text(value.en); }
function validSource(value) { try { const url = new URL(text(value)); return /^https?:$/.test(url.protocol); } catch (_) { return false; } }
function artistName(artist) { return artist?.name?.ko || artist?.name?.en || artist?.id || ''; }

function inspectArtistRelationImpact({artistId, workId = '', trigger = 'timeline-image-added'} = {}) {
  const artistsPayload = readJson(artistsFile, {artists: []});
  const artists = Array.isArray(artistsPayload) ? artistsPayload : artistsPayload.artists || [];
  const artist = artists.find(item => item.id === artistId);
  const relations = readJson(dataFile, {});
  const records = relations.artists && typeof relations.artists === 'object' ? relations.artists : relations;
  const record = records[artistId];
  const events = Array.isArray(record?.impactEvents) ? record.impactEvents : [];
  const eventIssues = events.flatMap((event, index) => {
    const issues = [];
    if (!text(event?.year)) issues.push(`${index + 1}번 사건의 연도가 없음`);
    if (!bilingual(event?.title)) issues.push(`${index + 1}번 사건의 한·영 제목이 불완전함`);
    if (!bilingual(event?.impact || event?.description)) issues.push(`${index + 1}번 사건의 한·영 영향 설명이 불완전함`);
    if (!validSource(event?.source)) issues.push(`${index + 1}번 사건의 검증 출처 URL이 없음 또는 형식이 잘못됨`);
    return issues;
  });
  const historicalEvents = events.filter(event => historicalPattern.test(`${event?.title?.ko || ''} ${event?.title?.en || ''} ${event?.impact?.ko || event?.description?.ko || ''} ${event?.impact?.en || event?.description?.en || ''}`));
  const issues = [];
  if (!artist) issues.push('화가 목록에서 화가 ID를 찾지 못함');
  if (!record) issues.push('화가 관계도 데이터가 없음');
  if (events.length < 3) issues.push('영향 사건이 3개 미만이므로 생애·환경·역사 사건을 재검토해야 함');
  if (events.length && !validSource(events[0]?.source)) issues.push('첫 사건(출생·환경 배경)의 검증 출처가 없음');
  issues.push(...eventIssues);
  const result = {
    artistId,
    artistName: artistName(artist),
    workId: text(workId),
    trigger,
    checkedAt: new Date().toISOString(),
    status: issues.length ? 'needs-data-review' : 'ready-for-historical-review',
    checks: {
      relationRecord: Boolean(record),
      impactEventCount: events.length,
      firstEventHasSource: Boolean(events.length && validSource(events[0]?.source)),
      eventFieldsValid: eventIssues.length === 0,
      historicalDirectImpactCandidates: historicalEvents.length
    },
    issues,
    historicalReview: {
      status: 'pending-source-review',
      instruction: '새 이미지가 추가되었으므로 이 화가가 생존 중 직접 겪은 전쟁·침략·점령·혁명·내전·포위·강제 이주·역병이 작품, 이동, 후원 또는 표현에 영향을 주었는지 출처로 재확인한다. 직접 영향이 확인된 사건만 impactEvents에 추가한다.',
      candidateCount: historicalEvents.length
    }
  };
  return result;
}

function recordArtistRelationImpactAudit(input) {
  const result = inspectArtistRelationImpact(input);
  const audit = readJson(auditFile, {version: 1, audits: {}});
  audit.version = 1;
  audit.audits = audit.audits && typeof audit.audits === 'object' && !Array.isArray(audit.audits) ? audit.audits : {};
  audit.audits[`${result.artistId}:${result.workId || '_artist'}`] = result;
  fs.writeFileSync(auditFile, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  return result;
}

module.exports = { inspectArtistRelationImpact, recordArtistRelationImpactAudit };

if (require.main === module) {
  const args = process.argv.slice(2);
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] || '' : ''; };
  const artistId = value('--artist');
  if (!artistId) throw new Error('Usage: node tools/artist-relation-impact-audit.js --artist <artistId> [--work <workId>]');
  console.log(JSON.stringify(recordArtistRelationImpactAudit({artistId, workId: value('--work')}), null, 2));
}
