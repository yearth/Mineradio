const test = require('node:test');
const assert = require('node:assert/strict');

const {
  cleanReleaseLine,
  extractReleaseNotes,
  normalizeDigest,
  pickPatchAsset,
  pickReleaseAsset,
  safeUpdateFileName,
  updateAssetNameFromUrl,
} = require('../lib/update-utils');

function candidates(url) {
  return [{ url, label: 'direct', mirrored: false }];
}

test('pickReleaseAsset prefers installer assets over source archives', () => {
  const asset = pickReleaseAsset([
    { name: 'Source code.zip', browser_download_url: 'https://example.com/source.zip', size: 1 },
    { name: 'Mineradio-1.2.0-Setup.exe', browser_download_url: 'https://example.com/Mineradio-1.2.0-Setup.exe', size: 2, digest: 'sha256:ABCDEF' },
  ], { uniqueDownloadCandidates: candidates });

  assert.equal(asset.name, 'Mineradio-1.2.0-Setup.exe');
  assert.equal(asset.downloadUrl, 'https://example.com/Mineradio-1.2.0-Setup.exe');
  assert.deepEqual(asset.downloadUrls, ['https://example.com/Mineradio-1.2.0-Setup.exe']);
  assert.equal(asset.sha256, 'abcdef');
});

test('pickReleaseAsset falls back to archives and sha512 digests', () => {
  const asset = pickReleaseAsset([
    { name: 'Mineradio-portable.7z', browser_download_url: 'https://example.com/Mineradio.7z', digest: 'sha512:XYZ' },
  ], { uniqueDownloadCandidates: candidates });

  assert.equal(asset.name, 'Mineradio-portable.7z');
  assert.equal(asset.sha256, '');
  assert.equal(asset.sha512, 'XYZ');
});

test('pickReleaseAsset returns null when no assets are available', () => {
  assert.equal(pickReleaseAsset([]), null);
});

test('pickPatchAsset selects the patch matching current and latest versions', () => {
  const asset = pickPatchAsset([
    { name: 'Mineradio-1.1.0-to-1.1.1.patch.json', browser_download_url: 'https://example.com/old.patch.json' },
    { name: 'Mineradio-1.1.1-to-1.2.0.patch.json', browser_download_url: 'https://example.com/new.patch.json' },
  ], '1.1.1', '1.2.0', { uniqueDownloadCandidates: candidates });

  assert.equal(asset.name, 'Mineradio-1.1.1-to-1.2.0.patch.json');
  assert.equal(asset.downloadUrl, 'https://example.com/new.patch.json');
});

test('pickPatchAsset falls back to current-version patch assets', () => {
  const asset = pickPatchAsset([
    { name: 'Mineradio-1.1.1.patch', browser_download_url: 'https://example.com/current.patch' },
  ], '1.1.1', '', { uniqueDownloadCandidates: candidates });

  assert.equal(asset.name, 'Mineradio-1.1.1.patch');
  assert.deepEqual(asset.downloadUrls, ['https://example.com/current.patch']);
});

test('pickPatchAsset returns null when no patch assets are available', () => {
  assert.equal(pickPatchAsset([{ name: 'Mineradio-1.2.0-Setup.exe' }], '1.1.1', '1.2.0'), null);
});

test('safeUpdateFileName strips path separators and unsafe filename characters', () => {
  assert.equal(safeUpdateFileName('../Mineradio:1.2.0?.exe', '1.2.0'), '..-Mineradio-1.2.0-.exe');
  assert.equal(safeUpdateFileName('', '1.2.0'), 'Mineradio-1.2.0.exe');
  assert.equal(safeUpdateFileName('\x00', '1.2.0'), '-');
});

test('updateAssetNameFromUrl extracts the decoded basename without query string', () => {
  assert.equal(
    updateAssetNameFromUrl('https://example.com/download/Mineradio%201.2.0.dmg?token=abc'),
    'Mineradio 1.2.0.dmg'
  );
  assert.equal(updateAssetNameFromUrl('Mineradio-1.2.0.exe?token=abc'), 'Mineradio-1.2.0.exe');
});

test('extractReleaseNotes keeps short useful release lines', () => {
  const notes = extractReleaseNotes([
    '# 更新日志',
    '- 修复播放状态同步',
    '- 优化 macOS 预览启动',
    'https://example.com/full-changelog',
    '- ' + 'x'.repeat(90),
  ].join('\n'));

  assert.deepEqual(notes, ['修复播放状态同步', '优化 macOS 预览启动']);
  assert.equal(cleanReleaseLine('1. **修复播放状态同步**'), '修复播放状态同步');
});

test('normalizeDigest strips algorithm prefixes and quotes', () => {
  assert.equal(normalizeDigest('sha512:"ABC"', 'sha512'), 'ABC');
  assert.equal(normalizeDigest('', 'sha256'), '');
});
