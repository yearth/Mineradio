const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = require('../package.json');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

test('TypeScript migration tooling is wired for incremental refactors', () => {
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageJson.scripts['build:ts'], 'tsc');
  assert.match(packageJson.scripts.test, /^npm run build:ts && /);
  assert.ok(packageJson.devDependencies.typescript, 'typescript devDependency is required');
  assert.ok(fs.existsSync(path.join(root, 'tsconfig.json')), 'tsconfig.json is required');
  assert.ok(fs.existsSync(path.join(root, 'server', 'index.ts')), 'server/index.ts is required');
  assert.ok(fs.existsSync(path.join(root, 'server', 'router.ts')), 'server/router.ts is required');
  assert.ok(
    fs.existsSync(path.join(root, 'server', 'test-support', 'runtime.ts')),
    'server/test-support/runtime.ts is required'
  );
});

test('Electron package includes compiled server modules without replacing legacy entrypoints', () => {
  assert.equal(packageJson.main, 'desktop/main.js');
  assert.ok(packageJson.build.files.includes('server-dist/**/*'));
  assert.ok(packageJson.build.files.includes('server.js'));
  assert.ok(packageJson.build.files.includes('desktop/**/*'));
  assert.ok(packageJson.build.files.includes('public/**/*'));
  assert.match(gitignore, /^server-dist\/$/m);
  assert.match(packageJson.scripts['build:mac'], /^npm run build:ts && /);
  assert.match(packageJson.scripts['build:mac:dir'], /^npm run build:ts && /);
  assert.match(packageJson.scripts['build:win'], /^npm run build:ts && /);
  assert.match(packageJson.scripts['build:win:dir'], /^npm run build:ts && /);
});
