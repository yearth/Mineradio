const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const {
  decodePatchFile,
  normalizePatchPayload,
  patchTargetPath,
  safePatchRelativePath,
} = require('../server-dist/server/services/update-patch-payload');

test('safePatchRelativePath normalizes allowed roots and explicit files', () => {
  assert.equal(safePatchRelativePath('/public\\images/app.png'), 'public/images/app.png');
  assert.equal(safePatchRelativePath('desktop/main.js'), 'desktop/main.js');
  assert.equal(safePatchRelativePath('build/icon.icns'), 'build/icon.icns');
  assert.equal(safePatchRelativePath('server.js'), 'server.js');
  assert.equal(safePatchRelativePath('package-lock.json'), 'package-lock.json');
});

test('safePatchRelativePath rejects empty, traversal, disallowed roots, and executable files', () => {
  assert.equal(safePatchRelativePath(''), '');
  assert.equal(safePatchRelativePath('public/\0bad.txt'), '');
  assert.equal(safePatchRelativePath('public/../server.js'), '');
  assert.equal(safePatchRelativePath('public/./app.txt'), '');
  assert.equal(safePatchRelativePath('updates/app.txt'), '');
  assert.equal(safePatchRelativePath('public/app.exe'), '');
  assert.equal(safePatchRelativePath('desktop/native.node'), '');
});

test('patchTargetPath resolves safe paths under the provided root', () => {
  const rootDir = path.join(os.tmpdir(), 'mineradio-patch-root');

  assert.equal(
    patchTargetPath('/public\\app.txt', rootDir),
    path.join(rootDir, 'public', 'app.txt')
  );
  assert.equal(patchTargetPath('../server.js', rootDir), null);
  assert.equal(patchTargetPath('updates/app.txt', rootDir), null);
  assert.equal(patchTargetPath('', rootDir), null);
});

test('decodePatchFile decodes base64 and utf8 patch file content', () => {
  assert.deepEqual(decodePatchFile(null), null);
  assert.deepEqual(decodePatchFile({}), null);
  assert.equal(decodePatchFile({ contentBase64: Buffer.from('hello').toString('base64') }).toString('utf8'), 'hello');
  assert.equal(decodePatchFile({ content: Buffer.from('world').toString('base64'), encoding: 'base64' }).toString('utf8'), 'world');
  assert.equal(decodePatchFile({ content: 'plain text' }).toString('utf8'), 'plain text');
});

test('normalizePatchPayload accepts legacy aliases and restart fallback', () => {
  const file = { path: 'public/app.txt', content: 'ok' };
  const payload = normalizePatchPayload({
    kind: 'mineradio-resource-patch',
    baseVersion: 'v1.1.1',
    targetVersion: 'v1.2.0',
    files: [file],
  }, { currentVersion: '1.1.1' });

  assert.equal(payload.from, '1.1.1');
  assert.equal(payload.to, '1.2.0');
  assert.deepEqual(payload.files, [file]);
  assert.equal(payload.restartRequired, true);

  const withoutRestart = normalizePatchPayload({
    from: '1.1.1',
    to: '1.2.0',
    restartRequired: false,
    files: [file],
  }, { currentVersion: '1.1.1' });

  assert.equal(withoutRestart.restartRequired, false);
});

test('normalizePatchPayload preserves legacy validation errors', () => {
  assert.throws(() => normalizePatchPayload(null, { currentVersion: '1.1.1' }), /INVALID_PATCH_PAYLOAD/);
  assert.throws(() => normalizePatchPayload({ type: 'other' }, { currentVersion: '1.1.1' }), /UNSUPPORTED_PATCH_TYPE/);
  assert.throws(() => normalizePatchPayload({ from: '1.0.0', to: '1.2.0', files: [{}] }, { currentVersion: '1.1.1' }), /PATCH_VERSION_MISMATCH/);
  assert.throws(() => normalizePatchPayload({ from: '1.1.1', to: '1.1.1', files: [{}] }, { currentVersion: '1.1.1' }), /PATCH_TARGET_VERSION_INVALID/);
  assert.throws(() => normalizePatchPayload({ from: '1.1.1', to: '1.2.0', files: [] }, { currentVersion: '1.1.1' }), /PATCH_EMPTY/);
  assert.throws(() => normalizePatchPayload({ from: '1.1.1', to: '1.2.0', files: Array.from({ length: 41 }, () => ({})) }, { currentVersion: '1.1.1' }), /PATCH_TOO_MANY_FILES/);
});
