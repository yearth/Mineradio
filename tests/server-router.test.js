const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { routeDescriptors, routeOwners } = require('../server-dist/server/router');

const root = path.join(__dirname, '..');

function legacyApiPaths() {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  return Array.from(serverSource.matchAll(/if \(pn === '([^']+)'\)/g))
    .map(match => match[1])
    .filter(routePath => routePath.startsWith('/api/'))
    .sort();
}

test('server router descriptors cover the legacy API surface', () => {
  const apiPaths = routeDescriptors
    .filter(route => route.path.startsWith('/api/'))
    .map(route => route.path)
    .sort();

  assert.deepEqual(apiPaths, legacyApiPaths());
});

test('server router descriptors are unique and assigned to known owners', () => {
  const keys = routeDescriptors.map(route => `${route.method} ${route.path}`);
  assert.equal(new Set(keys).size, keys.length);

  for (const route of routeDescriptors) {
    assert.ok(routeOwners.includes(route.owner), `unknown owner for ${route.path}: ${route.owner}`);
    assert.match(route.path, /^\//);
  }
});
