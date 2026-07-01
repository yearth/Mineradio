const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeManifestUpdateInfo,
} = require('../server-dist/server/services/update-manifest');

function testOptions() {
  return {
    currentVersion: '1.1.1',
    fallbackNotes: ['当前版本，更新检测已就绪。'],
    uniqueDownloadCandidates(urls) {
      return (Array.isArray(urls) ? urls : [urls])
        .filter(Boolean)
        .map(url => ({ url, label: 'direct', mirrored: false }));
    },
  };
}

test('normalizeManifestUpdateInfo maps manifest release, asset, patch, and notes', () => {
  const info = normalizeManifestUpdateInfo({
    version: 'v1.2.0',
    release: {
      name: 'Mineradio v1.2.0',
      published_at: '2026-07-01T00:00:00Z',
      html_url: 'https://example.com/releases/v1.2.0',
      downloadUrl: 'https://example.com/Mineradio-1.2.0-Setup.exe',
      asset: {
        size: 42,
        sha256: 'sha256:ABCDEF',
        downloadUrls: ['https://mirror.example.com/Mineradio-1.2.0-Setup.exe'],
      },
      patch: {
        downloadUrl: 'https://example.com/Mineradio-1.1.1-to-1.2.0.patch.json',
        size: 9,
        from: 'v1.1.1',
        to: 'v1.2.0',
        sha512: 'sha512:PATCHDIGEST',
      },
      notes: [' 修复播放状态同步 ', '', '- 优化 macOS 预览启动'],
    },
  }, testOptions());

  assert.equal(info.configured, true);
  assert.equal(info.preview, false);
  assert.equal(info.updateAvailable, true);
  assert.equal(info.currentVersion, '1.1.1');
  assert.equal(info.latestVersion, '1.2.0');
  assert.equal(info.release.tagName, 'v1.2.0');
  assert.equal(info.release.name, 'Mineradio v1.2.0');
  assert.equal(info.release.publishedAt, '2026-07-01T00:00:00Z');
  assert.equal(info.release.htmlUrl, 'https://example.com/releases/v1.2.0');
  assert.equal(info.release.asset.name, 'Mineradio-1.2.0-Setup.exe');
  assert.equal(info.release.asset.sha256, 'abcdef');
  assert.deepEqual(info.release.asset.downloadUrls, [
    'https://example.com/Mineradio-1.2.0-Setup.exe',
    'https://mirror.example.com/Mineradio-1.2.0-Setup.exe',
  ]);
  assert.equal(info.release.patch.name, 'Mineradio-1.1.1-to-1.2.0.patch.json');
  assert.equal(info.release.patch.from, '1.1.1');
  assert.equal(info.release.patch.to, '1.2.0');
  assert.equal(info.release.patch.sha512, 'PATCHDIGEST');
  assert.equal(info.release.patchAvailable, true);
  assert.deepEqual(info.release.notes, ['修复播放状态同步', '优化 macOS 预览启动']);
  assert.equal(info.source, 'manifest');
});

test('normalizeManifestUpdateInfo preserves legacy fallbacks and explicit updateAvailable', () => {
  const info = normalizeManifestUpdateInfo({
    updateAvailable: false,
    latestVersion: '1.5.0',
    body: [
      '# 更新日志',
      '- 修复下载线路选择',
      'https://example.com/full-changelog',
      '- ' + 'x'.repeat(90),
    ].join('\n'),
  }, testOptions());

  assert.equal(info.updateAvailable, false);
  assert.equal(info.latestVersion, '1.5.0');
  assert.equal(info.release.downloadUrl, '');
  assert.equal(info.release.asset, null);
  assert.equal(info.release.patch, null);
  assert.equal(info.release.patchAvailable, false);
  assert.deepEqual(info.release.notes, ['修复下载线路选择']);
  assert.equal(info.release.summary, '修复下载线路选择');
});

