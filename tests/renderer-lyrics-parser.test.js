const test = require('node:test');
const assert = require('node:assert/strict');

const {
  lyricTagTimeToSeconds,
  parseLyricText,
  parseYrcText,
  finalizeLyricLineDurations,
} = require('../public/renderer/core/lyrics-parser');

test('lyricTagTimeToSeconds handles minute, second, and fractional tags', () => {
  assert.equal(lyricTagTimeToSeconds('01', '02', '345'), 62.345);
  assert.equal(lyricTagTimeToSeconds('01', '02', '3'), 62.3);
  assert.equal(lyricTagTimeToSeconds('bad', '02', ''), 2);
});

test('parseLyricText supports repeated timestamps and inferred durations', () => {
  const lines = parseLyricText('[00:01.00][00:02.50]Hello\n[00:05.00]World\nNo tag');

  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map(line => line.text), ['Hello', 'Hello', 'World']);
  assert.deepEqual(lines.map(line => line.t), [1, 2.5, 5]);
  assert.equal(lines[0].duration, 1.5);
  assert.equal(lines[1].duration, 2.5);
  assert.equal(lines[2].duration, 4.8);
  assert.equal(lines[0].source, 'lrc');
});

test('parseYrcText preserves word timings and normalizes text', () => {
  const lines = parseYrcText('[1000,3000](0,1000,0)Hel (1000,900,0)lo');

  assert.equal(lines.length, 1);
  assert.equal(lines[0].t, 1);
  assert.equal(lines[0].duration, 3);
  assert.equal(lines[0].text, 'Hel lo');
  assert.equal(lines[0].source, 'yrc-word');
  assert.deepEqual(lines[0].words.map(word => [word.text, word.t, word.d]), [
    ['Hel ', 1, 1],
    ['lo', 1, 0.9],
  ]);
});

test('finalizeLyricLineDurations sorts, clamps duration, and fills charCount', () => {
  const lines = finalizeLyricLineDurations([
    { t: 10, text: 'late', duration: 99 },
    { t: 1, text: 'early', duration: 0 },
    { t: 1.2, text: 'mid', duration: 0.1 },
  ]);

  assert.deepEqual(lines.map(line => line.text), ['early', 'mid', 'late']);
  assert.equal(lines[0].duration, 0.45);
  assert.equal(lines[1].duration, 0.45);
  assert.equal(lines[2].duration, 12);
  assert.equal(lines[0].charCount, 5);
});
