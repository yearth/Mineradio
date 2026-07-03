const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRootRouteRuntimeFactories,
} = require('../server-dist/server/root-runtime-factories');

function fn(name) {
  const f = () => name;
  f.id = name;
  return f;
}

function runtime(events = []) {
  const api = {
    cloudsearch: fn('cloudsearch'),
    djHot: fn('djHot'),
    djDetail: fn('djDetail'),
    djProgram: fn('djProgram'),
    lyricNew: fn('lyricNew:v1'),
    lyric: fn('lyric'),
    commentMusic: fn('commentMusic'),
    artistDetail: fn('artistDetail'),
    artistSongs: fn('artistSongs'),
    artistTopSong: fn('artistTopSong'),
    playlistTrackAll: fn('playlistTrackAll'),
    playlistDetail: fn('playlistDetail'),
    loginQrKey: fn('loginQrKey'),
    loginQrCreate: fn('loginQrCreate'),
    loginQrCheck: fn('loginQrCheck'),
    logout: fn('logout'),
    userPlaylist: fn('userPlaylist'),
    songLikeCheck: fn('songLikeCheck'),
    likelist: fn('likelist'),
    likeSong: fn('likeSong'),
    playlistCreate: fn('playlistCreate'),
    playlistTracks: fn('playlistTracks'),
    playlistTrackAdd: fn('playlistTrackAdd'),
  };
  const fetchRef = { current: fn('fetch:v1') };

  return {
    api,
    fetchRef,
    sendJSON: fn('sendJSON'),
    readRequestBody: fn('readRequestBody'),
    normalizeCookieHeader: fn('normalizeCookieHeader'),
    parseCookieString: fn('parseCookieString'),
    saveCookie: fn('saveCookie'),
    getUserCookie: fn('getUserCookie'),
    getLoginInfo: fn('getLoginInfo'),
    pendingNeteaseLoginInfo: fn('pendingNeteaseLoginInfo'),
    readCookieFromResponse: fn('readCookieFromResponse'),
    normalizeLoginInfo: fn('normalizeLoginInfo'),
    requireLogin: fn('requireLogin'),
    normalizeApiCode: fn('normalizeApiCode'),
    normalizeApiMessage: fn('normalizeApiMessage'),
    mapSongRecord: fn('mapSongRecord'),
    buildNeteaseSongCommentsPayload: fn('buildNeteaseSongCommentsPayload'),
    handleSongUrl: fn('handleSongUrl'),
    mapPodcastRadio: fn('mapPodcastRadio'),
    mapPodcastProgram: fn('mapPodcastProgram'),
    fetchMyPodcastItems: fn('fetchMyPodcastItems'),
    podcastCollectionMeta: fn('podcastCollectionMeta'),
    analyzePodcastDjStream: fn('analyzePodcastDjStream'),
    analyzePodcastDjIntro: fn('analyzePodcastDjIntro'),
    normalizeQQCookieInput: fn('normalizeQQCookieInput'),
    qqCookieUin: fn('qqCookieUin'),
    qqCookieMusicKey: fn('qqCookieMusicKey'),
    saveQQCookie: fn('saveQQCookie'),
    getQQLoginInfo: fn('getQQLoginInfo'),
    handleQQSearch: fn('handleQQSearch'),
    handleQQSongUrl: fn('handleQQSongUrl'),
    handleQQLyric: fn('handleQQLyric'),
    handleQQUserPlaylists: fn('handleQQUserPlaylists'),
    handleQQPlaylistTracks: fn('handleQQPlaylistTracks'),
    handleQQArtistDetail: fn('handleQQArtistDetail'),
    handleQQSongComments: fn('handleQQSongComments'),
    packageInfo: { version: '1.2.3' },
    appVersion: '1.2.3',
    updateConfig: { owner: 'update-config' },
    buildAppVersionPayload: fn('buildAppVersionPayload'),
    fetchLatestUpdateInfo: fn('fetchLatestUpdateInfo'),
    localUpdateFallback: fn('localUpdateFallback'),
    startUpdateDownloadJob: fn('startUpdateDownloadJob'),
    startUpdatePatchJob: fn('startUpdatePatchJob'),
    updateDownloadJobs: new Map(),
    publicUpdateJob: fn('publicUpdateJob'),
    beatCacheRootInfo: fn('beatCacheRootInfo'),
    readBeatMapCache: fn('readBeatMapCache'),
    writeBeatMapCache: fn('writeBeatMapCache'),
    handleDiscoverHome: fn('handleDiscoverHome'),
    buildWeatherRadio: fn('buildWeatherRadio'),
    fetchIpWeatherLocation: fn('fetchIpWeatherLocation'),
    handleSearch: fn('handleSearch'),
    audioProxyHeadersFor: fn('audioProxyHeadersFor'),
    audioContentTypeForUrl: fn('audioContentTypeForUrl'),
    userAgent: 'Mineradio/test',
    now: fn('now'),
    logger: { warn: fn('warn'), error: fn('error') },
    getNeteaseApi() {
      events.push('getNeteaseApi');
      return api;
    },
    getFetch() {
      events.push('getFetch');
      return fetchRef.current;
    },
  };
}

