const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createUpdateRouteContext,
  createBeatmapRouteContext,
} = require('../server-dist/server/composition/ops-route-contexts');

test('ops route context builders preserve update and beatmap controller contracts', () => {
  const sendJSON = () => {};
  const jobs = new Map();
  const logger = { error() {} };
  const updateUrl = new URL('http://localhost/api/update/latest');
  const update = createUpdateRouteContext({
    sendJSON,
    fetchLatestUpdateInfo: async () => ({ ok: true }),
    localUpdateFallback: () => ({ fallback: true }),
    updateConfig: { configured: true },
    startUpdateDownloadJob: () => ({ ok: true }),
    startUpdatePatchJob: () => ({ ok: true }),
    updateDownloadJobs: jobs,
    publicUpdateJob: job => job,
    logger,
  }, { pathname: '/api/update/latest', url: updateUrl, res: 'update-res' });

  assert.deepEqual(Object.keys(update), [
    'pathname',
    'url',
    'res',
    'sendJSON',
    'fetchLatestUpdateInfo',
    'localUpdateFallback',
    'updateConfig',
    'startUpdateDownloadJob',
    'startUpdatePatchJob',
    'updateDownloadJobs',
    'publicUpdateJob',
    'logger',
  ]);
  assert.equal(update.url, updateUrl);
  assert.equal(update.updateDownloadJobs, jobs);
  assert.equal(update.logger, logger);

  const req = { method: 'POST' };
  const beatmapUrl = new URL('http://localhost/api/beatmap/cache?key=song');
  const beatmap = createBeatmapRouteContext({
    sendJSON,
    readRequestBody: async () => ({}),
    beatCacheRootInfo: () => ({ allowed: true }),
    readBeatMapCache: () => null,
    writeBeatMapCache: body => body,
  }, { pathname: '/api/beatmap/cache', url: beatmapUrl, req, res: 'beatmap-res' });

  assert.deepEqual(Object.keys(beatmap), [
    'pathname',
    'url',
    'req',
    'res',
    'sendJSON',
    'readRequestBody',
    'beatCacheRootInfo',
    'readBeatMapCache',
    'writeBeatMapCache',
  ]);
  assert.equal(beatmap.url, beatmapUrl);
  assert.equal(beatmap.req, req);
  assert.equal(beatmap.res, 'beatmap-res');
});
