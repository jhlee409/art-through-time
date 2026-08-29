/* Normalize the #countries development table in stored movement documents. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=JSON.parse(fs.readFileSync(path.join(root,'data','미술사조','index.json'),'utf8'));
const files=[...new Set(Object.values(index.documents || {}).flatMap(slots => Object.values(slots || {})))];
const styleId='art-atlas-country-development-table-style';
const standardHeaders=['국가·지역·세부 사조','지역적 특징','대표 화가·제작자','더 볼 화가'];
const style=`<style id="${styleId}">#countries[data-art-atlas-country-feature-editor] .wrap{width:100%;max-width:none;padding-left:3vw;padding-right:3vw}#countries[data-art-atlas-country-feature-editor] table{min-width:0}#countries[data-art-atlas-country-feature-editor] th:not(:last-child),#countries[data-art-atlas-country-feature-editor] td:not(:last-child){border-right:1px solid #fff}#countries[data-art-atlas-country-feature-editor] th:first-child,#countries[data-art-atlas-country-feature-editor] td:first-child,#countries[data-art-atlas-country-feature-editor] th:nth-child(3),#countries[data-art-atlas-country-feature-editor] td:nth-child(3),#countries[data-art-atlas-country-feature-editor] th:nth-child(4),#countries[data-art-atlas-country-feature-editor] td:nth-child(4){width:1%;white-space:nowrap}#countries[data-art-atlas-country-feature-editor] td:nth-child(2){position:relative;padding-right:48px;text-align:left;vertical-align:middle}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list{margin:.1em 0;padding-left:1.45em;text-align:left}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list>li{margin:.38em 0}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list strong{display:block}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list ul{margin:.25em 0 0;padding-left:1.2em}</style>`;
function text(value) { return String(value || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim(); }
function replaceCellContent(cell, content) { return cell.replace(/^(<td\b[^>]*>)[\s\S]*<\/td>$/i, `$1${content}</td>`); }
function normalizeTable(table) {
  const thead=table.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/i)?.[0];
  const tbody=table.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/i)?.[0];
  if (!thead || !tbody) return {table,reason:'thead 또는 tbody 없음'};
  const headers=[...thead.matchAll(/<th\b[^>]*>[\s\S]*?<\/th>/gi)];
  if (![3,4].includes(headers.length)) return {table,reason:`${headers.length}컬럼`};
  let nextHead=thead, headerIndex=0;
  nextHead=nextHead.replace(/<th\b([^>]*)>[\s\S]*?<\/th>/gi,(_,attrs) => `<th${attrs}>${standardHeaders[headerIndex++]}</th>`);
  let nextBody=tbody, changedRows=0;
  nextBody=nextBody.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,row => {
    const cells=[...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map(match => match[0]);
    if (cells.length !== headers.length) return row;
    const feature=cells[1];
    if (/art-atlas-country-feature-list/i.test(feature)) return row;
    const source=feature.replace(/^<td\b[^>]*>|<\/td>$/gi,'').trim();
    if (!text(source)) return row;
    cells[1]=replaceCellContent(feature,`<ol class="art-atlas-country-feature-list"><li><strong>핵심 특징</strong><ul><li>${source}</li></ul></li></ol>`);
    changedRows += 1;
    let cellIndex=0;
    return row.replace(/<td\b[^>]*>[\s\S]*?<\/td>/gi,() => cells[cellIndex++]);
  });
  return {table:table.replace(thead,nextHead).replace(tbody,nextBody),changedRows};
}
function normalizeDocument(source) {
  const start=source.search(/<section\b[^>]*\bid=["']countries["'][^>]*>/i);
  if (start < 0) return {source,reason:'#countries 없음'};
  const tableStart=source.indexOf('<table',start);
  const tableEnd=tableStart < 0 ? -1 : source.indexOf('</table>',tableStart);
  if (tableStart < 0 || tableEnd < 0) return {source,reason:'국가 전개 표 없음'};
  const table=source.slice(tableStart,tableEnd+8);
  const normalized=normalizeTable(table);
  if (normalized.reason) return {source,reason:normalized.reason};
  let next=source.slice(0,start)+source.slice(start).replace(/<section\b([^>]*)>/i,(tag,attrs) => /data-art-atlas-country-feature-editor/i.test(tag) ? tag : `<section${attrs} data-art-atlas-country-feature-editor="country-development">`);
  const nextTableStart=next.indexOf('<table',start), nextTableEnd=next.indexOf('</table>',nextTableStart);
  next=`${next.slice(0,nextTableStart)}${normalized.table}${next.slice(nextTableEnd+8)}`;
  const existingStyle=new RegExp(`<style\\b[^>]*id=["']${styleId}["'][^>]*>[\\s\\S]*?<\\/style>`,'i');
  if (existingStyle.test(next)) next=next.replace(existingStyle,style);
  else next=/<\/head>/i.test(next) ? next.replace(/<\/head>/i,`${style}</head>`) : `${style}\n${next}`;
  return {source:next,changedRows:normalized.changedRows};
}
const dryRun=process.argv.includes('--dry-run');
const result={documents:files.length,updated:[],exceptions:[],featureRows:0};
for (const relative of files) {
  const file=path.join(root,relative);
  const source=fs.readFileSync(file,'utf8');
  const normalized=normalizeDocument(source);
  if (normalized.reason) { result.exceptions.push({relative,reason:normalized.reason}); continue; }
  result.featureRows += normalized.changedRows || 0;
  if (normalized.source !== source) {
    result.updated.push(relative);
    if (!dryRun) fs.writeFileSync(file,normalized.source,'utf8');
  }
}
console.log(JSON.stringify(result,null,2));
if (result.exceptions.length) process.exitCode=1;