test('createRootRouteRuntimeFactories assembles stable root dependencies without calling lazy getters', () => {
  const events = [];
  const rt = runtime(events);
  const factories = createRootRouteRuntimeFactories(rt);

  assert.deepEqual(events, []);
  assert.deepEqual(Object.keys(factories), [
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
  ]);

  assert.equal(factories.appRouteDependencies.sendJSON, rt.sendJSON);
  assert.equal(factories.appRouteDependencies.packageInfo, rt.packageInfo);
  assert.equal(factories.appRouteDependencies.appVersion, rt.appVersion);
  assert.equal(factories.appRouteDependencies.updateConfig, rt.updateConfig);
  assert.equal(factories.appRouteDependencies.buildAppVersionPayload, rt.buildAppVersionPayload);
  assert.equal(factories.updateRouteDependencies.fetchLatestUpdateInfo, rt.fetchLatestUpdateInfo);
  assert.equal(factories.updateRouteDependencies.localUpdateFallback, rt.localUpdateFallback);
  assert.equal(factories.updateRouteDependencies.updateDownloadJobs, rt.updateDownloadJobs);
  assert.equal(factories.beatmapRouteDependencies.readRequestBody, rt.readRequestBody);
  assert.equal(factories.beatmapRouteDependencies.writeBeatMapCache, rt.writeBeatMapCache);
});

test('route factories read replaceable runtime values lazily', () => {
  const events = [];
  const rt = runtime(events);
  const factories = createRootRouteRuntimeFactories(rt);

  rt.api.lyricNew = fn('lyricNew:v2');
  rt.fetchRef.current = fn('fetch:v2');

  const neteaseMedia = factories.createNeteaseMediaRouteDependencies();
  const neteaseAuth = factories.createNeteaseAuthRouteDependencies();
  const neteaseLibrary = factories.createNeteaseLibraryRouteDependencies();
  const podcast = factories.createPodcastRouteDependencies();
  const qq = factories.createQQRouteDependencies();
  const discover = factories.createDiscoverRouteDependencies();
  const weather = factories.createWeatherRouteDependencies();
  const search = factories.createSearchRouteDependencies();
  const media = factories.createMediaRouteDependencies();

  assert.deepEqual(events, [
    'getNeteaseApi',
    'getNeteaseApi',
    'getNeteaseApi',
    'getNeteaseApi',
    'getFetch',
  ]);

  assert.equal(neteaseMedia.lyricNew.id, 'lyricNew:v2');
  assert.equal(neteaseMedia.getUserCookie, rt.getUserCookie);
  assert.equal(neteaseMedia.handleSongUrl, rt.handleSongUrl);
  assert.equal(neteaseAuth.loginQrKey, rt.api.loginQrKey);
  assert.equal(neteaseAuth.normalizeCookieHeader, rt.normalizeCookieHeader);
  assert.equal(neteaseLibrary.playlistTrackAdd, rt.api.playlistTrackAdd);
  assert.equal(neteaseLibrary.requireLogin, rt.requireLogin);
  assert.equal(podcast.cloudsearch, rt.api.cloudsearch);
  assert.equal(podcast.analyzePodcastDjIntro, rt.analyzePodcastDjIntro);
  assert.equal(qq.handleQQSongComments, rt.handleQQSongComments);
  assert.equal(qq.normalizeQQCookieInput, rt.normalizeQQCookieInput);
  assert.equal(discover.handleDiscoverHome, rt.handleDiscoverHome);
  assert.equal(weather.fetchIpWeatherLocation, rt.fetchIpWeatherLocation);
  assert.equal(search.handleSearch, rt.handleSearch);
  assert.equal(media.fetch.id, 'fetch:v2');
  assert.equal(media.userAgent, rt.userAgent);
});
