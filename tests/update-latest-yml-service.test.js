const test = require('node:test');
const assert = require('node:assert/strict');

const {
  githubReleaseDownloadUrl,
  parseLatestYmlUpdateInfo,
  yamlScalar,
} = require('../server-dist/server/services/update-latest-yml');

function testOptions(overrides = {}) {
  return Object.assign({
    currentVersion: '1.1.1',
    owner: 'Xx Huberrr',
    repo: 'Mineradio App',
    uniqueDownloadCandidates(urls) {
      return (Array.isArray(urls) ? urls : [urls])
        .filter(Boolean)
        .map(url => ({ url, label: 'direct', mirrored: false }));
    },
  }, overrides);
}

test('yamlScalar reads quoted values and escapes key names', () => {
  const text = [
    'version: "1.4.0"',
    'path.name: \'Mineradio Setup.exe\'',
    'sha512: abc123',
  ].join('\n');

  assert.equal(yamlScalar(text, 'version'), '1.4.0');
  assert.equal(yamlScalar(text, 'path.name'), 'Mineradio Setup.exe');
  assert.equal(yamlScalar(text, 'missing'), '');
  assert.equal(yamlScalar(null, 'version'), '');
});

test('githubReleaseDownloadUrl encodes repository and path segments', () => {
  const url = githubReleaseDownloadUrl('v1.4.0', 'release files/Mineradio Setup.exe', {
    owner: 'Xx Huberrr',
    repo: 'Mineradio App',
  });

  assert.equal(
    url,
    'https://github.com/Xx%20Huberrr/Mineradio%20App/releases/download/v1.4.0/release%20files/Mineradio%20Setup.exe'
  );
});

test('parseLatestYmlUpdateInfo maps latest.yml fields to update info', () => {
  const info = parseLatestYmlUpdateInfo([
    'version: 1.4.0',
    'path: release/Mineradio-1.4.0-Setup.exe',
    'sha512: sha512:ABC123',
    'size: 654321',
    'releaseDate: 2026-06-30T09:00:00.000Z',
  ].join('\n'), 'GitHub Releases 500', testOptions());

  assert.equal(info.configured, true);
  assert.equal(info.preview, false);
  assert.equal(info.updateAvailable, true);
  assert.equal(info.currentVersion, '1.1.1');
  assert.equal(info.latestVersion, '1.4.0');
  assert.equal(info.source, 'latest-yml');
  assert.equal(info.reason, 'GitHub Releases 500');
  assert.equal(info.release.tagName, 'v1.4.0');
  assert.equal(info.release.name, 'Mineradio v1.4.0');
  assert.equal(info.release.version, '1.4.0');
  assert.equal(info.release.publishedAt, '2026-06-30T09:00:00.000Z');
  assert.equal(info.release.htmlUrl, 'https://github.com/Xx Huberrr/Mineradio App/releases/tag/v1.4.0');
  assert.equal(info.release.downloadUrl, 'https://github.com/Xx%20Huberrr/Mineradio%20App/releases/download/v1.4.0/release/Mineradio-1.4.0-Setup.exe');
  assert.equal(info.release.asset.name, 'Mineradio-1.4.0-Setup.exe');
  assert.equal(info.release.asset.size, 654321);
  assert.equal(info.release.asset.contentType, 'application/octet-stream');
  assert.equal(info.release.asset.downloadUrl, info.release.downloadUrl);
  assert.deepEqual(info.release.asset.downloadUrls, [info.release.downloadUrl]);
  assert.equal(info.release.asset.sha256, '');
  assert.equal(info.release.asset.sha512, 'ABC123');
  assert.equal(info.release.patch, null);
  assert.equal(info.release.patchAvailable, false);
  assert.equal(info.release.summary, '发现新版本，已启用备用更新线路。');
  assert.deepEqual(info.release.notes, [
    '更新检测已切换到备用线路',
    '下载时会自动选择国内加速线路',
    '下载失败会显示具体原因和当前速度',
  ]);
});

test('parseLatestYmlUpdateInfo preserves legacy fallbacks for sparse latest.yml', () => {
  const info = parseLatestYmlUpdateInfo('', '', testOptions({
    currentVersion: '1.1.1',
    owner: 'XxHuberrr',
    repo: 'Mineradio',
  }));

  assert.equal(info.updateAvailable, false);
  assert.equal(info.latestVersion, '1.1.1');
  assert.equal(info.reason, '');
  assert.equal(info.release.publishedAt, '');
  assert.equal(info.release.downloadUrl, 'https://github.com/XxHuberrr/Mineradio/releases/download/v1.1.1/Mineradio-1.1.1-Setup.exe');
  assert.equal(info.release.asset.name, 'Mineradio-1.1.1-Setup.exe');
  assert.equal(info.release.asset.size, 0);
  assert.equal(info.release.asset.sha512, '');
});
