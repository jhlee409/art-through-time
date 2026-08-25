const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const configFile = path.join(root, 'data', 'local-image-sources.json');
const imageFilePattern = /\.(?:jpe?g|png|webp|gif)$/i;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

function uniqueExistingDirectories(values) {
  return [...new Set(values.map(value => path.resolve(value)))].filter(value => {
    try { return fs.statSync(value).isDirectory(); } catch (_) { return false; }
  });
}

function downloadDirectories() {
  const config = readConfig();
  const project = (config.projectRelativeDirectories || []).map(value => path.join(root, value));
  return uniqueExistingDirectories(project);
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}

function findLocalImage(candidates = []) {
  const wanted = new Set(candidates.map(normalize).filter(Boolean));
  if (!wanted.size) return '';
  for (const folder of downloadDirectories()) {
    const queue = [folder];
    while (queue.length) {
      const current = queue.shift();
      for (const entry of fs.readdirSync(current, {withFileTypes:true})) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(absolute);
        else if (entry.isFile() && imageFilePattern.test(entry.name)) {
          const name = normalize(path.parse(entry.name).name);
          if ([...wanted].some(candidate => name.includes(candidate) || candidate.includes(name))) return absolute;
        }
      }
    }
  }
  return '';
}

module.exports = {downloadDirectories, findLocalImage};
