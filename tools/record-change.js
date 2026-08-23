const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const changeDir = path.join(root, '변경사항');

function seoulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return {year: parts.year, month: parts.month, day: parts.day};
}

function todayStamp() {
  const {year, month, day} = seoulDateParts();
  return {display: `${year}-${month}-${day}`, file: `${year}${month}${day}`};
}

function usage() {
  console.error([
    'Usage:',
    '  node tools/record-change.js --section "섹션" --item "변경 내용" [--item "변경 내용"]',
    '',
    'Options:',
    '  --date YYYY-MM-DD   Override the Asia/Seoul date.',
    '  --section TEXT      Changelog section heading.',
    '  --item TEXT         Bullet item to add. Repeatable.'
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {items: []};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--section') {
      args.section = String(value || '').trim();
      index++;
    } else if (key === '--item') {
      args.items.push(String(value || '').trim());
      index++;
    } else if (key === '--date') {
      args.date = String(value || '').trim();
      index++;
    } else if (key === '--help' || key === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function dateInfo(value) {
  if (!value) return todayStamp();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('--date must use YYYY-MM-DD.');
  return {display: value, file: `${match[1]}${match[2]}${match[3]}`};
}

function cleanLine(value, label) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`${label} is required.`);
  if (/^#+\s/.test(text)) throw new Error(`${label} must not include a markdown heading marker.`);
  return text;
}

function ensureDocument(file, displayDate) {
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').replace(/\s*$/, '\n');
  return `# 변경사항 ${displayDate}\n`;
}

function appendItems(source, section, items) {
  const heading = `## ${section}`;
  const normalizedItems = items.map(item => `- ${item}`);
  if (!source.includes(heading)) {
    return `${source.replace(/\s*$/, '\n')}\n${heading}\n\n${normalizedItems.join('\n')}\n`;
  }

  const lines = source.replace(/\s*$/, '\n').split('\n');
  const start = lines.findIndex(line => line.trim() === heading);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const sectionLines = lines.slice(start, end);
  const additions = normalizedItems.filter(item => !sectionLines.includes(item));
  if (!additions.length) return lines.join('\n').replace(/\s*$/, '\n');

  const insertAt = end > start ? end : lines.length;
  const prefix = lines[insertAt - 1] === '' ? [] : [''];
  const suffix = /^##\s+/.test(lines[insertAt] || '') ? [''] : [];
  lines.splice(insertAt, 0, ...prefix, ...additions, ...suffix);
  return lines.join('\n').replace(/\s*$/, '\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const section = cleanLine(args.section, '--section');
  const items = args.items.map(item => cleanLine(item.replace(/^\s*-\s*/, ''), '--item'));
  if (!items.length) throw new Error('At least one --item is required.');

  const stamp = dateInfo(args.date);
  const file = path.join(changeDir, `변경사항_${stamp.file}.md`);
  fs.mkdirSync(changeDir, {recursive: true});

  const source = ensureDocument(file, stamp.display);
  const updated = appendItems(source, section, items);
  fs.writeFileSync(file, updated, 'utf8');
  console.log(path.relative(root, file).replace(/\\/g, '/'));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}
