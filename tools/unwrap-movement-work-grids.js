const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const layoutStart = '<!-- art-atlas-baroque-card-layout:start -->';
const layoutEnd = '<!-- art-atlas-baroque-card-layout:end -->';
const widthStart = '<!-- art-atlas-full-width-work-grid:start -->';
const widthEnd = '<!-- art-atlas-full-width-work-grid:end -->';
const bodyWidthStart = '<!-- art-atlas-expanded-document-width:start -->';
const bodyWidthEnd = '<!-- art-atlas-expanded-document-width:end -->';
const widthStyle = `${widthStart}
<style id="art-atlas-full-width-work-grid">
.movement-enhancement .movement-work-grid,.movement-enhancement .movement-work-grid.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:16px}
.movement-enhancement .movement-work-card{overflow:hidden;border:1px solid var(--line,#2a3037);border-radius:12px;background:linear-gradient(180deg,var(--panel2,#181d23),var(--panel,#12161b));box-shadow:0 12px 28px rgba(0,0,0,.22)}
.movement-enhancement .movement-work-image{background:#090b0d;display:flex;align-items:center;justify-content:center;min-height:260px}
.movement-enhancement .movement-work-image img{display:block;width:100%;height:320px;object-fit:contain}
.movement-enhancement .movement-work-body{padding:16px;color:#cfd6dd}
.movement-enhancement .wrap .movement-work-grid{width:100vw;max-width:none;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
@media(max-width:900px){.movement-enhancement .movement-work-grid,.movement-enhancement .movement-work-grid.three{grid-template-columns:1fr}.movement-enhancement .movement-work-image img{height:auto;max-height:420px}}
</style>
${widthEnd}`;

function documentWidthStyle(baseWidth) {
  return `${bodyWidthStart}
<style id="art-atlas-expanded-document-width">
.wrap{width:min(${Math.round(baseWidth * 1.3)}px,92vw)}
</style>
${bodyWidthEnd}`;
}

function matchingDivEnd(html, start) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    if (match[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}

let updated = 0;
for (const fileName of fs.readdirSync(movementDir).filter(name => name.endsWith('-1.html'))) {
  const filePath = path.join(movementDir, fileName);
  let html = fs.readFileSync(filePath, 'utf8');
  const hasEnhancement = html.includes('<!-- art-atlas-enhancement:start -->');

  const oldBodyWidthStart = html.indexOf(bodyWidthStart);
  const oldBodyWidthEnd = html.indexOf(bodyWidthEnd, oldBodyWidthStart);
  if (oldBodyWidthStart >= 0 && oldBodyWidthEnd >= 0) {
    html = html.slice(0, oldBodyWidthStart) + html.slice(oldBodyWidthEnd + bodyWidthEnd.length);
  }
  const baseWidth = html.match(/\.wrap\{width:min\((\d+)px,92vw\);margin:auto\}/)?.[1];
  if (!baseWidth) throw new Error(`Base document width not found in ${fileName}`);
  const widthTarget = hasEnhancement ? '<!-- art-atlas-enhancement:end -->' : '</head>';
  html = html.replace(widthTarget, `${documentWidthStyle(Number(baseWidth))}\n${widthTarget}`);

  if (!hasEnhancement) {
    fs.writeFileSync(filePath, html, 'utf8');
    updated += 1;
    continue;
  }

  const styleStart = html.indexOf(layoutStart);
  const styleEnd = html.indexOf(layoutEnd, styleStart);
  if (styleStart >= 0 && styleEnd >= 0) {
    html = html.slice(0, styleStart) + html.slice(styleEnd + layoutEnd.length);
  }
  if (fileName !== '37a05b9246dcdbd89a685d55-1.html') {
    const oldWidthStart = html.indexOf(widthStart);
    const oldWidthEnd = html.indexOf(widthEnd, oldWidthStart);
    if (oldWidthStart >= 0 && oldWidthEnd >= 0) {
      html = html.slice(0, oldWidthStart) + html.slice(oldWidthEnd + widthEnd.length);
    }
    html = html.replace('<!-- art-atlas-enhancement:end -->', `${widthStyle}\n<!-- art-atlas-enhancement:end -->`);
  }

  // Work from the end so offsets remain valid.  Unwrapping preserves all card
  // markup, images, captions, and descriptions; it only removes the narrow panel.
  const panels = [];
  const panelPattern = /<div\s+class="enhancement-panel"[^>]*>/gi;
  for (let match; (match = panelPattern.exec(html));) {
    const end = matchingDivEnd(html, match.index);
    if (end < 0) throw new Error(`Unclosed enhancement panel in ${fileName}`);
    const contents = html.slice(match.index, end);
    if (contents.includes('movement-work-grid')) panels.push({ start: match.index, openEnd: panelPattern.lastIndex, end });
  }
  for (const panel of panels.reverse()) {
    html = html.slice(0, panel.start) + html.slice(panel.openEnd, panel.end - 6) + html.slice(panel.end);
  }

  html = html.replace(/[ \t]+\r?\n/g, '\n');
  fs.writeFileSync(filePath, html, 'utf8');
  updated += 1;
}
console.log(`updated ${updated} movement document(s)`);
