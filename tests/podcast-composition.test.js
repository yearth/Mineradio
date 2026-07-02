const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPodcastRouteContext,
} = require('../server-dist/server/composition/podcast-context');

test('createPodcastRouteContext preserves podcast controller dependencies and snapshots route runtime values', () => {
  let cookie = 'cookie-a';
  const sendJSON = () => {};
  const logger = { log() {}, warn() {}, error() {} };
  const cloudsearch = async () => ({ body: {} });
  const deps = {
    sendJSON,
    cloudsearch,
    djHot: async () => ({ body: {} }),
    djDetail: async () => ({ body: {} }),
    djProgram: async () => ({ body: {} }),
    mapPodcastRadio: item => item,
    mapPodcastProgram: item => item,
    getLoginInfo: async () => ({ loggedIn: false }),
    fetchMyPodcastItems: async () => ({ itemType: 'radio', items: [] }),
    podcastCollectionMeta: (key, items) => ({ key, count: items.length }),
    analyzePodcastDjStream: async () => ({ visualBeatCount: 0 }),
    analyzePodcastDjIntro: async () => ({ visualBeatCount: 0 }),
    userAgent: 'MineradioTest/1.0',
    getUserCookie: () => cookie,
    timestamp: () => 123,
    now: () => 456,
    logger,
  };

  const ctx = createPodcastRouteContext(deps, {
    pathname: '/api/podcast/search',
    url: new URL('http://localhost/api/podcast/search?keywords=talk'),
    res: 'res',
  });

  assert.deepEqual(Object.keys(ctx), [
    'pathname',
    'url',
    'res',
    'sendJSON',
    'cloudsearch',
    'djHot',
    'djDetail',
    'djProgram',
    'mapPodcastRadio',
    'mapPodcastProgram',
    'getLoginInfo',
    'fetchMyPodcastItems',
    'podcastCollectionMeta',
    'analyzePodcastDjStream',
    'analyzePodcastDjIntro',
    'userAgent',
    'userCookie',
    'timestamp',
    'now',
    'logger',
  ]);
  assert.equal(ctx.sendJSON, sendJSON);
  assert.equal(ctx.cloudsearch, cloudsearch);
  assert.equal(ctx.userCookie, 'cookie-a');
  assert.equal(ctx.timestamp(), 123);
  assert.equal(ctx.now(), 456);
  assert.equal(ctx.logger, logger);

  cookie = 'cookie-b';
  const nextCtx = createPodcastRouteContext(deps, {
    pathname: '/api/podcast/hot',
    url: new URL('http://localhost/api/podcast/hot'),
    res: 'next-res',
  });
  assert.equal(ctx.userCookie, 'cookie-a');
  assert.equal(nextCtx.userCookie, 'cookie-b');
});
