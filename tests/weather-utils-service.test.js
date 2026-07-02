const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWeatherMood,
  clampNumber,
  openMeteoWeatherLabel,
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
