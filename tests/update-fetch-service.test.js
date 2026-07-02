const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchTextFromCandidates,
  localUpdateFallback,
} = require('../server-dist/server/services/update-fetch');

test('localUpdateFallback preserves legacy fallback update shape', () => {
  assert.deepEqual(localUpdateFallback('offline', {
    configured: true,
    preview: true,
    currentVersion: '1.1.1',
    fallbackNotes: ['ready'],
  }), {
    configured: true,
    preview: true,
    updateAvailable: false,
    currentVersion: '1.1.1',
    latestVersion: '1.1.1',
    release: {
      tagName: 'v1.1.1',
      name: 'Mineradio v1.1.1',
      version: '1.1.1',
      htmlUrl: '',
      downloadUrl: '',
      summary: '当前版本，更新检测已就绪。',
      notes: ['ready'],
    },
    reason: 'offline',
  });

  assert.equal(localUpdateFallback('', {
    currentVersion: '1.1.1',
    fallbackNotes: [],
  }).configured, false);
});

test('fetchTextFromCandidates returns the first successful text response', async () => {
  const calls = [];
  const result = await fetchTextFromCandidates([
    { url: 'https://mirror.example.com/latest.yml', label: '镜像' },
    { url: 'https://github.example.com/latest.yml', label: 'GitHub 直连' },
  ], {
    timeoutMs: 6500,
    userAgent: 'Mineradio/1.1.1',
    fetchWithTimeout: async (url, opts, timeoutMs) => {
      calls.push([url, opts.headers['User-Agent'], timeoutMs]);
      if (url.includes('mirror')) {
        return { ok: false, status: 502 };
      }
      return {
        ok: true,
        async text() {
          return 'version: 1.2.0';
        },
      };
    },
  });

  assert.deepEqual(calls, [
    ['https://mirror.example.com/latest.yml', 'Mineradio/1.1.1', 6500],
    ['https://github.example.com/latest.yml', 'Mineradio/1.1.1', 6500],
  ]);
  assert.equal(result.text, 'version: 1.2.0');
  assert.deepEqual(result.candidate, { url: 'https://github.example.com/latest.yml', label: 'GitHub 直连' });
});

test('fetchTextFromCandidates preserves legacy all-lines-failed error detail', async () => {
  await assert.rejects(
    fetchTextFromCandidates([
      { url: 'https://a.example.com/latest.yml', label: '线路 A' },
      { url: 'https://b.example.com/latest.yml', label: '线路 B' },
    ], {
      fetchWithTimeout: async url => {
        if (url.includes('a.')) throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
        return { ok: false, status: 404 };
      },
      classifyUpdateError(err) {
        return err.code === 'ENOTFOUND'
          ? { reason: '网络解析失败' }
          : { reason: '更新文件不存在，可能 release 资源还没有同步完成。' };
      },
    }),
    err => err && err.code === 'UPDATE_ALL_LINES_FAILED'
      && err.message === '线路 A: 网络解析失败；线路 B: 更新文件不存在，可能 release 资源还没有同步完成。'
  );
});

test('fetchTextFromCandidates reports the legacy empty-list failure', async () => {
  await assert.rejects(
    fetchTextFromCandidates([], { fetchWithTimeout: async () => null }),
    err => err && err.code === 'UPDATE_ALL_LINES_FAILED' && err.message === 'All update lines failed'
  );
});
