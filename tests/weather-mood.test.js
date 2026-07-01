const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const server = require('../server');

function localHour(hour, minute) {
  return new Date(2026, 6, 1, hour, minute || 0);
}

test('buildWeatherMood maps humid weather into a warm low-density mood', () => {
  const mood = server.__test.buildWeatherMood({
    weatherCode: 1,
    temperature: 32,
    apparentTemperature: 35,
    humidity: 82,
    precipitation: 0,
    windSpeed: 9,
    isDay: 1,
  }, localHour(13));

  assert.equal(mood.key, 'humid');
  assert.equal(mood.title, '闷热电台');
  assert.equal(mood.warmth, 0.76);
  assert.equal(mood.keywords[0], '夏日 chill');
});

test('buildWeatherMood maps cloudy dusk into a sunset playlist', () => {
  const mood = server.__test.buildWeatherMood({
    weatherCode: 3,
    temperature: 19,
    apparentTemperature: 18,
    humidity: 66,
    precipitation: 0,
    windSpeed: 10,
    isDay: 1,
  }, localHour(18, 30));

  assert.equal(mood.key, 'cloudy');
  assert.equal(mood.title, '黄昏电台');
  assert.equal(mood.melancholy, 0.52);
  assert.deepEqual(mood.keywords.slice(0, 4), ['黄昏 city pop', '日落 歌单', '落日飞车', 'soul pop']);
});

test('buildWeatherMood lifts non-rainy morning energy', () => {
  const mood = server.__test.buildWeatherMood({
    weatherCode: 0,
    temperature: 20,
    apparentTemperature: 20,
    humidity: 50,
    precipitation: 0,
    windSpeed: 5,
    isDay: 1,
  }, localHour(7, 30));

  assert.equal(mood.key, 'clear');
  assert.equal(mood.title, '早晨电台');
  assert.equal(mood.energy, 0.62);
  assert.deepEqual(mood.keywords.slice(0, 2), ['早晨 通勤', 'morning acoustic']);
});
