const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWeatherMood,
  clampNumber,
  fallbackWeatherForRadio,
  isLowSignalWeatherSong,
  orderWeatherSongs,
  openMeteoWeatherLabel,
  scoreWeatherSong,
  weatherArtistKey,
  weatherRadioSeedQueries,
  weatherTitleKey,
} = require('../server-dist/server/services/weather-utils');

function localHour(hour, minute) {
  return new Date(2026, 6, 1, hour, minute || 0);
}

test('clampNumber preserves numeric fallback and bounds behavior', () => {
  assert.equal(clampNumber('', -90, 90, 12), 12);
  assert.equal(clampNumber('bad', -90, 90, 12), 12);
  assert.equal(clampNumber('45.5', -90, 90, 12), 45.5);
  assert.equal(clampNumber('-120', -90, 90, 12), -90);
  assert.equal(clampNumber('120', -90, 90, 12), 90);
});

test('openMeteoWeatherLabel preserves weather code buckets', () => {
  assert.equal(openMeteoWeatherLabel(0), '晴');
  assert.equal(openMeteoWeatherLabel(63), '雨');
  assert.equal(openMeteoWeatherLabel(95), '雷雨');
  assert.equal(openMeteoWeatherLabel(999), '天气');
});

test('buildWeatherMood preserves weather mood classification and time adjustments', () => {
  assert.deepEqual(buildWeatherMood({
    weatherCode: 95,
    temperature: 18,
    apparentTemperature: 18,
    precipitation: 0,
    humidity: 50,
    windSpeed: 30,
    isDay: 0,
  }, localHour(22)).keywords.slice(0, 2), ['公路 摇滚', 'windy day playlist']);

  const snowy = buildWeatherMood({
    weatherCode: 0,
    temperature: 2,
    apparentTemperature: 1,
    precipitation: 0,
    humidity: 55,
    windSpeed: 4,
    isDay: 1,
  }, localHour(13));
  assert.equal(snowy.key, 'snow');
  assert.equal(snowy.title, '冷空气电台');

  const rainyMorning = buildWeatherMood({
    weatherCode: 61,
    temperature: 15,
    apparentTemperature: 14,
    precipitation: 0,
    humidity: 60,
    windSpeed: 8,
    isDay: 1,
  }, localHour(7));
  assert.equal(rainyMorning.key, 'rain');
  assert.equal(rainyMorning.title, '雨晨电台');
});

test('weather radio helpers preserve seed and fallback weather behavior', () => {
  assert.deepEqual(weatherRadioSeedQueries({ key: 'storm-night' }).slice(0, 2), ['陈奕迅 阴天快乐', '周杰伦 雨下一整晚']);
  assert.deepEqual(weatherRadioSeedQueries({ key: 'snow' }).slice(0, 2), ['陈奕迅 好久不见', '莫文蔚 阴天']);
  assert.deepEqual(weatherRadioSeedQueries({ key: 'humid' }).slice(0, 2), ['落日飞车 My Jinji', '告五人 爱人错过']);
  assert.deepEqual(weatherRadioSeedQueries({ key: 'clear-night' }).slice(0, 2), ['方大同 特别的人', '陶喆 爱很简单']);
  assert.deepEqual(weatherRadioSeedQueries(null).slice(0, 2), ['孙燕姿 天黑黑', '周杰伦 晴天']);

  const fallback = fallbackWeatherForRadio(
    { city: '  杭州  ', timezone: 'Asia/Shanghai' },
    new Error('weather down'),
    { name: '上海', timezone: 'Asia/Shanghai' }
  );
  assert.equal(fallback.location.name, '杭州');
  assert.equal(fallback.label, '天气暂不可用');
  assert.equal(fallback.error, 'weather down');
  assert.equal(fallback.mood.key, 'fallback');
});

test('weather song helpers preserve low signal filtering and scoring keys', () => {
  assert.equal(isLowSignalWeatherSong({ name: '雨声 睡眠', artist: '自然声音' }), true);
  assert.equal(isLowSignalWeatherSong({ name: '阴天快乐', artist: '陈奕迅', album: '认了吧' }), false);
  assert.equal(weatherArtistKey({ artist: '陈奕迅 / 王菲' }), '陈奕迅');
  assert.equal(weatherArtistKey({ name: 'Unknown Song' }), 'unknown song');
  assert.equal(weatherTitleKey({ name: '阴天快乐（Live版）' }), '阴天快乐');

  const rainyScore = scoreWeatherSong({
    name: '阴天快乐',
    artist: '陈奕迅',
    album: '雨夜',
    cover: 'cover.jpg',
    duration: 188000,
    weatherSource: 'daily',
  }, { key: 'rain' });
  assert.equal(rainyScore, 27);
});

test('orderWeatherSongs preserves dedupe, ranking, low-signal filtering, and artist diversification', () => {
  const songs = [
    { id: 1, name: '阴天快乐', artist: '陈奕迅', album: '雨夜', cover: 'a.jpg', duration: 180000, weatherSource: 'daily' },
    { id: 1, name: '阴天快乐 duplicate', artist: '陈奕迅', album: '雨夜', cover: 'b.jpg', duration: 180000 },
    { id: 2, name: '阴天快乐（Live版）', artist: '陈奕迅', album: '现场', cover: 'c.jpg', duration: 180000 },
    { id: 3, name: '雨声 睡眠', artist: '自然声音', album: '白噪音' },
    { id: 4, name: '晴天', artist: '周杰伦', album: '叶惠美', cover: 'd.jpg', duration: 190000 },
    { id: 5, name: '遇见', artist: '孙燕姿', album: 'The Moment', cover: 'e.jpg', duration: 190000 },
  ];
  assert.deepEqual(orderWeatherSongs(songs, { key: 'rain' }).map(song => song.id), [1, 5, 4]);
});
