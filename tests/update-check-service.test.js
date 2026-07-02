const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchLatestUpdateInfo,
  fetchLatestYmlUpdateInfo,
} = require('../server-dist/server/services/update-check');

function githubConfig(overrides = {}) {
  return Object.assign({
    configured: true,
    provider: 'github',
    owner: 'Xx Huberrr',
    repo: 'Mineradio App',
  }, overrides);
}

test('fetchLatestYmlUpdateInfo fetches latest.yml from release candidates', async () => {
  const calls = [];
  const info = await fetchLatestYmlUpdateInfo('GitHub Releases 500', {
    config: githubConfig(),
    updateError(code) {
      return Object.assign(new Error(code), { code });
    },
    uniqueDownloadCandidates(url) {
      calls.push(['candidates', url]);
      return [{ url: 'https://mirror.example.com/latest.yml', label: '镜像' }];
    },
    async fetchTextFromCandidates(candidates, timeoutMs) {
      calls.push(['fetch', candidates[0].url, timeoutMs]);
      return { text: 'version: 1.2.0' };
    },
    parseLatestYmlUpdateInfo(text, reason) {
      calls.push(['parse', text, reason]);
      return { source: 'latest-yml', reason };
    },
  });

  assert.deepEqual(calls, [
    ['candidates', 'https://github.com/Xx%20Huberrr/Mineradio%20App/releases/latest/download/latest.yml'],
    ['fetch', 'https://mirror.example.com/latest.yml', 6500],
    ['parse', 'version: 1.2.0', 'GitHub Releases 500'],
  ]);
  assert.deepEqual(info, { source: 'latest-yml', reason: 'GitHub Releases 500' });
});

test('fetchLatestYmlUpdateInfo rejects unconfigured repositories', async () => {
  await assert.rejects(
    fetchLatestYmlUpdateInfo('', {
      config: githubConfig({ configured: false }),
      updateError(code) {
        return Object.assign(new Error(code), { code });
      },
      uniqueDownloadCandidates() {
        throw new Error('should not build candidates');
      },
      fetchTextFromCandidates() {
        throw new Error('should not fetch');
      },
      parseLatestYmlUpdateInfo() {
        throw new Error('should not parse');
      },
    }),
    err => err && err.code === 'UPDATE_REPOSITORY_NOT_CONFIGURED'
  );
});

test('fetchLatestUpdateInfo keeps mac preview and manifest override branches outside GitHub fetch', async () => {
  const macFallback = await fetchLatestUpdateInfo({
    platform: () => 'darwin',
    manifestRef: () => '',
    config: githubConfig(),
    localUpdateFallback(reason, opts) {
      return { reason, opts };
    },
  });
  assert.match(macFallback.reason, /macOS 预览版暂不启用 Windows 更新通道/);
  assert.deepEqual(macFallback.opts, { configured: true });

  const manifestInfo = await fetchLatestUpdateInfo({
    platform: () => 'win32',
    manifestRef: () => '/tmp/manifest.json',
    config: githubConfig(),
    fetchManifestUpdateInfo: async ref => ({ manifest: ref }),
    localUpdateFallback() {
      throw new Error('should not fallback');
    },
  });
  assert.deepEqual(manifestInfo, { manifest: '/tmp/manifest.json' });
});

test('fetchLatestUpdateInfo maps successful GitHub release responses', async () => {
  const calls = [];
  const info = await fetchLatestUpdateInfo({
    platform: () => 'win32',
    manifestRef: () => '',
    config: githubConfig(),
    currentVersion: '1.1.1',
    fallbackNotes: ['fallback'],
    uniqueDownloadCandidates(urls) {
      return (Array.isArray(urls) ? urls : [urls]).filter(Boolean).map(url => ({ url }));
    },
    async fetch(url, opts) {
      calls.push([url, opts.headers['User-Agent'], opts.headers.Accept, !!opts.signal]);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            tag_name: 'v1.2.0',
            name: 'Mineradio v1.2.0',
            published_at: '2026-07-01T00:00:00Z',
            html_url: 'https://github.example/releases/v1.2.0',
            body: '- 新增更新检测\n- 修复播放',
            assets: [
              { name: 'Mineradio-1.2.0-Setup.exe', browser_download_url: 'https://cdn.example.com/setup.exe', size: 1234 },
              { name: 'Mineradio-1.1.1-to-1.2.0.patch.json', browser_download_url: 'https://cdn.example.com/patch.json', size: 234 },
            ],
          };
        },
      };
    },
  });

  assert.deepEqual(calls, [[
    'https://api.github.com/repos/Xx%20Huberrr/Mineradio%20App/releases/latest',
    'Mineradio/1.1.1',
    'application/vnd.github+json',
    true,
  ]]);
  assert.equal(info.configured, true);
  assert.equal(info.updateAvailable, true);
  assert.equal(info.latestVersion, '1.2.0');
  assert.equal(info.release.asset.name, 'Mineradio-1.2.0-Setup.exe');
  assert.equal(info.release.patch.name, 'Mineradio-1.1.1-to-1.2.0.patch.json');
  assert.deepEqual(info.release.notes, ['新增更新检测', '修复播放']);
});

test('fetchLatestUpdateInfo falls back through latest.yml before local fallback', async () => {
  const httpFallback = await fetchLatestUpdateInfo({
    platform: () => 'win32',
    manifestRef: () => '',
    config: githubConfig(),
    currentVersion: '1.1.1',
    async fetch() {
      return { ok: false, status: 503 };
    },
    async fetchLatestYmlUpdateInfo(reason) {
      return { source: 'latest-yml', reason };
    },
    localUpdateFallback() {
      throw new Error('should not fallback when latest.yml succeeds');
    },
  });
  assert.deepEqual(httpFallback, { source: 'latest-yml', reason: 'GitHub Releases 503' });

  const httpLocalFallback = await fetchLatestUpdateInfo({
    platform: () => 'win32',
    manifestRef: () => '',
    config: githubConfig(),
    currentVersion: '1.1.1',
    async fetch() {
      return { ok: false, status: 404 };
    },
    async fetchLatestYmlUpdateInfo() {
      throw new Error('latest.yml missing');
    },
    localUpdateFallback(reason, opts) {
      return { reason, opts };
    },
  });
  assert.deepEqual(httpLocalFallback, {
    reason: 'GitHub Releases 404',
    opts: { configured: true },
  });

  const networkFallback = await fetchLatestUpdateInfo({
    platform: () => 'win32',
    manifestRef: () => '',
    config: githubConfig(),
    currentVersion: '1.1.1',
    async fetch() {
      throw new Error('network down');
    },
    async fetchLatestYmlUpdateInfo() {
      throw new Error('all yml lines failed');
    },
    localUpdateFallback(reason, opts) {
      return { reason, opts };
    },
  });
  assert.deepEqual(networkFallback, {
    reason: 'all yml lines failed',
    opts: { configured: true },
  });
});
