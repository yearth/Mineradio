const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleWeatherRoutes,
} = require('../server-dist/server/controllers/weather-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    ctx: {
      pathname: '/api/weather/radio',
      url: new URL('http://127.0.0.1/api/weather/radio?city=%E4%B8%8A%E6%B5%B7&lat=31.23&lon=121.47&timezone=Asia%2FShanghai'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      buildWeatherRadio: async opts => ({ ok: true, opts }),
      fetchIpWeatherLocation: async () => ({ city: '上海' }),
      logger: {
        error: () => {},
      },
      ...overrides,
    },
    calls,
  };
}

test('handleWeatherRoutes handles weather radio with legacy query mapping', async () => {
  const { ctx, calls } = baseContext();

  const handled = await handleWeatherRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: {
      ok: true,
      opts: {
        city: '上海',
        lat: '31.23',
        lon: '121.47',
        timezone: 'Asia/Shanghai',
      },
    },
    status: undefined,
  }]);
});

test('handleWeatherRoutes maps q fallback for weather radio city', async () => {
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/weather/radio?q=%E5%8D%97%E4%BA%AC'),
  });

  const handled = await handleWeatherRoutes(ctx);

  assert.equal(handled, true);
  assert.equal(calls[0].data.opts.city, '南京');
  assert.equal(calls[0].data.opts.timezone, '');
});

test('handleWeatherRoutes returns legacy weather radio error payload', async () => {
  const logged = [];
  const { ctx, calls } = baseContext({
    buildWeatherRadio: async () => {
      throw new Error('weather failed');
    },
    logger: {
      error: (...args) => logged.push(args),
    },
  });

  const handled = await handleWeatherRoutes(ctx);

  assert.equal(handled, true);
  assert.equal(calls[0].status, 500);
  assert.deepEqual(calls[0].data, {
    ok: false,
    error: 'weather failed',
    weather: null,
    radio: { title: '天气电台', subtitle: '天气暂时没有回来，可以先听今日推荐。', seedQueries: [], songs: [] },
  });
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], '[WeatherRadio]');
});

test('handleWeatherRoutes handles IP weather location success and failure', async () => {
  const success = baseContext({
    pathname: '/api/weather/ip-location',
    url: new URL('http://127.0.0.1/api/weather/ip-location'),
  });
  const handledSuccess = await handleWeatherRoutes(success.ctx);

  assert.equal(handledSuccess, true);
  assert.deepEqual(success.calls, [{
    res: 'res',
    data: { ok: true, location: { city: '上海' } },
    status: undefined,
  }]);

  const logged = [];
  const failure = baseContext({
    pathname: '/api/weather/ip-location',
    url: new URL('http://127.0.0.1/api/weather/ip-location'),
    fetchIpWeatherLocation: async () => {
      throw new Error('ip failed');
    },
    logger: {
      error: (...args) => logged.push(args),
    },
  });
  const handledFailure = await handleWeatherRoutes(failure.ctx);

  assert.equal(handledFailure, true);
  assert.deepEqual(failure.calls, [{
    res: 'res',
    data: { ok: false, error: 'ip failed', location: null },
    status: 500,
  }]);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], '[WeatherIpLocation]');
});

test('handleWeatherRoutes ignores unrelated paths', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/search',
  });

  const handled = await handleWeatherRoutes(ctx);

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
