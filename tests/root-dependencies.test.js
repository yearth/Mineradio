const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRootRouteDispatcherDependencies,
} = require('../server-dist/server/root-dependencies');
const {
  resolveStaticFilePath,
} = require('../server-dist/server/static-utils');
const {
  createAppRouteContext,
  createDiscoverRouteContext,
  createWeatherRouteContext,
  createSearchRouteContext,
  createMediaRouteContext,
} = require('../server-dist/server/composition/simple-route-contexts');
const {
  createUpdateRouteContext,
  createBeatmapRouteContext,
} = require('../server-dist/server/composition/ops-route-contexts');
const {
  createQQRouteContext,
} = require('../server-dist/server/composition/qq-context');
const {
  createPodcastRouteContext,
} = require('../server-dist/server/composition/podcast-context');
const {
  createNeteaseMediaRouteContext,
} = require('../server-dist/server/composition/netease-media-context');
const {
  createNeteaseAuthRouteContext,
} = require('../server-dist/server/composition/netease-auth-context');
const {
  createNeteaseLibraryRouteContext,
} = require('../server-dist/server/composition/netease-library-context');
const {
  handleAppRoutes,
} = require('../server-dist/server/controllers/app-controller');
const {
  handleUpdateRoutes,
} = require('../server-dist/server/controllers/update-controller');
const {
  handleBeatmapRoutes,
} = require('../server-dist/server/controllers/beatmap-controller');
const {
  handleDiscoverRoutes,
} = require('../server-dist/server/controllers/discover-controller');
const {
  handleWeatherRoutes,
} = require('../server-dist/server/controllers/weather-controller');
const {
  handleSearchRoutes,
} = require('../server-dist/server/controllers/search-controller');
const {
  handleQQRoutes,
} = require('../server-dist/server/controllers/qq-controller');
const {
  handlePodcastPublicRoutes,
  handlePodcastAuthenticatedRoutes,
  handlePodcastBeatmapRoutes,
} = require('../server-dist/server/controllers/podcast-controller');
const {
  handleNeteaseMediaRoutes,
} = require('../server-dist/server/controllers/netease-media-controller');
const {
  handleNeteaseAuthRoutes,
} = require('../server-dist/server/controllers/netease-auth-controller');
const {
  handleNeteaseLibraryRoutes,
} = require('../server-dist/server/controllers/netease-library-controller');
const {
  handleMediaRoutes,
} = require('../server-dist/server/controllers/media-controller');

function makeRootRuntime(events = []) {
  return {
    neteaseSongUrlRoute: '/api/song/url',
    rootDir: '/app/root',
    appRouteDependencies: { owner: 'app' },
    updateRouteDependencies: { owner: 'update' },
    beatmapRouteDependencies: { owner: 'beatmap' },
    createDiscoverRouteDependencies: () => {
      events.push('discover');
      return { owner: 'discover' };
    },
    createWeatherRouteDependencies: () => {
      events.push('weather');
      return { owner: 'weather' };
    },
    createSearchRouteDependencies: () => {
      events.push('search');
      return { owner: 'search' };
    },
    createQQRouteDependencies: () => {
      events.push('qq');
      return { owner: 'qq' };
    },
    createPodcastRouteDependencies: () => {
      events.push('podcast');
      return { owner: 'podcast' };
    },
    createNeteaseMediaRouteDependencies: () => {
      events.push('netease-media');
      return { owner: 'netease-media' };
    },
    createNeteaseAuthRouteDependencies: () => {
      events.push('netease-auth');
      return { owner: 'netease-auth' };
    },
    createNeteaseLibraryRouteDependencies: () => {
      events.push('netease-library');
      return { owner: 'netease-library' };
    },
    createMediaRouteDependencies: () => {
      events.push('media');
      return { owner: 'media' };
    },
    serveStatic: () => {},
  };
}

