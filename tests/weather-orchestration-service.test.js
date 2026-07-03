const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWeatherRadio,
} = require('../server-dist/server/services/weather-orchestration');
const {
  fallbackWeatherForRadio,
  orderWeatherSongs,
  weatherRadioSeedQueries,
} = require('../server-dist/server/services/weather-utils');

test('buildWeatherRadio builds a weather playlist from seed and mood keyword searches', async () => {
  const calls = [];
  const orderCalls = [];
  const weather = {
    mood: {
      key: 'rain',
      title: 'Rain Radio',
      tagline: 'Soft rainy tracks',
      keywords: ['雨天 R&B', 'lofi rainy'],
    },
  };
  const radio = await buildWeatherRadio({ city: 'Shanghai' }, {
    fetchWeather: async params => {
      calls.push(['weather', params]);
      return weather;
    },
    fallbackWeatherForRadio,
    weatherRadioSeedQueries: () => ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e'],
    searchSongs: async query => {
      calls.push(['search', query]);
      return [{ id: query, name: query, artist: query, cover: query }];
    },
    orderWeatherSongs: (songs, mood) => {
      orderCalls.push({ songs: songs.map(song => song.id), mood });
      return songs;
    },
    defaultLocation: { city: 'Hangzhou' },
    now: () => 1234,
    logger: { warn() {} },
  });

  assert.deepEqual(radio, {
    ok: true,
    weather,
    radio: {
      title: 'Rain Radio',
      subtitle: 'Soft rainy tracks',
      seedQueries: ['seed-a', 'seed-b', 'seed-c', 'seed-d'],
      songs: [
        { id: 'seed-a', name: 'seed-a', artist: 'seed-a', cover: 'seed-a' },
        { id: 'seed-b', name: 'seed-b', artist: 'seed-b', cover: 'seed-b' },
        { id: 'seed-c', name: 'seed-c', artist: 'seed-c', cover: 'seed-c' },
        { id: 'seed-d', name: 'seed-d', artist: 'seed-d', cover: 'seed-d' },
        { id: '雨天 R&B', name: '雨天 R&B', artist: '雨天 R&B', cover: '雨天 R&B' },
        { id: 'lofi rainy', name: 'lofi rainy', artist: 'lofi rainy', cover: 'lofi rainy' },
      ],
      updatedAt: 1234,
    },
  });
  assert.deepEqual(calls, [
    ['weather', { city: 'Shanghai' }],
    ['search', 'seed-a'],
    ['search', 'seed-b'],
    ['search', 'seed-c'],
    ['search', 'seed-d'],
    ['search', '雨天 R&B'],
    ['search', 'lofi rainy'],
  ]);
  assert.deepEqual(orderCalls, [{
    songs: ['seed-a', 'seed-b', 'seed-c', 'seed-d', '雨天 R&B', 'lofi rainy'],
    mood: weather.mood,
  }]);
});

test('buildWeatherRadio uses fallback weather and ignores failed searches', async () => {
  const warnings = [];
  const radio = await buildWeatherRadio({ city: 'Hangzhou' }, {
    fetchWeather: async () => { throw new Error('weather offline'); },
    fallbackWeatherForRadio: (params, error, defaultLocation) => ({
      mood: {
        key: 'fallback',
        title: defaultLocation.city + ' Fallback',
        tagline: error.message,
        keywords: ['fallback-extra'],
      },
      params,
    }),
    weatherRadioSeedQueries: () => ['first', 'second', 'third', 'fourth'],
    searchSongs: async query => {
      if (query === 'second') throw new Error('search offline');
      return [{ id: query, name: query, artist: query, cover: query }];
    },
    orderWeatherSongs,
    defaultLocation: { city: 'Default City' },
    now: () => 5678,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(radio.ok, true);
  assert.equal(radio.weather.mood.title, 'Default City Fallback');
  assert.deepEqual(radio.radio.seedQueries, ['first', 'second', 'third', 'fourth']);
  assert.equal(radio.radio.songs.some(song => song.id === 'second'), false);
  assert.equal(radio.radio.updatedAt, 5678);
  assert.deepEqual(warnings, [
    ['[WeatherRadio] weather provider failed, using fallback radio:', 'weather offline'],
  ]);
});

test('buildWeatherRadio caps weather songs to 18 results', async () => {
  const radio = await buildWeatherRadio({}, {
    fetchWeather: async () => ({
      mood: {
        key: 'sun',
        title: 'Sun Radio',
        tagline: 'Bright',
        keywords: [],
      },
    }),
    fallbackWeatherForRadio,
    weatherRadioSeedQueries,
    searchSongs: async query => Array.from({ length: 6 }, (_, index) => ({
      id: query + '-' + index,
      name: query + '-' + index,
      artist: 'artist-' + index,
      cover: 'cover-' + index,
    })),
    orderWeatherSongs: songs => songs,
    defaultLocation: {},
    now: () => 9012,
    logger: { warn() {} },
  });

  assert.equal(radio.radio.songs.length, 18);
  assert.equal(radio.radio.updatedAt, 9012);
});
