const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const updatePath = process.argv[2];
if (!updatePath) throw new Error('Usage: node tools/append-impact-events.js <updates.json>');
const target = path.join(root, 'data', 'artist-relations.json');
const relations = JSON.parse(fs.readFileSync(target, 'utf8'));
const updates = JSON.parse(fs.readFileSync(path.resolve(root, updatePath), 'utf8'));
for (const [artistId, events] of Object.entries(updates)) {
  const record = relations.artists[artistId];
  if (!record) throw new Error(`Unknown artist relation: ${artistId}`);
  record.impactEvents ??= [];
  for (const event of events) if (!record.impactEvents.some((item) => item.year === event.year && item.title?.en === event.title?.en)) record.impactEvents.push(event);
}
fs.writeFileSync(target, `${JSON.stringify(relations, null, 2)}\n`, 'utf8');
console.log(`Appended conflict-impact events for ${Object.keys(updates).length} artists.`);
