const test = require('node:test');
const assert = require('node:assert/strict');

const {
  cleanReleaseLine,
  extractReleaseNotes,
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

test('pickPatchAsset selects the patch matching current and latest versions', () => {
  const asset = pickPatchAsset([
    { name: 'Mineradio-1.1.0-to-1.1.1.patch.json', browser_download_url: 'https://example.com/old.patch.json' },
    { name: 'Mineradio-1.1.1-to-1.2.0.patch.json', browser_download_url: 'https://example.com/new.patch.json' },
  ], '1.1.1', '1.2.0', { uniqueDownloadCandidates: candidates });

  assert.equal(asset.name, 'Mineradio-1.1.1-to-1.2.0.patch.json');
  assert.equal(asset.downloadUrl, 'https://example.com/new.patch.json');
});

test('safeUpdateFileName strips path separators and unsafe filename characters', () => {
  assert.equal(safeUpdateFileName('../Mineradio:1.2.0?.exe', '1.2.0'), '..-Mineradio-1.2.0-.exe');
  assert.equal(safeUpdateFileName('', '1.2.0'), 'Mineradio-1.2.0.exe');
});

test('updateAssetNameFromUrl extracts the decoded basename without query string', () => {
  assert.equal(
    updateAssetNameFromUrl('https://example.com/download/Mineradio%201.2.0.dmg?token=abc'),
    'Mineradio 1.2.0.dmg'
  );
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

