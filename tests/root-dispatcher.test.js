const test = require('node:test');
const assert = require('node:assert/strict');

const {
  dispatchRootRoute,
} = require('../server-dist/server/root-dispatcher');

function baseDeps(targetHandler = '') {
  const events = [];
  const makeFactory = name => (deps, route) => {
    events.push(`context:${name}:${route.pathname}`);
    return { deps, route, name };
  };
  const makeHandler = name => async () => {
    events.push(`handler:${name}`);
    return name === targetHandler;
  };
  const deps = {
    neteaseSongUrlRoute: '/api/song/url',
    rootDir: '/app/root',
    appRouteDependencies: {},
    updateRouteDependencies: {},
    beatmapRouteDependencies: {},
    createDiscoverRouteDependencies: () => {
      events.push('deps:discover');
      return {};
    },
    createWeatherRouteDependencies: () => {
      events.push('deps:weather');
      return {};
    },
    createSearchRouteDependencies: () => {
      events.push('deps:search');
      return {};
    },
    createQQRouteDependencies: () => {
      events.push('deps:qq');
      return {};
    },
    createPodcastRouteDependencies: () => {
      events.push('deps:podcast');
      return {};
    },
    createNeteaseMediaRouteDependencies: () => {
      events.push('deps:neteaseMedia');
      return {};
    },
    createNeteaseAuthRouteDependencies: () => {
      events.push('deps:neteaseAuth');
      return {};
    },
    createNeteaseLibraryRouteDependencies: () => {
      events.push('deps:neteaseLibrary');
      return {};
    },
    createMediaRouteDependencies: () => {
      events.push('deps:media');
      return {};
    },
    createAppRouteContext: makeFactory('app'),
    createUpdateRouteContext: makeFactory('update'),
    createBeatmapRouteContext: makeFactory('beatmap'),
    createDiscoverRouteContext: makeFactory('discover'),
    createWeatherRouteContext: makeFactory('weather'),
    createSearchRouteContext: makeFactory('search'),
    createQQRouteContext: makeFactory('qq'),
    createPodcastRouteContext: makeFactory('podcast'),
    createNeteaseMediaRouteContext: makeFactory('neteaseMedia'),
    createNeteaseAuthRouteContext: makeFactory('neteaseAuth'),
    createNeteaseLibraryRouteContext: makeFactory('neteaseLibrary'),
    createMediaRouteContext: makeFactory('media'),
    handleAppRoutes: makeHandler('app'),
    handleUpdateRoutes: makeHandler('update'),
    handleBeatmapRoutes: makeHandler('beatmap'),
    handleDiscoverRoutes: makeHandler('discover'),
    handleWeatherRoutes: makeHandler('weather'),
    handleSearchRoutes: makeHandler('search'),
    handleQQRoutes: makeHandler('qq'),
    handlePodcastPublicRoutes: makeHandler('podcastPublic'),
    handlePodcastAuthenticatedRoutes: makeHandler('podcastAuthenticated'),
    handleNeteaseMediaRoutes: makeHandler('neteaseMedia'),
    handleNeteaseAuthRoutes: makeHandler('neteaseAuth'),
    handlePodcastBeatmapRoutes: makeHandler('podcastBeatmap'),
    handleNeteaseLibraryRoutes: makeHandler('neteaseLibrary'),
    handleMediaRoutes: makeHandler('media'),
    resolveStaticFilePath: (pathname, rootDir) => {
      events.push(`resolveStatic:${pathname}:${rootDir}`);
      return '/app/root/public/index.html';
    },
    serveStatic: (res, filePath) => {
      events.push(`serveStatic:${res}:${filePath}`);
    },
  };
  return { deps, events };
}

function route(pathname) {
  return {
    pathname,
    url: new URL(`http://localhost${pathname}`),
    req: 'req',
    res: 'res',
  };
}

test('dispatchRootRoute preserves early Netease song URL dispatch before auth/library/media routes', async () => {
  const { deps, events } = baseDeps('neteaseMedia');

  assert.equal(await dispatchRootRoute(route('/api/song/url'), deps), true);

  assert.deepEqual(events, [
    'context:app:/api/song/url',
    'handler:app',
    'context:update:/api/song/url',
    'handler:update',
    'context:beatmap:/api/song/url',
    'handler:beatmap',
    'deps:discover',
    'context:discover:/api/song/url',
    'handler:discover',
    'deps:weather',
    'context:weather:/api/song/url',
    'handler:weather',
    'deps:search',
    'context:search:/api/song/url',
    'handler:search',
    'deps:qq',
    'context:qq:/api/song/url',
    'handler:qq',
    'deps:podcast',
    'context:podcast:/api/song/url',
    'handler:podcastPublic',
    'deps:podcast',
    'context:podcast:/api/song/url',
    'handler:podcastAuthenticated',
    'deps:neteaseMedia',
    'context:neteaseMedia:/api/song/url',
    'handler:neteaseMedia',
  ]);
});

test('dispatchRootRoute uses late Netease media dispatch for non-song-url media routes', async () => {
  const { deps, events } = baseDeps('neteaseMedia');

  assert.equal(await dispatchRootRoute(route('/api/lyric'), deps), true);

  assert.deepEqual(events.slice(-6), [
    'deps:neteaseLibrary',
    'context:neteaseLibrary:/api/lyric',
    'handler:neteaseLibrary',
    'deps:neteaseMedia',
    'context:neteaseMedia:/api/lyric',
    'handler:neteaseMedia',
  ]);
});

test('dispatchRootRoute falls back to static serving after all route handlers decline', async () => {
  const { deps, events } = baseDeps('');

  assert.equal(await dispatchRootRoute(route('/album-art.png'), deps), true);
  assert.deepEqual(events, [
    'context:app:/album-art.png',
    'handler:app',
    'context:update:/album-art.png',
    'handler:update',
    'context:beatmap:/album-art.png',
    'handler:beatmap',
    'deps:discover',
    'context:discover:/album-art.png',
    'handler:discover',
    'deps:weather',
    'context:weather:/album-art.png',
    'handler:weather',
    'deps:search',
    'context:search:/album-art.png',
    'handler:search',
    'deps:qq',
    'context:qq:/album-art.png',
    'handler:qq',
    'deps:podcast',
    'context:podcast:/album-art.png',
    'handler:podcastPublic',
    'deps:podcast',
    'context:podcast:/album-art.png',
    'handler:podcastAuthenticated',
    'deps:neteaseAuth',
    'context:neteaseAuth:/album-art.png',
    'handler:neteaseAuth',
    'deps:podcast',
    'context:podcast:/album-art.png',
    'handler:podcastBeatmap',
    'deps:neteaseLibrary',
    'context:neteaseLibrary:/album-art.png',
    'handler:neteaseLibrary',
    'deps:neteaseMedia',
    'context:neteaseMedia:/album-art.png',
    'handler:neteaseMedia',
    'deps:media',
    'context:media:/album-art.png',
    'handler:media',
    'resolveStatic:/album-art.png:/app/root',
    'serveStatic:res:/app/root/public/index.html',
  ]);
});
