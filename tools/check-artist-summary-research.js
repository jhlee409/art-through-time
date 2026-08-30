#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { sourceKey, mergeChronology, readableBlogUrl, cleanManualSummaryLines, savedTranscriptSource, finalizeResearchDraft, chronologySort } = require('../server-artist-research');
const { presentationLinks } = require('../server-data');

const monetWatch = 'https://www.youtube.com/watch?v=Q6nhX7GuliM&t=1s';
assert.equal(sourceKey(monetWatch), 'youtube:Q6nhX7GuliM');
assert.equal(sourceKey('https://youtu.be/Q6nhX7GuliM?t=30'), sourceKey(monetWatch));
assert.equal(readableBlogUrl('https://blog.naver.com/artreader/223456789012'), 'https://m.blog.naver.com/PostView.naver?blogId=artreader&logNo=223456789012');

const artist = {birth:1840};
const sources = [{title:'연구 자료'}];
const events = [
  {year:1874,age:34,category:'화풍과 사조의 변천',text:'새로운 전시를 통해 화풍의 전환을 드러냈다.',sourceIndex:1},
  {year:1862,age:22,category:'초기 미술 교육',text:'야외 제작 방식과 빛의 관찰을 배웠다.',sourceIndex:1}
];
const first = mergeChronology(['화가의 전반적인 특징'], events, artist, sources);
assert.match(first[0], /^1862년 \(약 22세\)/);
assert.match(first[1], /^1874년 \(약 34세\)/);
assert.equal(first[2], '화가의 전반적인 특징');
assert.deepEqual(mergeChronology(first, events, artist, sources), first);
assert.deepEqual(cleanManualSummaryLines(['연도 미상 · 내용','1870년 · 다른 내용 (출처: 자료)','1869년 · 수동 내용']), ['[확인 필요] · 내용','1870년 · 다른 내용','1869년 · 수동 내용']);
assert.ok(first.every(line => !line.includes('출처:') && !line.startsWith('연도 미상')));
assert.deepEqual(chronologySort(['1870년 (약 31세) · 둘째','1870년 (약 30세) · 첫째','[확인 필요] · 뒤']),['1870년 (약 30세) · 첫째','1870년 (약 31세) · 둘째','[확인 필요] · 뒤']);
assert.match(mergeChronology(['[확인 필요] · 야외에서 빛을 관찰했다.'],[{year:1862,category:'초기 미술 교육',text:'야외에서 빛을 관찰했다.'}],artist)[0],/^1862년/);

const conflictDraft={existingLines:['1862년 (약 22세) · [초기 미술 교육] 화실에서만 그림을 배웠다.'],events:[{year:1862,category:'초기 미술 교육',text:'야외에서 그림을 배웠다.',conflictingExistingLine:'1862년 (약 22세) · [초기 미술 교육] 화실에서만 그림을 배웠다.'}],sources:[],failures:[],remainingCount:0,usage:{}};
const kept=finalizeResearchDraft(artist,conflictDraft,['keep']);
assert.equal(kept.lines[0],conflictDraft.existingLines[0]);
const replaced=finalizeResearchDraft(artist,conflictDraft,['replace']);
assert.match(replaced.lines[0],/야외에서 그림을 배웠다/);
assert.deepEqual(replaced.removedLines,conflictDraft.existingLines);

const pasted = savedTranscriptSource({url:monetWatch,transcript:'모네는 르아브르에서 부댕을 만나 야외에서 빛을 관찰하는 법을 배웠다. '.repeat(4)});
assert.equal(pasted.kind,'youtube');
assert.equal(pasted.key,'youtube:Q6nhX7GuliM');
assert.match(pasted.title,/저장 스크립트/);
assert.throws(()=>savedTranscriptSource({url:monetWatch,transcript:'너무 짧은 내용'}),/120자 이상/);

