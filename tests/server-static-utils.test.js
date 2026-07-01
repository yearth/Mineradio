const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  contentTypeForPath,
  resolveStaticFilePath,
} = require('../server-dist/server/static-utils');

const appRoot = path.join(__dirname, '..');

test('contentTypeForPath preserves legacy static MIME mappings', () => {
  assert.equal(contentTypeForPath('/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeForPath('/app.js'), 'application/javascript');
  assert.equal(contentTypeForPath('/styles.css'), 'text/css');
  assert.equal(contentTypeForPath('/manifest.json'), 'application/json');
  assert.equal(contentTypeForPath('/cover.png'), 'image/png');
  assert.equal(contentTypeForPath('/cover.jpg'), 'image/jpeg');
  assert.equal(contentTypeForPath('/favicon.ico'), 'image/x-icon');
  assert.equal(contentTypeForPath('/logo.svg'), 'image/svg+xml');
});

test('contentTypeForPath falls back to text/plain for unknown extensions', () => {
  assert.equal(contentTypeForPath('/notes.txt'), 'text/plain');
  assert.equal(contentTypeForPath('/asset'), 'text/plain');
});

test('resolveStaticFilePath preserves legacy favicon and root page locations', () => {
  assert.equal(
    resolveStaticFilePath('/favicon.ico', appRoot),
    path.join(appRoot, 'build', 'icon.ico')
  );
  assert.equal(
    resolveStaticFilePath('/', appRoot),
    path.join(appRoot, 'public', 'index.html')
  );
});

test('resolveStaticFilePath keeps regular assets under public', () => {
  assert.equal(
    resolveStaticFilePath('/js/app.js', appRoot),
    path.join(appRoot, 'public', '/js/app.js')
  );
  assert.equal(
    resolveStaticFilePath('/nested/image.png', appRoot),
    path.join(appRoot, 'public', '/nested/image.png')
  );
});
