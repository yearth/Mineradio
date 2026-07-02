const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildAppVersionPayload,
  readPackageInfo,
} = require('../server-dist/server/services/app-info');

test('readPackageInfo preserves package JSON parsing and empty fallback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-app-info-'));
  const packagePath = path.join(dir, 'package.json');

  fs.writeFileSync(packagePath, JSON.stringify({
    name: 'mineradio-test',
    productName: 'Mineradio Test',
    version: '9.9.9',
  }), 'utf8');

  assert.deepEqual(readPackageInfo(packagePath), {
    name: 'mineradio-test',
    productName: 'Mineradio Test',
    version: '9.9.9',
  });
  assert.deepEqual(readPackageInfo(path.join(dir, 'missing-package.json')), {});

  fs.writeFileSync(packagePath, '{bad json', 'utf8');
  assert.deepEqual(readPackageInfo(packagePath), {});
});

test('buildAppVersionPayload preserves app version response defaults and update metadata', () => {
  assert.deepEqual(buildAppVersionPayload({
    packageInfo: {},
    appVersion: '1.2.3',
    updateConfig: {
      provider: 'github',
      configured: true,
      owner: 'yearthmain',
      repo: 'Mineradio',
      preview: false,
      manifest: 'https://example.com/latest.json',
    },
  }), {
    name: 'mineradio',
    productName: 'Mineradio',
    version: '1.2.3',
    update: {
      provider: 'github',
      configured: true,
      owner: 'yearthmain',
      repo: 'Mineradio',
      preview: false,
      manifestOverride: true,
    },
  });

  assert.deepEqual(buildAppVersionPayload({
    packageInfo: {
      name: 'custom-radio',
      productName: 'Custom Radio',
    },
    appVersion: '2.0.0',
    updateConfig: {
      provider: 'local',
      configured: false,
      owner: '',
      repo: '',
      preview: true,
      manifest: '',
    },
  }), {
    name: 'custom-radio',
    productName: 'Custom Radio',
    version: '2.0.0',
    update: {
      provider: 'local',
      configured: false,
      owner: '',
      repo: '',
      preview: true,
      manifestOverride: false,
    },
  });
});
