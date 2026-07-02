const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
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
