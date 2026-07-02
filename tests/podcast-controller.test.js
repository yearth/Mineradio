const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handlePodcastRoutes,
} = require('../server-dist/server/controllers/podcast-controller');

function baseContext(overrides = {}) {
  const calls = [];
  const logs = [];
  return {
    ctx: {
      pathname: '/api/podcast/dj-beatmap',
      url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=https%3A%2F%2Faudio.example%2Fmix.mp3&duration=360'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      analyzePodcastDjStream: async (audioUrl, opts) => ({ visualBeatCount: 4, decode: { stream: true }, audioUrl, opts }),
      analyzePodcastDjIntro: async (audioUrl, opts) => ({ visualBeatCount: 2, decode: { intro: true }, audioUrl, opts }),
      userAgent: 'MineradioTest/1.0',
      now: (() => {
        const values = [1000, 1250];
        return () => values.shift() || 1250;
      })(),
      logger: {
        log: (...args) => logs.push(['log', ...args]),
        error: (...args) => logs.push(['error', ...args]),
      },
      cloudsearch: async () => ({ body: { result: {} } }),
      djHot: async () => ({ body: {} }),
      djDetail: async () => ({ body: {} }),
      djProgram: async () => ({ body: {} }),
      mapPodcastRadio: item => item,
      mapPodcastProgram: (item, radio) => ({ ...item, radio }),
      getLoginInfo: async () => ({ loggedIn: false }),
      fetchMyPodcastItems: async () => ({ itemType: 'radio', items: [] }),
      podcastCollectionMeta: (key, items) => ({
        key,
        count: items.length,
        cover: items[0] && items[0].cover || '',
      }),
      userCookie: 'cookie',
      timestamp: () => 1234,
      ...overrides,
    },
    calls,
    logs,
  };
}

test('handlePodcastRoutes handles logged-out podcast collections', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my',
    url: new URL('http://127.0.0.1/api/podcast/my'),
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls[0], {
    res: 'res',
    data: {
      loggedIn: false,
      collections: [
        { key: 'collect', count: 0, cover: '' },
        { key: 'created', count: 0, cover: '' },
        { key: 'liked', count: 0, cover: '' },
      ],
    },
    status: undefined,
  });
});

test('handlePodcastRoutes summarizes logged-in podcast collections with per-source fallback', async () => {
  const itemCalls = [];
  const warnings = [];
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my',
    url: new URL('http://127.0.0.1/api/podcast/my'),
    getLoginInfo: async () => ({ loggedIn: true, userId: 42 }),
    fetchMyPodcastItems: async (key, info, limit, offset) => {
      itemCalls.push({ key, info, limit, offset });
      if (key === 'created') throw new Error('created failed');
      return { itemType: 'radio', items: [{ cover: `cover-${key}` }] };
    },
    logger: {
      log: () => {},
      error: () => {},
      warn: (...args) => warnings.push(args),
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(itemCalls.map(call => ({ key: call.key, limit: call.limit, offset: call.offset })), [
    { key: 'collect', limit: 12, offset: 0 },
    { key: 'created', limit: 12, offset: 0 },
    { key: 'liked', limit: 12, offset: 0 },
  ]);
  assert.equal(itemCalls[0].info.userId, 42);
  assert.deepEqual(calls[0].data, {
    loggedIn: true,
    collections: [
      { key: 'collect', count: 1, cover: 'cover-collect' },
      { key: 'created', count: 0, cover: '' },
      { key: 'liked', count: 1, cover: 'cover-liked' },
    ],
  });
  assert.deepEqual(warnings[0].slice(0, 2), ['[MyPodcast]', 'created']);
});

test('handlePodcastRoutes handles podcast collection summary failures', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my',
    url: new URL('http://127.0.0.1/api/podcast/my'),
    getLoginInfo: async () => {
      throw new Error('login failed');
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls[0], {
    res: 'res',
    data: { error: 'login failed', collections: [] },
    status: 500,
  });
});

test('handlePodcastRoutes handles logged-out podcast collection items', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my/items',
    url: new URL('http://127.0.0.1/api/podcast/my/items?key=collect'),
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls[0], {
    res: 'res',
    data: { loggedIn: false, items: [] },
    status: undefined,
  });
});

