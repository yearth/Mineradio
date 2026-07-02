const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchIpWeatherLocation,
  fetchOpenMeteoWeather,
  resolveOpenMeteoLocation,
} = require('../server-dist/server/services/weather-provider');

const defaultLocation = {
  name: '上海',
  country: '中国',
  admin1: '上海市',
  latitude: 31.2304,
  longitude: 121.4737,
  timezone: 'Asia/Shanghai',
};

test('resolveOpenMeteoLocation preserves blank, lookup, and fallback location behavior', async () => {
  const requests = [];
  const deps = {
    defaultLocation,
    geocodeUrl: 'https://geo.example/search',
    userAgent: 'MineradioTest',
    requestJson: async (targetUrl, opts) => {
      requests.push({ targetUrl, opts });
      return {
        results: [{
          name: '杭州',
          country: '中国',
          admin1: '浙江省',
          latitude: 30.2741,
          longitude: 120.1551,
          timezone: 'Asia/Shanghai',
        }],
      };
    },
  };

  assert.deepEqual(await resolveOpenMeteoLocation(' ', deps), defaultLocation);
  assert.deepEqual(await resolveOpenMeteoLocation('杭州', deps), {
    name: '杭州',
    country: '中国',
    admin1: '浙江省',
    latitude: 30.2741,
    longitude: 120.1551,
    timezone: 'Asia/Shanghai',
  });

  assert.equal(requests[0].targetUrl, 'https://geo.example/search?name=%E6%9D%AD%E5%B7%9E&count=1&language=zh&format=json');
  assert.deepEqual(requests[0].opts, { headers: { 'User-Agent': 'MineradioTest' } });

  const fallback = await resolveOpenMeteoLocation('不存在', {
    ...deps,
    requestJson: async () => ({ results: [] }),
  });
  assert.deepEqual(fallback, {
    ...defaultLocation,
    query: '不存在',
    fallback: true,
  });
});

test('fetchOpenMeteoWeather maps coordinate and geocoded forecast responses', async () => {
  const urls = [];
  const deps = {
    defaultLocation,
    geocodeUrl: 'https://geo.example/search',
    forecastUrl: 'https://forecast.example/v1/forecast',
    userAgent: 'MineradioTest',
    now: () => 12345,
    requestJson: async targetUrl => {
      urls.push(targetUrl);
      if (targetUrl.startsWith('https://geo.example')) {
        return {
          results: [{
            name: '苏州',
            country: '中国',
            latitude: 31.2989,
            longitude: 120.5853,
            timezone: 'Asia/Shanghai',
          }],
        };
      }
      return {
        timezone: 'Asia/Shanghai',
        current: {
          weather_code: 61,
          temperature_2m: 18,
          apparent_temperature: 17,
          relative_humidity_2m: 70,
          precipitation: 1.2,
          cloud_cover: 85,
          wind_speed_10m: 12,
          wind_gusts_10m: 22,
          is_day: 1,
          time: '2026-07-01T10:00',
        },
      };
    },
  };

  const coordinateWeather = await fetchOpenMeteoWeather({
    lat: '31.2',
    lon: '121.4',
    city: '  浦东  ',
    timezone: 'Asia/Shanghai',
  }, deps);
  assert.equal(coordinateWeather.location.name, '浦东');
  assert.equal(coordinateWeather.location.latitude, 31.2);
  assert.equal(coordinateWeather.location.longitude, 121.4);
  assert.equal(coordinateWeather.updatedAt, 12345);
  assert.equal(coordinateWeather.label, '雨');
  assert.equal(coordinateWeather.mood.key, 'rain');
  assert.equal(urls[0].startsWith('https://forecast.example/v1/forecast?latitude=31.2&longitude=121.4&current='), true);

  const geocodedWeather = await fetchOpenMeteoWeather({ city: '苏州' }, deps);
  assert.equal(geocodedWeather.location.name, '苏州');
  assert.equal(geocodedWeather.location.country, '中国');
  assert.equal(geocodedWeather.location.timezone, 'Asia/Shanghai');
  assert.equal(urls.some(url => url.startsWith('https://geo.example/search?name=%E8%8B%8F%E5%B7%9E')), true);
});

test('fetchIpWeatherLocation preserves success mapping and failure metadata', async () => {
  const success = await fetchIpWeatherLocation({
    defaultLocation,
    ipLocationUrl: 'https://ip.example/json',
    userAgent: 'MineradioTest',
    requestJson: async (targetUrl, opts) => {
      assert.equal(targetUrl, 'https://ip.example/json?fields=status%2Cmessage%2Ccountry%2CregionName%2Ccity%2Clat%2Clon%2Ctimezone%2Cquery&lang=zh-CN');
      assert.deepEqual(opts, { headers: { 'User-Agent': 'MineradioTest' } });
      return {
        status: 'success',
        city: '南京',
        regionName: '江苏省',
        country: '中国',
        lat: '32.0603',
        lon: '118.7969',
        timezone: 'Asia/Shanghai',
        query: '127.0.0.1',
      };
    },
  });
  assert.deepEqual(success, {
    provider: 'ip-api',
    city: '南京',
    region: '江苏省',
    country: '中国',
    latitude: 32.0603,
    longitude: 118.7969,
    timezone: 'Asia/Shanghai',
    ip: '127.0.0.1',
  });

  await assert.rejects(
    fetchIpWeatherLocation({
      defaultLocation,
      ipLocationUrl: 'https://ip.example/json',
      userAgent: 'MineradioTest',
      requestJson: async () => ({ status: 'fail', message: 'private range' }),
    }),
    err => {
      assert.equal(err.message, 'private range');
      assert.deepEqual(err.body, { status: 'fail', message: 'private range' });
      return true;
    }
  );
});
