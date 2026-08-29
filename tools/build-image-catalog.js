#!/usr/bin/env node
const path = require('node:path');
const {catalogFile, buildCatalog, writeCatalog, validateCatalog} = require('./image-catalog');

const bootstrap = process.argv.includes('--bootstrap');
const check = process.argv.includes('--check');

if (check) {
  const result = validateCatalog({checkHashes: process.argv.includes('--hashes')});
  console.log(JSON.stringify({file: path.relative(process.cwd(), catalogFile).replace(/\\/g, '/'), ...result}, null, 2));
  if (!result.valid) process.exitCode = 1;
} else {
  const catalog = buildCatalog({bootstrap});
  if (catalog.stats.newNonstandardNames) {
    console.error(JSON.stringify({
      error: 'New image filenames do not follow the canonical naming standard.',
      count: catalog.stats.newNonstandardNames,
      standard: catalog.namingStandard
    }, null, 2));
    process.exitCode = 1;
  } else {
    writeCatalog(catalog);
    console.log(JSON.stringify({file: path.relative(process.cwd(), catalogFile).replace(/\\/g, '/'), ...catalog.stats}, null, 2));
  }
}
