const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppRouteContext,
  createDiscoverRouteContext,
  createWeatherRouteContext,
  createSearchRouteContext,
  createMediaRouteContext,
} = require('../server-dist/server/composition/simple-route-contexts');

test('simple route context builders preserve controller dependency contracts', () => {
  const sendJSON = () => {};
  const logger = { error() {} };
  const url = new URL('http://localhost/api/search?keywords=rain');
  const req = { headers: { range: 'bytes=0-99' } };
  const res = { writeHead() {}, write() {}, end() {} };

  const app = createAppRouteContext({
    sendJSON,
    packageInfo: { name: 'mineradio' },
    appVersion: '1.1.1',
    updateConfig: { provider: 'github' },
    buildAppVersionPayload: opts => opts,
  }, { pathname: '/api/app/version', res: 'json-res' });
  assert.deepEqual(Object.keys(app), [
    'pathname',
    'res',
    'sendJSON',
    'packageInfo',
    'appVersion',
    'updateConfig',
    'buildAppVersionPayload',
  ]);
  assert.equal(app.sendJSON, sendJSON);
  assert.equal(app.res, 'json-res');

  const discover = createDiscoverRouteContext({
    sendJSON,
    handleDiscoverHome: async () => ({}),
    logger,
  }, { pathname: '/api/discover/home', res: 'discover-res' });
  assert.deepEqual(Object.keys(discover), ['pathname', 'res', 'sendJSON', 'handleDiscoverHome', 'logger']);
  assert.equal(discover.logger, logger);

  const weather = createWeatherRouteContext({
    sendJSON,
    buildWeatherRadio: async () => ({}),
    fetchIpWeatherLocation: async () => ({}),
    logger,
  }, { pathname: '/api/weather/radio', url, res: 'weather-res' });
  assert.deepEqual(Object.keys(weather), [
    'pathname',
    'url',
    'res',
    'sendJSON',
    'buildWeatherRadio',
    'fetchIpWeatherLocation',
    'logger',
  ]);
  assert.equal(weather.url, url);

  const search = createSearchRouteContext({
    sendJSON,
    handleSearch: async () => [],
    logger,
  }, { pathname: '/api/search', url, res: 'search-res' });
  assert.deepEqual(Object.keys(search), ['pathname', 'url', 'res', 'sendJSON', 'handleSearch', 'logger']);
  assert.equal(search.url, url);

  const media = createMediaRouteContext({
    fetch: async () => ({}),
    audioProxyHeadersFor: () => ({}),
    audioContentTypeForUrl: () => 'audio/mpeg',
    userAgent: 'MineradioTest/1.0',
    logger,
  }, { pathname: '/api/audio', url, req, res });
  assert.deepEqual(Object.keys(media), [
    'pathname',
    'url',
    'req',
    'res',
    'fetch',
    'audioProxyHeadersFor',
    'audioContentTypeForUrl',
    'userAgent',
    'logger',
  ]);
  assert.equal(media.req, req);
  assert.equal(media.res, res);
});