test('handlePodcastRoutes maps podcast collection item params and payload', async () => {
  const itemCalls = [];
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my/items',
    url: new URL('http://127.0.0.1/api/podcast/my/items?key=paid&limit=12&offset=4'),
    getLoginInfo: async () => ({ loggedIn: true, userId: 42 }),
    fetchMyPodcastItems: async (key, info, limit, offset) => {
      itemCalls.push({ key, info, limit, offset });
      return { itemType: 'radio', items: [{ id: 7, cover: 'paid-cover' }] };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(itemCalls, [{ key: 'paid', info: { loggedIn: true, userId: 42 }, limit: 12, offset: 4 }]);
  assert.deepEqual(calls[0].data, {
    loggedIn: true,
    key: 'paid',
    count: 1,
    cover: 'paid-cover',
    itemType: 'radio',
    items: [{ id: 7, cover: 'paid-cover' }],
  });
});

test('handlePodcastRoutes reports podcast collection item failures', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/my/items',
    url: new URL('http://127.0.0.1/api/podcast/my/items?key=collect'),
    getLoginInfo: async () => ({ loggedIn: true, userId: 42 }),
    fetchMyPodcastItems: async () => {
      throw new Error('items failed');
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls[0], {
    res: 'res',
    data: { error: 'items failed', items: [] },
    status: 500,
  });
});

test('handlePodcastRoutes handles blank podcast search without upstream calls', async () => {
  let called = false;
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/search',
    url: new URL('http://127.0.0.1/api/podcast/search?keywords=%20'),
    cloudsearch: async () => {
      called = true;
      return {};
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{ res: 'res', data: { podcasts: [] }, status: undefined }]);
  assert.equal(called, false);
});

