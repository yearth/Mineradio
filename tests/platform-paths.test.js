const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { defaultBeatMapCacheDir } = require('../lib/platform-paths');

test('defaultBeatMapCacheDir keeps the existing Windows D drive cache', () => {
  assert.equal(
    defaultBeatMapCacheDir({ platform: 'win32', homeDir: 'C:\\Users\\mineradio' }),
    'D:\\MineradioCache\\beatmaps'
  );
});

test('defaultBeatMapCacheDir uses Application Support on macOS', () => {
  assert.equal(
    defaultBeatMapCacheDir({ platform: 'darwin', homeDir: '/Users/mineradio' }),
    path.join('/Users/mineradio', 'Library', 'Application Support', 'Mineradio', 'beatmaps')
  );
});

test('defaultBeatMapCacheDir uses a dot cache directory on Linux-like platforms', () => {
  assert.equal(
    defaultBeatMapCacheDir({ platform: 'linux', homeDir: '/home/mineradio' }),
    path.join('/home/mineradio', '.mineradio', 'beatmaps')
  );
});
