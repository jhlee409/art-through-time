const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'data', 'artist-relations.json');
const updatePath = process.argv[2];

if (!updatePath) throw new Error('Usage: node tools/upsert-artist-relations.js <updates.json>');
const relations = JSON.parse(fs.readFileSync(target, 'utf8'));
const updates = JSON.parse(fs.readFileSync(path.resolve(root, updatePath), 'utf8'));
Object.assign(relations.artists, updates);
fs.writeFileSync(target, `${JSON.stringify(relations, null, 2)}\n`, 'utf8');
console.log(`Updated ${Object.keys(updates).length} artist relation records.`);
