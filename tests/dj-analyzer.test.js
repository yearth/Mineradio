const test = require('node:test');
const assert = require('node:assert/strict');

const { buildBeatMapFromLowEnergy } = require('../dj-analyzer');

function makePulseEnergy(frameCount, pulseEvery, pulseOffset) {
  const lowEnergy = new Float32Array(frameCount);
  const hitEnergy = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const phase = Math.abs(((i - pulseOffset) % pulseEvery + pulseEvery) % pulseEvery);
    const dist = Math.min(phase, pulseEvery - phase);
    const pulse = dist === 0 ? 1 : (dist === 1 ? 0.48 : (dist === 2 ? 0.18 : 0));
    const bed = 0.010 + (i % 11) * 0.00015;
    lowEnergy[i] = bed + pulse * 0.22;
    hitEnergy[i] = 0.006 + pulse * 0.16;
  }
  return { lowEnergy, hitEnergy };
}

test('buildBeatMapFromLowEnergy returns an empty map for short inputs', () => {
  const result = buildBeatMapFromLowEnergy(
    new Float32Array([0.01, 0.02, 0.01]),
    new Float32Array([0.01, 0.03, 0.01]),
    0.01,
    12,
  );

  assert.deepEqual(result.kicks, []);
  assert.deepEqual(result.beats, []);
  assert.deepEqual(result.pulseBeats, []);
  assert.deepEqual(result.cameraBeats, []);
  assert.equal(result.duration, 12);
  assert.equal(result.visualBeatCount, 0);
  assert.equal(result.tempoSource, 'podcast-dj-server-empty');
  assert.equal(typeof result.analyzedAt, 'number');
});

test('buildBeatMapFromLowEnergy returns an empty map when long input has no usable onsets', () => {
  const lowEnergy = new Float32Array(240).fill(0.01);
  const hitEnergy = new Float32Array(240).fill(0.006);

  const result = buildBeatMapFromLowEnergy(lowEnergy, hitEnergy, 0.02, 0);

  assert.deepEqual(result.kicks, []);
  assert.deepEqual(result.beats, []);
  assert.deepEqual(result.pulseBeats, []);
  assert.deepEqual(result.cameraBeats, []);
  assert.equal(result.duration, 4.8);
  assert.equal(result.visualBeatCount, 0);
  assert.equal(result.tempoSource, 'podcast-dj-server-empty');
});

test('buildBeatMapFromLowEnergy builds a visual beat grid from repeated low-energy pulses', () => {
  const hopSec = 0.01;
  const { lowEnergy, hitEnergy } = makePulseEnergy(1200, 50, 30);

  const result = buildBeatMapFromLowEnergy(lowEnergy, hitEnergy, hopSec, 12);

  assert.equal(result.tempoSource, 'podcast-dj-server-low-offline');
  assert.equal(result.duration, 12);
  assert.ok(result.beats.length >= 18);
  assert.ok(result.cameraBeats.length > 0);
  assert.equal(result.visualBeatCount, result.cameraBeats.length);
  assert.ok(result.gridStep >= 0.32 && result.gridStep <= 0.86);
  assert.ok(Math.abs(result.gridStep - 0.5) < 0.08);
  assert.deepEqual(result.kicks, result.beats.map(beat => beat.time));
  assert.deepEqual(result.sectionSteps, [result.gridStep]);
  assert.equal(result.debug.hopSec, hopSec);
  assert.ok(result.debug.candidates > 0);

  const first = result.beats[0];
  assert.equal(first.dj, true);
  assert.equal(first.grid, true);
  assert.equal(first.server, true);
  assert.equal(first.kickOnly, true);
  assert.equal(first.index, 0);
  assert.ok(['downbeat', 'push', 'drop', 'rebound', 'accent'].includes(first.combo));
  assert.ok(first.time >= 0 && first.time < 12);
  assert.ok(first.impact >= 0 && first.impact <= 0.88);
  assert.ok(first.strength >= 0 && first.strength <= 0.93);
  assert.ok(first.confidence >= 0.44 && first.confidence <= 0.99);
});