test('createRootRouteDispatcherDependencies assembles the dispatcher dependency table', () => {
  const runtime = makeRootRuntime();
  const deps = createRootRouteDispatcherDependencies(runtime);

  assert.deepEqual(Object.keys(deps), [
    'neteaseSongUrlRoute',
    'rootDir',
    'appRouteDependencies',
    'updateRouteDependencies',
    'beatmapRouteDependencies',
    'createDiscoverRouteDependencies',
    'createWeatherRouteDependencies',
    'createSearchRouteDependencies',
    'createQQRouteDependencies',
    'createPodcastRouteDependencies',
    'createNeteaseMediaRouteDependencies',
    'createNeteaseAuthRouteDependencies',
    'createNeteaseLibraryRouteDependencies',
    'createMediaRouteDependencies',
    'createAppRouteContext',
    'createUpdateRouteContext',
    'createBeatmapRouteContext',
    'createDiscoverRouteContext',
    'createWeatherRouteContext',
    'createSearchRouteContext',
    'createQQRouteContext',
    'createPodcastRouteContext',
    'createNeteaseMediaRouteContext',
    'createNeteaseAuthRouteContext',
    'createNeteaseLibraryRouteContext',
    'createMediaRouteContext',
    'handleAppRoutes',
    'handleUpdateRoutes',
    'handleBeatmapRoutes',
    'handleDiscoverRoutes',
    'handleWeatherRoutes',
    'handleSearchRoutes',
    'handleQQRoutes',
    'handlePodcastPublicRoutes',
    'handlePodcastAuthenticatedRoutes',
    'handleNeteaseMediaRoutes',
    'handleNeteaseAuthRoutes',
    'handlePodcastBeatmapRoutes',
    'handleNeteaseLibraryRoutes',
    'handleMediaRoutes',
    'resolveStaticFilePath',
    'serveStatic',
  ]);

  assert.equal(deps.neteaseSongUrlRoute, runtime.neteaseSongUrlRoute);
  assert.equal(deps.rootDir, runtime.rootDir);
  assert.equal(deps.appRouteDependencies, runtime.appRouteDependencies);
  assert.equal(deps.updateRouteDependencies, runtime.updateRouteDependencies);
  assert.equal(deps.beatmapRouteDependencies, runtime.beatmapRouteDependencies);
  assert.equal(deps.createDiscoverRouteDependencies, runtime.createDiscoverRouteDependencies);
  assert.equal(deps.createWeatherRouteDependencies, runtime.createWeatherRouteDependencies);
  assert.equal(deps.createSearchRouteDependencies, runtime.createSearchRouteDependencies);
  assert.equal(deps.createQQRouteDependencies, runtime.createQQRouteDependencies);
  assert.equal(deps.createPodcastRouteDependencies, runtime.createPodcastRouteDependencies);
  assert.equal(deps.createNeteaseMediaRouteDependencies, runtime.createNeteaseMediaRouteDependencies);
  assert.equal(deps.createNeteaseAuthRouteDependencies, runtime.createNeteaseAuthRouteDependencies);
  assert.equal(deps.createNeteaseLibraryRouteDependencies, runtime.createNeteaseLibraryRouteDependencies);
  assert.equal(deps.createMediaRouteDependencies, runtime.createMediaRouteDependencies);
  assert.equal(deps.serveStatic, runtime.serveStatic);

  assert.equal(deps.createAppRouteContext, createAppRouteContext);
  assert.equal(deps.createUpdateRouteContext, createUpdateRouteContext);
  assert.equal(deps.createBeatmapRouteContext, createBeatmapRouteContext);
  assert.equal(deps.createDiscoverRouteContext, createDiscoverRouteContext);
  assert.equal(deps.createWeatherRouteContext, createWeatherRouteContext);
  assert.equal(deps.createSearchRouteContext, createSearchRouteContext);
  assert.equal(deps.createQQRouteContext, createQQRouteContext);
  assert.equal(deps.createPodcastRouteContext, createPodcastRouteContext);
  assert.equal(deps.createNeteaseMediaRouteContext, createNeteaseMediaRouteContext);
  assert.equal(deps.createNeteaseAuthRouteContext, createNeteaseAuthRouteContext);
  assert.equal(deps.createNeteaseLibraryRouteContext, createNeteaseLibraryRouteContext);
  assert.equal(deps.createMediaRouteContext, createMediaRouteContext);

  assert.equal(deps.handleAppRoutes, handleAppRoutes);
  assert.equal(deps.handleUpdateRoutes, handleUpdateRoutes);
  assert.equal(deps.handleBeatmapRoutes, handleBeatmapRoutes);
  assert.equal(deps.handleDiscoverRoutes, handleDiscoverRoutes);
  assert.equal(deps.handleWeatherRoutes, handleWeatherRoutes);
  assert.equal(deps.handleSearchRoutes, handleSearchRoutes);
  assert.equal(deps.handleQQRoutes, handleQQRoutes);
  assert.equal(deps.handlePodcastPublicRoutes, handlePodcastPublicRoutes);
  assert.equal(deps.handlePodcastAuthenticatedRoutes, handlePodcastAuthenticatedRoutes);
  assert.equal(deps.handleNeteaseMediaRoutes, handleNeteaseMediaRoutes);
  assert.equal(deps.handleNeteaseAuthRoutes, handleNeteaseAuthRoutes);
  assert.equal(deps.handlePodcastBeatmapRoutes, handlePodcastBeatmapRoutes);
  assert.equal(deps.handleNeteaseLibraryRoutes, handleNeteaseLibraryRoutes);
  assert.equal(deps.handleMediaRoutes, handleMediaRoutes);
  assert.equal(deps.resolveStaticFilePath, resolveStaticFilePath);
});

test('createRootRouteDispatcherDependencies keeps route dependency factories lazy', () => {
  const factoryCalls = [];

  createRootRouteDispatcherDependencies(makeRootRuntime(factoryCalls));

  assert.deepEqual(factoryCalls, []);
});