test('handlePodcastRoutes maps podcast search params and totals', async () => {
  const callsToApi = [];
  const { ctx, calls } = baseContext({
    pathname: '/api/podcast/search',
    url: new URL('http://127.0.0.1/api/podcast/search?keywords=talk&limit=99'),
    cloudsearch: async opts => {
      callsToApi.push(opts);
      return {
        body: {
          result: {
            djRadios: [{ id: 1 }, { id: 0 }, { id: 2 }],
            djRadiosCount: 8,
          },
        },
      };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(callsToApi, [{ keywords: 'talk', type: 1009, limit: 30, cookie: 'cookie', timestamp: 1234 }]);
  assert.deepEqual(calls[0].data, { podcasts: [{ id: 1 }, { id: 2 }], total: 8 });
});

test('handlePodcastRoutes handles podcast hot params and errors', async () => {
  const hotCalls = [];
  const success = baseContext({
    pathname: '/api/podcast/hot',
    url: new URL('http://127.0.0.1/api/podcast/hot?limit=3&offset=4'),
    djHot: async opts => {
      hotCalls.push(opts);
      return { body: { data: [{ id: 7 }, { id: 0 }], hasMore: 1 } };
    },
  });

  const handledSuccess = await handlePodcastRoutes(success.ctx);

  assert.equal(handledSuccess, true);
  assert.deepEqual(hotCalls, [{ limit: 6, offset: 4, cookie: 'cookie', timestamp: 1234 }]);
  assert.deepEqual(success.calls[0].data, { podcasts: [{ id: 7 }], more: true });

  const failure = baseContext({
    pathname: '/api/podcast/hot',
    url: new URL('http://127.0.0.1/api/podcast/hot'),
    djHot: async () => {
      throw new Error('hot failed');
    },
  });
  const handledFailure = await handlePodcastRoutes(failure.ctx);

  assert.equal(handledFailure, true);
  assert.deepEqual(failure.calls[0], {
    res: 'res',
    data: { error: 'hot failed', podcasts: [] },
    status: 500,
  });
});

test('handlePodcastRoutes handles podcast detail missing id and success', async () => {
  const missing = baseContext({
    pathname: '/api/podcast/detail',
    url: new URL('http://127.0.0.1/api/podcast/detail'),
  });

  const handledMissing = await handlePodcastRoutes(missing.ctx);

  assert.equal(handledMissing, true);
  assert.deepEqual(missing.calls[0], {
    res: 'res',
    data: { error: 'Missing podcast id' },
    status: 400,
  });

  const detailCalls = [];
  const success = baseContext({
    pathname: '/api/podcast/detail',
    url: new URL('http://127.0.0.1/api/podcast/detail?rid=903'),
    djDetail: async opts => {
      detailCalls.push(opts);
      return { body: { data: { id: 903, name: 'Radio' } } };
    },
  });
  const handledSuccess = await handlePodcastRoutes(success.ctx);

  assert.equal(handledSuccess, true);
  assert.deepEqual(detailCalls, [{ rid: '903', cookie: 'cookie', timestamp: 1234 }]);
  assert.deepEqual(success.calls[0].data, { podcast: { id: 903, name: 'Radio' } });
});

test('handlePodcastRoutes handles podcast programs params and missing ids', async () => {
  const missing = baseContext({
    pathname: '/api/podcast/programs',
    url: new URL('http://127.0.0.1/api/podcast/programs'),
  });

  const handledMissing = await handlePodcastRoutes(missing.ctx);

  assert.equal(handledMissing, true);
  assert.deepEqual(missing.calls[0], {
    res: 'res',
    data: { error: 'Missing podcast id', programs: [] },
    status: 400,
  });

  const programCalls = [];
  const success = baseContext({
    pathname: '/api/podcast/programs',
    url: new URL('http://127.0.0.1/api/podcast/programs?id=903&limit=99&offset=5'),
    djProgram: async opts => {
      programCalls.push(opts);
      return {
        body: {
          programs: [
            { id: 1, name: 'Ep', radio: { id: 903, name: 'Radio' } },
            { id: 2, name: '' },
          ],
          more: 1,
          count: 9,
        },
      };
    },
  });
  const handledSuccess = await handlePodcastRoutes(success.ctx);

  assert.equal(handledSuccess, true);
  assert.deepEqual(programCalls, [{ rid: '903', limit: 60, offset: 5, asc: false, cookie: 'cookie', timestamp: 1234 }]);
  assert.deepEqual(success.calls[0].data, {
    radio: { id: 903, name: 'Radio' },
    programs: [{ id: 1, name: 'Ep', radio: { id: 903, name: 'Radio' } }],
    more: true,
    total: 9,
  });
});

test('handlePodcastRoutes rejects invalid DJ beatmap URLs before analysis', async () => {
  let analyzed = false;
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=file%3A%2F%2F%2Ftmp%2Faudio.mp3'),
    analyzePodcastDjStream: async () => {
      analyzed = true;
      return {};
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { error: 'Invalid audio url' },
    status: 400,
  }]);
  assert.equal(analyzed, false);
});

test('handlePodcastRoutes analyzes full DJ streams with legacy logging and payload', async () => {
  const analyzed = [];
  const { ctx, calls, logs } = baseContext({
    analyzePodcastDjStream: async (audioUrl, opts) => {
      analyzed.push({ audioUrl, opts });
      return { visualBeatCount: 4, decode: { stream: true } };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(analyzed, [{
    audioUrl: 'https://audio.example/mix.mp3',
    opts: { durationSec: 360, userAgent: 'MineradioTest/1.0' },
  }]);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { ok: true, map: { visualBeatCount: 4, decode: { stream: true } } },
    status: undefined,
  }]);
  assert.deepEqual(logs, [
    ['log', '[PodcastDjBeatmap] start', '360s'],
    ['log', '[PodcastDjBeatmap] done beats:', 4, 'ms:', 250, 'decode:', { stream: true }],
  ]);
});

test('handlePodcastRoutes uses intro analysis when intro seconds are present', async () => {
  const analyzed = [];
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=https%3A%2F%2Faudio.example%2Fmix.mp3&duration=360&intro=120'),
    analyzePodcastDjIntro: async (audioUrl, opts) => {
      analyzed.push({ audioUrl, opts });
      return { visualBeatCount: 2, decode: { intro: true } };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(analyzed, [{
    audioUrl: 'https://audio.example/mix.mp3',
    opts: { durationSec: 360, introSec: 120, userAgent: 'MineradioTest/1.0' },
  }]);
  assert.deepEqual(calls[0].data, { ok: true, map: { visualBeatCount: 2, decode: { intro: true } } });
});

test('handlePodcastRoutes reports DJ beatmap analysis failures', async () => {
  const { ctx, calls, logs } = baseContext({
    analyzePodcastDjStream: async () => {
      throw new Error('audio failed');
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { ok: false, error: 'audio failed' },
    status: 500,
  }]);
  assert.equal(logs[1][0], 'error');
  assert.equal(logs[1][1], '[PodcastDjBeatmap]');
});

test('handlePodcastRoutes ignores unrelated paths', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/search',
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
