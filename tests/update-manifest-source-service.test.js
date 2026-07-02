const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchManifestUpdateInfo,
  readUpdateManifest,
} = require('../server-dist/server/services/update-manifest-source');

test('readUpdateManifest rejects empty manifest references', async () => {
  await assert.rejects(
    readUpdateManifest('', {}),
    /UPDATE_MANIFEST_MISSING/
  );
});

test('readUpdateManifest reads local JSON paths and file URLs', async () => {
  const fsApi = {
    readFileSync(filePath) {
      assert.equal(filePath.endsWith('manifest.json'), true);
      return JSON.stringify({ latestVersion: '1.2.0' });
    },
  };
  const pathApi = {
    resolve(value) {
      return '/repo/' + value;
    },
  };

  assert.deepEqual(await readUpdateManifest('manifest.json', { fs: fsApi, path: pathApi }), {
    latestVersion: '1.2.0',
  });
  assert.deepEqual(await readUpdateManifest('file:///tmp/manifest.json', { fs: fsApi, path: pathApi }), {
    latestVersion: '1.2.0',
  });
});

test('readUpdateManifest fetches remote JSON with the Mineradio user agent', async () => {
  const calls = [];
  const data = await readUpdateManifest('https://updates.example.com/manifest.json', {
    userAgent: 'Mineradio/1.1.1',
    fetch: async (url, opts) => {
      calls.push([url, opts.headers['User-Agent']]);
      return {
        ok: true,
        async json() {
          return { latestVersion: '1.2.0' };
        },
      };
    },
  });

  assert.deepEqual(data, { latestVersion: '1.2.0' });
  assert.deepEqual(calls, [['https://updates.example.com/manifest.json', 'Mineradio/1.1.1']]);
});

test('readUpdateManifest preserves legacy remote HTTP errors', async () => {
  await assert.rejects(
    readUpdateManifest('https://updates.example.com/manifest.json', {
      fetch: async () => ({ ok: false, status: 503 }),
    }),
    /Update manifest 503/
  );
});

test('fetchManifestUpdateInfo normalizes manifest data and falls back on failures', async () => {
  const normalized = await fetchManifestUpdateInfo('manifest.json', {
    readManifest: async () => ({ latestVersion: '1.2.0' }),
    normalizeManifestUpdateInfo(data) {
      return { ok: true, latestVersion: data.latestVersion };
    },
    localUpdateFallback() {
      throw new Error('should not fallback');
    },
  });

  assert.deepEqual(normalized, { ok: true, latestVersion: '1.2.0' });

  const fallback = await fetchManifestUpdateInfo('manifest.json', {
    readManifest: async () => {
      throw new Error('bad manifest');
    },
    normalizeManifestUpdateInfo() {
      throw new Error('should not normalize');
    },
    localUpdateFallback(reason, opts) {
      return { reason, configured: opts.configured };
    },
  });

  assert.deepEqual(fallback, { reason: 'bad manifest', configured: true });
});
