const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const placeholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
const dataFile = path.join(root, 'data', 'artists.json');
const generatedDir = path.join(root, 'data', 'generated');

const qidTitleFixes = {
  'wikidata-Q136891708': {title:{ko:'Le Reve', en:'Le Reve'}},
  'wikidata-Q110103503': {title:{ko:'Arbol de la esperanza, mantente firme', en:'Arbol de la esperanza, mantente firme'}},
  'wikidata-Q114744029': {title:{ko:'Portrait de Madame du Cluzel', en:'Portrait de Madame du Cluzel'}, imageFile:'Chartres (Eure-et-Loir) - Musee des Beaux-Arts - Portrait de la comtesse Marie-Therese Antoinette de Cluzel (Louise Elisabeth Vigee le Brun, 1755-1842) (48017636227).jpg'},
  'wikidata-Q96634683': {title:{ko:'Ritratto di Maria Antonietta a mezzo busto', en:'Ritratto di Maria Antonietta a mezzo busto'}, imageFile:'Marie Antoinette Adult9.jpg'},
  'wikidata-Q131468737': {title:{ko:'Portrait de la comtesse de Baussancourt', en:'Portrait de la comtesse de Baussancourt'}, imageFile:'Portrait de la comtesse de Baussancourt, par Elisabeth Vigee Le Brun.webp'},
  'wikidata-Q3794238': {title:{ko:'Le Jeune Routy a Celeyran', en:'Le Jeune Routy a Celeyran'}, imageFile:'(Albi) Le jeune Routy a Celeyran - Toulouse-Lautrec - 1882.jpg'},
  'wikidata-Q124260245': {title:{ko:'Autoportrait de dos', en:'Autoportrait de dos'}, imageFile:'Toulouse-Lautrec, de dos.jpg'},
  'wikidata-Q17491841': {title:{ko:'Justine Dieulh', en:'Justine Dieulh'}, imageFile:'Henri de Toulouse-Lautrec 052a.jpg'},
  'wikidata-Q121434609': {title:{ko:'Femme qui tire son bas', en:'Femme qui tire son bas'}, imageFile:'(Albi) Femme qui tire son bas 1894 - Toulouse-Lautrec - Musee Toulouse-Lautrec MTL.177.jpg'},
  'wikidata-Q64491271': {title:{ko:'La Danse au Moulin-Rouge', en:'La Danse au Moulin-Rouge'}, imageFile:'Henri de Toulouse-Lautrec - Panneaux pour la baraque de la Goulue, a la Foire du Trone a Paris - Google Art Project.jpg'},
  'wikidata-Q137594811': {title:{ko:'Sacra Conversazione', en:'Sacra Conversazione'}, imageFile:'Giorgione - Sacra Conversazione - WGA21123.jpg'},
  'wikidata-Q3977127': {title:{ko:'Joueur de flute', en:'Joueur de flute'}, imageFile:'Giorgione, suonatore di flauto 2.jpg'},
  'wikidata-Q3948603': {title:{ko:'Sansone deriso', en:'Sansone deriso'}, imageFile:'(Venice) Il Concerto - Giorgione.jpg'},
  'wikidata-Q3944858': {title:{ko:'Procession', en:'Procession'}},
  'wikidata-Q107436009': {title:{ko:'Vier Heilige: Hieronymus, Augustinus und zwei Karmeliter', en:'Vier Heilige: Hieronymus, Augustinus und zwei Karmeliter'}},
  'wikidata-Q123528970': {title:{ko:'Un disciple (recto) ; Personnage drape (verso)', en:'Un disciple (recto) ; Personnage drape (verso)'}},
  'wikidata-Q131705570': {title:{ko:'Das Auffinden des wahren Kreuzes', en:'Das Auffinden des wahren Kreuzes'}, imageFile:'14th-century painters - Page from the Tres Belles Heures de Notre Dame de Jean de Berry - WGA16016.jpg'},
  'wikidata-Q137599158': {title:{ko:"Portrait d'un moine", en:"Portrait d'un moine"}, imageFile:"Musee Ingres-Bourdelle - Portrait d'un moine - Jan Van Eyck.jpg"}
};

const noPublicImage = new Set([
  'wikidata-Q109930455',
  'wikidata-Q111207414',
  'wikidata-Q16488383',
  'wikidata-Q28339146',
  'wikidata-Q18343221',
  'wikidata-Q63341526',
  'wikidata-Q19897995',
  'wikidata-Q136892338',
  'wikidata-Q136891708',
  'wikidata-Q5943279',
  'wikidata-Q118901053',
  'wikidata-Q20879937',
  'wikidata-Q8773940',
  'wikidata-Q17629443',
  'wikidata-Q106811218',
  'wikidata-Q16038651',
  'wikidata-Q110103503',
  'wikidata-Q106368926',
  'wikidata-Q106368930',
  'wikidata-Q106368934',
  'wikidata-Q136706040',
  'manual-bellini-rimini-pieta-1470',
  'wikidata-Q121547247',
  'wikidata-Q116898418',
  'wikidata-Q3947757',
  'wikidata-Q3944858',
  'wikidata-Q107436009',
  'wikidata-Q118630274',
  'wikidata-Q123528970',
  'wikidata-Q111244447',
  'wikidata-Q3948886',
  'wikidata-Q115624243'
]);

const yearFixes = {'wikidata-Q16038651': 1936};

function commonsUrl(file) {
  return `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/%20/g, '%20')}`;
}

function patchWork(work, {markNoImage = false} = {}) {
  if (!work || !work.id) return 0;
  let changed = 0;
  const fix = qidTitleFixes[work.id];
  if (fix) {
    if (JSON.stringify(work.title || {}) !== JSON.stringify(fix.title)) {
      work.title = fix.title;
      changed++;
    }
    if (fix.imageFile && !work.image) {
      work.image = commonsUrl(fix.imageFile);
      changed++;
    }
  }
  if (Object.hasOwn(yearFixes, work.id) && work.year !== yearFixes[work.id]) {
    work.year = yearFixes[work.id];
    changed++;
  }
  if (markNoImage && noPublicImage.has(work.id) && !work.thumbnail && !work.image) {
    work.thumbnail = placeholder;
    work.thumbnailValidation = 0;
    work.thumbnailInvalidReason = 'no-public-image-source';
    changed++;
  }
  return changed;
}

function patchArtistsPayload(file, markNoImage) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  for (const artist of data.artists || []) {
    for (const work of artist.works || []) changed += patchWork(work, {markNoImage});
  }
  for (const work of data.works || []) changed += patchWork(work, {markNoImage});
  if (changed) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return changed;
}

let artistsJsonChanges = patchArtistsPayload(dataFile, true);
let generatedChanges = 0;
for (const name of fs.readdirSync(generatedDir)) {
  if (name.endsWith('.json')) generatedChanges += patchArtistsPayload(path.join(generatedDir, name), false);
}

console.log(JSON.stringify({artistsJsonChanges, generatedChanges}, null, 2));
