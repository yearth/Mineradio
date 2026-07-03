const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchPodcastDetail,
  fetchPodcastHot,
  fetchPodcastPrograms,
  fetchPodcastSearch,
  fetchUserPodcastCollections,
  fetchUserPodcastCollectionItems,
} = require('../server-dist/server/services/podcast-orchestration');

function baseDeps(overrides = {}) {
  const calls = [];
  const warnings = [];
  return {
    calls,
    warnings,
    deps: {
      cloudsearch: async opts => {
        calls.push(['cloudsearch', opts]);
        return { body: { result: { djRadios: [{ id: 1 }, { id: 0 }], djRadiosCount: 9 } } };
      },
      djHot: async opts => {
        calls.push(['djHot', opts]);
        return { body: { data: [{ id: 7 }, { id: 0 }], hasMore: 1 } };
      },
      djDetail: async opts => {
        calls.push(['djDetail', opts]);
        return { body: { data: { id: opts.rid, name: 'Radio' } } };
      },
      djProgram: async opts => {
        calls.push(['djProgram', opts]);
        return {
          body: {
            programs: [
              { id: 1, name: 'Ep', radio: { id: opts.rid, name: 'Radio' } },
              { id: 2, name: '' },
            ],
            more: 1,
            count: 9,
          },
        };
      },
      mapPodcastRadio: item => item,
      mapPodcastProgram: (item, radio) => ({ ...item, radio }),
      getLoginInfo: async () => ({ loggedIn: true, userId: 42 }),
      fetchMyPodcastItems: async (key, info, limit, offset) => {
        calls.push(['fetchMyPodcastItems', { key, info, limit, offset }]);
        return { itemType: 'radio', items: [{ id: key, cover: `cover-${key}` }] };
      },
      podcastCollectionMeta: (key, items) => ({ key, count: items.length, cover: items[0] && items[0].cover || '' }),
      userCookie: 'cookie',
      timestamp: () => 1234,
      logger: { warn: (...args) => warnings.push(args) },
      ...overrides,
    },
  };
}

test('fetchPodcastSearch short-circuits blank keywords and maps search radios', async () => {
  const blank = baseDeps();
  assert.deepEqual(await fetchPodcastSearch('   ', 18, blank.deps), { podcasts: [] });
  assert.deepEqual(blank.calls, []);

  const found = baseDeps();
  assert.deepEqual(await fetchPodcastSearch('talk', 99, found.deps), {
    podcasts: [{ id: 1 }],
    total: 9,
  });
  assert.deepEqual(found.calls, [
    ['cloudsearch', { keywords: 'talk', type: 1009, limit: 30, cookie: 'cookie', timestamp: 1234 }],
  ]);
});

test('fetchPodcastHot maps hot radios and pagination', async () => {
  const { calls, deps } = baseDeps();

  const result = await fetchPodcastHot(3, 4, deps);

  assert.deepEqual(result, { podcasts: [{ id: 7 }], more: true });
  assert.deepEqual(calls, [
    ['djHot', { limit: 6, offset: 4, cookie: 'cookie', timestamp: 1234 }],
  ]);
});

test('fetchPodcastDetail maps detail payloads', async () => {
  const { calls, deps } = baseDeps();

  const result = await fetchPodcastDetail('903', deps);

  assert.deepEqual(result, { podcast: { id: '903', name: 'Radio' } });
  assert.deepEqual(calls, [
    ['djDetail', { rid: '903', cookie: 'cookie', timestamp: 1234 }],
  ]);
});

test('fetchPodcastPrograms maps programs with radio fallback and clamped params', async () => {
  const { calls, deps } = baseDeps();

  const result = await fetchPodcastPrograms('903', 99, 5, deps);

  assert.deepEqual(result, {
    radio: { id: '903', name: 'Radio' },
    programs: [{ id: 1, name: 'Ep', radio: { id: '903', name: 'Radio' } }],
    more: true,
    total: 9,
  });
  assert.deepEqual(calls, [
    ['djProgram', { rid: '903', limit: 60, offset: 5, asc: false, cookie: 'cookie', timestamp: 1234 }],
  ]);
});

test('fetchUserPodcastCollections returns logged-out defaults and logged-in summaries with per-source fallback', async () => {
  const loggedOut = baseDeps({
    getLoginInfo: async () => ({ loggedIn: false }),
  });
  assert.deepEqual(await fetchUserPodcastCollections(loggedOut.deps), {
    loggedIn: false,
    collections: [
      { key: 'collect', count: 0, cover: '' },
      { key: 'created', count: 0, cover: '' },
      { key: 'liked', count: 0, cover: '' },
    ],
  });
  assert.deepEqual(loggedOut.calls, []);

  const loggedIn = baseDeps({
    fetchMyPodcastItems: async (key, info, limit, offset) => {
      loggedInCalls.push(['fetchMyPodcastItems', { key, info, limit, offset }]);
      if (key === 'created') throw new Error('created failed');
      return { itemType: 'radio', items: [{ cover: `cover-${key}` }] };
    },
  });
  const loggedInCalls = loggedIn.calls;

  assert.deepEqual(await fetchUserPodcastCollections(loggedIn.deps), {
    loggedIn: true,
    collections: [
      { key: 'collect', count: 1, cover: 'cover-collect' },
      { key: 'created', count: 0, cover: '' },
      { key: 'liked', count: 1, cover: 'cover-liked' },
    ],
  });
  assert.deepEqual(loggedIn.calls.map(call => call[1].key), ['collect', 'created', 'liked']);
  assert.deepEqual(loggedIn.warnings[0].slice(0, 2), ['[MyPodcast]', 'created']);
});

test('fetchUserPodcastCollectionItems maps logged-out defaults and item payloads', async () => {
  const loggedOut = baseDeps({
    getLoginInfo: async () => ({ loggedIn: false }),
  });
  assert.deepEqual(await fetchUserPodcastCollectionItems('collect', 36, 0, loggedOut.deps), {
    loggedIn: false,
    items: [],
  });
  assert.deepEqual(loggedOut.calls, []);

  const loggedIn = baseDeps();
  assert.deepEqual(await fetchUserPodcastCollectionItems('paid', 12, 4, loggedIn.deps), {
    loggedIn: true,
    key: 'paid',
    count: 1,
    cover: 'cover-paid',
    itemType: 'radio',
    items: [{ id: 'paid', cover: 'cover-paid' }],
  });
  assert.deepEqual(loggedIn.calls, [
    ['fetchMyPodcastItems', { key: 'paid', info: { loggedIn: true, userId: 42 }, limit: 12, offset: 4 }],
  ]);
});