const storedLinks=presentationLinks([{url:monetWatch,emphasized:true,label:{ko:'영상',en:'Video'},transcript:'첫째 줄\r\n둘째 줄',transcriptUpdatedAt:'2026-08-30T00:00:00.000Z'}],'Artist links',{allowTranscript:true});
assert.equal(storedLinks[0].transcript,'첫째 줄\n둘째 줄');
assert.equal(storedLinks[0].emphasized,true);
assert.equal(storedLinks[0].transcriptUpdatedAt,'2026-08-30T00:00:00.000Z');
assert.deepEqual(storedLinks[0].label,{ko:'영상',en:'Video'});
assert.throws(()=>presentationLinks([{url:'https://example.com/',transcript:'본문'}],'Artist links',{allowTranscript:true}),/유튜브 링크/);

const artistUiSource=fs.readFileSync(require.resolve('../app/app-artists.js'),'utf8');
const summaryRenderStart=artistUiSource.indexOf("const summaryLines = localizedLines(artist.artistSummary)");
const summaryRenderEnd=artistUiSource.indexOf('setupArtistSummaryEditor(artist)',summaryRenderStart);
assert.ok(summaryRenderStart>=0 && summaryRenderEnd>summaryRenderStart);
assert.doesNotMatch(artistUiSource.slice(summaryRenderStart,summaryRenderEnd),/claude-monet|monet/i);
assert.match(artistUiSource.slice(summaryRenderStart,summaryRenderEnd),/const summaryBox =/);
const summarySetupSource=artistUiSource.slice(artistUiSource.indexOf('function setupArtistSummaryEditor'),artistUiSource.indexOf('function favoriteKey'));
assert.match(summarySetupSource,/openArtistSummaryArtworkPreview\(work\)/);
assert.doesNotMatch(summarySetupSource,/renderArtworkDetail\(work,artist,false\)/);
assert.match(summarySetupSource,/if\(expanded\) refreshArtistSummaryArtworkLinks\(box,artist\)/);
assert.match(summarySetupSource,/event\.target\.closest\('\[data-summary-work\]'\)/);
assert.match(summarySetupSource,/추가할 자료가 없습니다\./);
assert.match(artistUiSource,/<button class="artist-summary-update-button"[\s\S]*?<\/button>` : ''\}\$\{expandControl\}/);
const artistCssSource=fs.readFileSync(require.resolve('../styles.css'),'utf8');
assert.match(artistCssSource,/\.artist-summary-image-preview\{[^}]*place-items:center/);

async function checkConfirmationFlow() {
  const previousFetch=global.fetch, previousKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-key';
  global.fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({events:[{year:1862,category:'초기 미술 교육',text:'야외에서 그림을 배웠다.',sourceIndex:1,duplicateOfExistingLine:'',conflictingExistingLine:'1862년 (약 22세) · [초기 미술 교육] 화실에서만 그림을 배웠다.'}]}),usage:{input_tokens:100,output_tokens:30,total_tokens:130},output:[]})});
  try {
    const {researchArtistSummary}=require('../server-artist-research')();
    const testArtist={id:'test-artist',birth:1840,name:{ko:'시험 화가'},links:[{url:monetWatch,transcript:'모네는 야외에서 빛을 관찰하며 풍경을 그렸다. '.repeat(8)}],artistSummary:{ko:['1862년 (약 22세) · [초기 미술 교육] 화실에서만 그림을 배웠다.']},works:[]};
    const pending=await researchArtistSummary(testArtist);
    assert.equal(pending.needsConfirmation,true);
    assert.equal(pending.contradictions.length,1);
    const resolved=await researchArtistSummary(testArtist,{confirmationToken:pending.confirmationToken,decisions:['keep']});
    assert.equal(resolved.lines[0],testArtist.artistSummary.ko[0]);
    assert.equal(resolved.generatedLines.length,0);
  } finally {
    global.fetch=previousFetch;
    if(previousKey===undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY=previousKey;
  }
}

checkConfirmationFlow().then(()=>console.log(JSON.stringify({ok:true,checks:37}))).catch(error=>{console.error(error);process.exitCode=1;});
