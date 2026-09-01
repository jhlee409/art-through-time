const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const bundles = {
  'extras.css': [
    'extras/timeline-shell.css',
    'extras/artist-works.css',
    'extras/country-art.css',
    'extras/movement-shell.css',
    'extras.css'
  ],
  'server-content.js': [
    'server-content/foundation.js',
    'server-content/presentation.js',
    'server-content/artists.js',
    'server-content/integration.js',
    'server-content/documents.js',
    'server-content/uploads.js',
    'server-content/section-links.js',
    'server-content.js'
  ],
  'app/app-core.js': [
    'app/app-core/state.js',
    'app/app-core/session-api.js',
    'app/app-core/localization-artworks.js',
    'app/app-core/countries-navigation.js',
    'app/app-core/movement-selection.js',
    'app/app-core/links-images.js',
    'app/app-core/data-session.js',
    'app/app-core/filters.js',
    'app/app-core.js'
  ],
  'app/app-artists.js': [
    'app/app-artists/list-summary.js',
    'app/app-artists/grouping.js',
    'app/app-artists/timeline.js',
    'app/app-artists/image-behavior.js',
    'app/app-artists.js'
  ],
  'app/app-atlas.js': [
    'app/app-atlas/movement-atlas.js',
    'app/app-atlas/country-art-data.js',
    'app/app-atlas/artist-list.js',
    'app/app-atlas/country-art-render.js',
    'app/app-atlas.js'
  ],
  'app/app-detail.js': [
    'app/app-detail/artwork-detail.js',
    'app/app-detail/slideshow-movement.js',
    'app/app-detail/movement-editor.js',
    'app/app-detail/uploads.js',
    'app/app-detail.js'
  ]
};

function bundleFiles(entry) {
  return bundles[entry] || [entry];
}

function readBundle(entry) {
  return bundleFiles(entry)
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
}

module.exports = { bundles, bundleFiles, readBundle };
