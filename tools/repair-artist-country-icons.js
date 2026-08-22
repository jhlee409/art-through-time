const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsPath = path.join(root, 'data', 'artists.json');
const data = JSON.parse(fs.readFileSync(artistsPath, 'utf8'));

const fixes = {
  Q5811: {ko: '이탈리아', en: 'Italy'},
  Q9348: {ko: '이탈리아', en: 'Italy'}
};

const updated = [];
for (const artist of data.artists || []) {
  const nationality = fixes[artist.qid];
  if (!nationality) continue;
  if (artist.nationality?.ko && artist.nationality?.en) continue;
  artist.nationality = nationality;
  updated.push({qid: artist.qid, id: artist.id, name: artist.name?.ko || artist.name?.en || ''});
}

fs.writeFileSync(artistsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({updated}, null, 2));
