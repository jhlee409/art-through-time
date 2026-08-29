const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const imageExtensionPattern = /\.(?:jpe?g|png|webp|gif)$/i;

function cleanLocalImagePath(value) {
  const clean = String(value || '').trim().replace(/[?#].*$/, '').replace(/\\/g, '/');
  if (!clean || /^(?:https?:)?\/\//i.test(clean) || /^data:/i.test(clean)) return '';
  return clean;
}

function existingLocalPath(value) {
  const clean = cleanLocalImagePath(value);
  if (!clean) return '';
  const absolute = path.join(root, clean);
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile() && fs.statSync(absolute).size > 0 ? clean : '';
}

function filesInReferenceFolder(reference) {
  const clean = cleanLocalImagePath(reference);
  if (!clean) return [];
  const folder = path.join(root, path.dirname(clean));
  try {
    return fs.readdirSync(folder, {withFileTypes: true})
      .filter(entry => entry.isFile() && imageExtensionPattern.test(entry.name))
      .map(entry => path.join(path.dirname(clean), entry.name).replace(/\\/g, '/'));
  } catch (_) {
    return [];
  }
}

function resolveExistingLocalImagePath(value) {
  const exact = existingLocalPath(value);
  if (exact) return exact;
  const clean = cleanLocalImagePath(value);
  if (!clean || !imageExtensionPattern.test(clean)) return '';
  const directory = path.dirname(clean).replace(/\\/g, '/');
  const parsed = path.parse(clean);
  const stem = path.basename(clean).replace(imageExtensionPattern, '');
  const candidates = [];
  for (const extension of imageExtensions) {
    candidates.push(`${directory}/${stem}${extension}`);
    candidates.push(`${directory}/${stem}.10mb${extension}`);
  }
  const direct = candidates.find(existingLocalPath);
  if (direct) return direct;
  return filesInReferenceFolder(clean).find(candidate => {
    const candidateStem = path.basename(candidate).replace(imageExtensionPattern, '').replace(/\.10mb$/i, '');
    return candidateStem === stem || candidateStem.startsWith(`${stem}.`) || parsed.name.startsWith(`${candidateStem}.`);
  }) || '';
}

function findExistingWorkImageById(artistId, workId) {
  const safeArtistId = String(artistId || '').trim();
  const safeWorkId = String(workId || '').trim();
  if (!safeArtistId || !safeWorkId) return '';
  const folder = `data/images/${safeArtistId}`;
  const absoluteFolder = path.join(root, folder);
  let names = [];
  try {
    names = fs.readdirSync(absoluteFolder, {withFileTypes: true})
      .filter(entry => entry.isFile() && imageExtensionPattern.test(entry.name))
      .map(entry => entry.name);
  } catch (_) {
    return '';
  }
  const exact = [];
  for (const extension of imageExtensions) {
    exact.push(`${safeWorkId}${extension}`);
    exact.push(`${safeWorkId}.10mb${extension}`);
  }
  const exactName = exact.find(name => names.includes(name));
  if (exactName) return `${folder}/${exactName}`;
  const prefixName = names.find(name => {
    const stem = name.replace(imageExtensionPattern, '').replace(/\.10mb$/i, '');
    return stem === safeWorkId || stem.startsWith(`${safeWorkId}.`) || stem.startsWith(`${safeWorkId}_`);
  });
  return prefixName ? `${folder}/${prefixName}` : '';
}

function existingLocalPathForWork(work, artistId = '') {
  if (!work) return '';
  const direct = [
    work.localImage,
    work.thumbnail,
    work.image,
    work.highResImage,
    work.highResOriginal,
    work.migration?.image?.localThumbnail,
    work.migration?.image?.highResolution
  ].map(resolveExistingLocalImagePath).find(Boolean);
  return direct || findExistingWorkImageById(artistId, work.id);
}

function workHasLocalImage(work, artistId = '') {
  return Boolean(existingLocalPathForWork(work, artistId));
}

module.exports = {
  cleanLocalImagePath,
  existingLocalPath,
  resolveExistingLocalImagePath,
  findExistingWorkImageById,
  existingLocalPathForWork,
  workHasLocalImage
};
