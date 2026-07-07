const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNeteaseRouteAdapters,
} = require('../server-dist/server/composition/netease-route-adapters');

function createAdapters(overrides = {}) {
  const calls = [];
  const services = {
    getNeteaseLoginInfo: async (cookie, deps) => {
      calls.push(['getNeteaseLoginInfo', cookie, deps]);
      return cookie ? { loggedIn: true, userId: 1 } : { loggedIn: false };
    },
    isNeteaseLoginReady: info => !!(info && info.loggedIn),
    neteaseLoginRequiredPayload: () => ({ error: 'LOGIN_REQUIRED' }),
    searchNeteaseSongs: async (keywords, limit, deps) => {
      calls.push(['searchNeteaseSongs', keywords, limit, deps]);
      return 'songs';
    },
    buildDiscoverHome: async deps => {
      calls.push(['buildDiscoverHome', deps]);
      return 'discover';
    },
    fetchNeteasePodcastCollectionItems: async (key, info, limit, offset, deps) => {
      calls.push(['fetchNeteasePodcastCollectionItems', key, info, limit, offset, deps]);
      return 'podcasts';
    },
    fetchNeteaseSongUrl: async (id, loginInfo, qualityPreference, deps) => {
      calls.push(['fetchNeteaseSongUrl', id, loginInfo, qualityPreference, deps]);
      return 'song-url';
    },
    mapSongRecord: song => song,
    mapDiscoverPlaylist: playlist => playlist,
    mapPodcastRadio: radio => radio,
    isLowSignalPodcastItem: item => !!item.lowSignal,
    firstArrayFrom: value => value,
    mapPodcastCollectionRadios: value => value,
    mapPodcastVoiceItems: value => value,
    normalizeQualityPreference: value => value || 'standard',
    hasNeteaseSvip: () => false,
    qualityCandidatesFrom: value => [value],
    classifyNeteasePlaybackRestriction: value => value,
  };
  let userCookie = 'MUSIC_U=old';
  const sendJSONCalls = [];
  const deps = {
    getUserCookie: () => userCookie,
    saveCookie: value => calls.push(['saveCookie', value]),
    sendJSON: (res, payload, status) => sendJSONCalls.push([res, payload, status]),
    getNeteaseApi: () => ({
      cloudsearch: async () => 'cloudsearch',
      songDetail: async () => 'songDetail',
      personalized: async () => 'personalized',
      djHot: async () => 'djHot',
      recommendResource: async () => 'recommendResource',
      recommendSongs: async () => 'recommendSongs',
      djSublist: async () => 'djSublist',
      userAudio: async () => 'userAudio',
      djPaygift: async () => 'djPaygift',
      satiResourceSubList: async () => 'satiResourceSubList',
      recordRecentVoice: async () => 'recordRecentVoice',
      songUrlV1: async () => 'songUrlV1',
      songUrl: async () => 'songUrl',
      loginStatus: async () => 'loginStatus',
      userAccount: async () => 'userAccount',
    }),
    now: () => 123,
    logger: { log() {}, warn: (...args) => calls.push(['warn', ...args]) },
    qualityCandidates: [{ level: 'standard' }],
    services,
    ...overrides,
  };
  return {
    calls,
    sendJSONCalls,
    setUserCookie(value) {
      userCookie = value;
    },
    adapters: createNeteaseRouteAdapters(deps),
  };
}

test('createNeteaseRouteAdapters exposes legacy Netease handler surface', () => {
  const { adapters } = createAdapters();

  assert.deepEqual(Object.keys(adapters), [
    'getLoginInfo',
    'requireLogin',
    'handleSearch',
    'handleDiscoverHome',
    'fetchMyPodcastItems',
    'handleSongUrl',
  ]);
});

test('createNeteaseRouteAdapters preserves login lookup and requireLogin behavior', async () => {
  const { adapters, calls, sendJSONCalls, setUserCookie } = createAdapters();

  assert.deepEqual(await adapters.getLoginInfo(), { loggedIn: true, userId: 1 });
  assert.equal(calls[0][0], 'getNeteaseLoginInfo');
  assert.equal(calls[0][1], 'MUSIC_U=old');
  assert.equal(typeof calls[0][2].loginStatus, 'function');
  assert.equal(typeof calls[0][2].saveCookie, 'function');
  assert.equal(typeof calls[0][2].userAccount, 'function');

  setUserCookie('');
  assert.equal(await adapters.requireLogin({ res: true }), null);
  assert.deepEqual(sendJSONCalls, [[{ res: true }, { error: 'LOGIN_REQUIRED' }, 401]]);
});

test('createNeteaseRouteAdapters wires search, discover, podcast, and song URL services lazily', async () => {
  let apiVersion = 'first';
  const { adapters, calls, setUserCookie } = createAdapters({
    getNeteaseApi: () => ({
      cloudsearch: async () => `cloudsearch:${apiVersion}`,
      songDetail: async () => `songDetail:${apiVersion}`,
      personalized: async () => `personalized:${apiVersion}`,
      djHot: async () => `djHot:${apiVersion}`,
      recommendResource: async () => `recommendResource:${apiVersion}`,
      recommendSongs: async () => `recommendSongs:${apiVersion}`,
      djSublist: async () => `djSublist:${apiVersion}`,
      userAudio: async () => `userAudio:${apiVersion}`,
      djPaygift: async () => `djPaygift:${apiVersion}`,
      satiResourceSubList: async () => `satiResourceSubList:${apiVersion}`,
      recordRecentVoice: async () => `recordRecentVoice:${apiVersion}`,
      songUrlV1: async () => `songUrlV1:${apiVersion}`,
      songUrl: async () => `songUrl:${apiVersion}`,
      loginStatus: async () => `loginStatus:${apiVersion}`,
      userAccount: async () => `userAccount:${apiVersion}`,
    }),
  });

  assert.equal(await adapters.handleSearch('rain', 5), 'songs');
  apiVersion = 'second';
  setUserCookie('MUSIC_U=new');
  assert.equal(await adapters.handleDiscoverHome(), 'discover');
  assert.equal(await adapters.fetchMyPodcastItems('liked', { userId: 1 }, 10, 0), 'podcasts');
  assert.equal(await adapters.handleSongUrl('101', { loggedIn: true }, 'exhigh'), 'song-url');

  const searchDeps = calls.find(call => call[0] === 'searchNeteaseSongs')[3];
  assert.equal(searchDeps.getUserCookie(), 'MUSIC_U=new');
  assert.equal(await searchDeps.cloudsearch(), 'cloudsearch:second');

  const discoverDeps = calls.find(call => call[0] === 'buildDiscoverHome')[1];
  assert.equal(discoverDeps.getUserCookie(), 'MUSIC_U=new');
  assert.equal(await discoverDeps.personalized(), 'personalized:second');
  assert.equal(discoverDeps.now(), 123);

  const podcastDeps = calls.find(call => call[0] === 'fetchNeteasePodcastCollectionItems')[5];
  assert.equal(podcastDeps.getUserCookie(), 'MUSIC_U=new');
  assert.equal(await podcastDeps.djSublist(), 'djSublist:second');

  const songUrlDeps = calls.find(call => call[0] === 'fetchNeteaseSongUrl')[4];
  assert.equal(songUrlDeps.getUserCookie(), 'MUSIC_U=new');
  assert.equal(await songUrlDeps.songUrlV1(), 'songUrlV1:second');
  assert.deepEqual(songUrlDeps.qualityCandidates, [{ level: 'standard' }]);
});
