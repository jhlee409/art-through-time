#!/usr/bin/env node
const movements = require('../data/art-movements.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const duplicates = [];
for (const country of movements.countries || []) {
  const developmentOwners = new Map();
  for (const movement of country.movements || []) {
    for (const developmentId of movement.canonical?.developmentIds || []) {
      const owners = developmentOwners.get(developmentId) || [];
      owners.push(movement.name?.ko || movement.name?.en || '(unnamed)');
      developmentOwners.set(developmentId, owners);
    }
  }
  for (const [developmentId, owners] of developmentOwners) {
    if (owners.length > 1) duplicates.push({country: country.name?.ko || country.id, developmentId, owners});
  }
}

assert(!duplicates.length, `Duplicate country movement development bindings:\n${duplicates.map(item => `${item.country} / ${item.developmentId}: ${item.owners.join(', ')}`).join('\n')}`);
console.log(JSON.stringify({countries: movements.countries?.length || 0, duplicateDevelopments: 0}, null, 2));
