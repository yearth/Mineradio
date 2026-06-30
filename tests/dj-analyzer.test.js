const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzePodcastDjIntro,
  analyzePodcastDjStream,
  buildBeatMapFromLowEnergy,
} = require('../dj-analyzer');

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

test('analyzePodcastDjStream rejects invalid audio URLs before fetching', async () => {
  const originalFetch = global.fetch;
  let fetched = false;
  global.fetch = async () => {
    fetched = true;
    return {};
  };

  try {
    await assert.rejects(
      analyzePodcastDjStream('file:///tmp/audio.mp3', { durationSec: 30 }),
      /Invalid audio url/,
    );
    assert.equal(fetched, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('analyzePodcastDjStream reports upstream fetch failures', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, opts });
    return { ok: false, status: 503, body: null };
  };

  try {
    await assert.rejects(
      analyzePodcastDjStream('https://audio.example/fail.mp3', { durationSec: 30, userAgent: 'Test UA' }),
      /Audio fetch failed: 503/,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, 'https://audio.example/fail.mp3');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Test UA');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');
  } finally {
    global.fetch = originalFetch;
  }
});

test('analyzePodcastDjIntro marks empty decoded audio as a partial intro map', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
  });

  try {
    const result = await analyzePodcastDjIntro('https://audio.example/empty.mp3', {
      durationSec: 360,
      introSec: 120,
      userAgent: 'Intro UA',
    });

    assert.equal(result.tempoSource, 'podcast-dj-server-intro-offline');
    assert.equal(result.partial, true);
    assert.equal(result.fullDuration, 360);
    assert.equal(result.partialUntilSec, 0);
    assert.equal(result.visualBeatCount, 0);
    assert.equal(result.decode.intro, true);
    assert.equal(result.decode.requestedDurationSec, 360);
    assert.equal(result.decode.effectiveDurationSec, 0);
    assert.equal(result.debug.intro, true);
  } finally {
    global.fetch = originalFetch;
  }
});
