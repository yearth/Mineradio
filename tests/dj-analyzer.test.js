const test = require('node:test');
const assert = require('node:assert/strict');

const {
  __test,
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

function makeFixtureMp3Bytes() {
  return Buffer.from('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', 'base64');
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

test('analyzePodcastDjStream returns an empty full-stream map for empty decoded audio', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, opts });
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    };
  };

  try {
    const result = await analyzePodcastDjStream('https://audio.example/empty.mp3', {
      durationSec: 30,
      userAgent: 'Stream UA',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, 'https://audio.example/empty.mp3');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Stream UA');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');
    assert.equal(result.tempoSource, 'podcast-dj-server-empty');
    assert.deepEqual(result.kicks, []);
    assert.deepEqual(result.beats, []);
    assert.equal(result.duration, 30);
    assert.equal(result.decode.chunks, 0);
    assert.equal(result.decode.decodedSamples, 0);
    assert.equal(result.decode.frames, 0);
    assert.equal(result.decode.requestedDurationSec, 30);
    assert.equal(result.decode.effectiveDurationSec, 0);
    assert.equal(result.decode.fullStreamQuality, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('analyzePodcastDjStream records decode metadata for non-empty full-stream audio', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const bytes = makeFixtureMp3Bytes();
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, opts });
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(0));
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    };
  };

  try {
    const result = await analyzePodcastDjStream('https://audio.example/pulse.mp3', {
      durationSec: 2,
      userAgent: 'Fixture UA',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, 'https://audio.example/pulse.mp3');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Fixture UA');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');
    assert.equal(result.tempoSource, 'podcast-dj-server-empty');
    assert.equal(result.decode.chunks, 1);
    assert.ok(result.decode.decodedSamples > 0);
    assert.ok(result.decode.frames > 0);
    assert.ok(result.decode.sampleRate > 0);
    assert.ok(result.decode.effectiveSampleRate > 0);
    assert.ok(result.decode.sampleRate >= result.decode.effectiveSampleRate);
    assert.equal(result.decode.requestedDurationSec, 2);
    assert.ok(result.decode.effectiveDurationSec > 0);
    assert.ok(result.decode.effectiveDurationSec < 2);
    assert.equal(result.duration, result.decode.effectiveDurationSec);
    assert.deepEqual(result.kicks, []);
    assert.deepEqual(result.beats, []);
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

test('analyzePodcastDjStream samples long podcasts with ranged empty audio', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (targetUrl, opts = {}) => {
    calls.push({ targetUrl, opts });
    if (opts.method === 'HEAD') {
      return {
        ok: true,
        status: 200,
        headers: { get: name => (String(name).toLowerCase() === 'content-length' ? '16000000' : '') },
      };
    }
    return {
      ok: true,
      status: 206,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    };
  };

  try {
    const result = await analyzePodcastDjStream('https://audio.example/long-empty.mp3', {
      durationSec: 8000,
      userAgent: 'Range UA',
    });

    assert.equal(calls.length, 9);
    assert.equal(calls[0].targetUrl, 'https://audio.example/long-empty.mp3');
    assert.equal(calls[0].opts.method, 'HEAD');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Range UA');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');

    const rangeCalls = calls.slice(1);
    assert.equal(rangeCalls.length, 8);
    assert.ok(rangeCalls.every(call => call.targetUrl === 'https://audio.example/long-empty.mp3'));
    assert.ok(rangeCalls.every(call => call.opts.headers['User-Agent'] === 'Range UA'));
    assert.ok(rangeCalls.every(call => call.opts.headers.Referer === 'https://music.163.com/'));
    assert.ok(rangeCalls.every(call => /^bytes=\d+-\d+$/.test(call.opts.headers.Range)));

    assert.equal(result.tempoSource, 'podcast-dj-server-range-empty');
    assert.equal(result.duration, 8000);
    assert.equal(result.visualBeatCount, 0);
    assert.deepEqual(result.kicks, []);
    assert.deepEqual(result.beats, []);
    assert.deepEqual(result.pulseBeats, []);
    assert.deepEqual(result.cameraBeats, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test('analyzePodcastDjStream builds a sampled range beat grid from decoded range maps', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const decodedRanges = [];
  global.fetch = async (targetUrl, opts = {}) => {
    calls.push({ targetUrl, opts });
    if (opts.method === 'HEAD') {
      return {
        ok: true,
        status: 200,
        headers: { get: name => (String(name).toLowerCase() === 'content-length' ? '8000000' : '') },
      };
    }
    throw new Error('range body fetch should be handled by decode override');
  };
  __test.setDecodePodcastDjEnergyRange(async (audioUrl, opts = {}) => {
    decodedRanges.push({ audioUrl, opts });
    const { lowEnergy, hitEnergy } = makePulseEnergy(1200, 50, 30);
    return {
      lowEnergy,
      hitEnergy,
      hopSec: 0.01,
      duration: 12,
      decode: { chunks: 1, decodedSamples: 1200 },
    };
  });

  try {
    const result = await analyzePodcastDjStream('https://audio.example/range-pulse.mp3', {
      durationSec: 8000,
      userAgent: 'Range Pulse UA',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.method, 'HEAD');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Range Pulse UA');
    assert.equal(decodedRanges.length, 8);
    assert.ok(decodedRanges.every(call => call.audioUrl === 'https://audio.example/range-pulse.mp3'));
    assert.ok(decodedRanges.every(call => call.opts.userAgent === 'Range Pulse UA'));
    assert.ok(decodedRanges.every(call => /^bytes=\d+-\d+$/.test(call.opts.range)));
    assert.equal(result.tempoSource, 'podcast-dj-server-range-offline');
    assert.equal(result.duration, 8000);
    assert.equal(result.debug.rangeSampled, true);
    assert.equal(result.debug.samples, 8);
    assert.equal(result.debug.contentLength, 8000000);
    assert.deepEqual(result.debug.decode, { chunks: 8, decodedSamples: 9600 });
    assert.equal(result.debug.profiles.length, 8);
    assert.ok(result.visualBeatCount > 1000);
    assert.equal(result.visualBeatCount, result.cameraBeats.length);
    assert.equal(result.beats.length, result.kicks.length);
    assert.ok(result.pulseBeats.length > 0);
    assert.ok(result.gridStep >= 0.32 && result.gridStep <= 0.86);
    assert.equal(result.sectionSteps.length, 8);

    const first = result.beats[0];
    assert.equal(first.dj, true);
    assert.equal(first.grid, true);
    assert.equal(first.server, true);
    assert.equal(first.sampled, true);
    assert.equal(first.kickOnly, true);
    assert.ok(first.time >= 0 && first.time < result.duration);
    assert.ok(first.impact >= 0.02 && first.impact <= 0.90);
    assert.ok(first.strength >= 0.12 && first.strength <= 0.93);
    assert.ok(['downbeat', 'push', 'drop', 'rebound', 'accent'].includes(first.combo));
  } finally {
    global.fetch = originalFetch;
    __test.reset();
  }
});

test('analyzePodcastDjStream falls back to range sampling when quality full-stream fails', async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const calls = [];
  const warnings = [];
  global.fetch = async (targetUrl, opts = {}) => {
    calls.push({ targetUrl, opts });
    if (!opts.method && !opts.headers.Range) {
      return { ok: false, status: 503, body: null };
    }
    if (opts.method === 'HEAD') {
      return {
        ok: true,
        status: 200,
        headers: { get: name => (String(name).toLowerCase() === 'content-length' ? '8000000' : '') },
      };
    }
    return {
      ok: true,
      status: 206,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    };
  };
  console.warn = (...args) => warnings.push(args);

  try {
    const result = await analyzePodcastDjStream('https://audio.example/quality-fallback.mp3', {
      durationSec: 4000,
      userAgent: 'Fallback UA',
    });

    assert.equal(calls.length, 10);
    assert.equal(calls[0].targetUrl, 'https://audio.example/quality-fallback.mp3');
    assert.equal(calls[0].opts.headers['User-Agent'], 'Fallback UA');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');
    assert.equal(calls[1].opts.method, 'HEAD');
    assert.equal(calls[1].opts.headers['User-Agent'], 'Fallback UA');

    const rangeCalls = calls.slice(2);
    assert.equal(rangeCalls.length, 8);
    assert.ok(rangeCalls.every(call => /^bytes=\d+-\d+$/.test(call.opts.headers.Range)));
    assert.ok(rangeCalls.every(call => call.opts.headers['User-Agent'] === 'Fallback UA'));
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /full-stream quality path failed/);
    assert.equal(String(warnings[0][1]), 'Audio fetch failed: 503');
    assert.equal(result.tempoSource, 'podcast-dj-server-range-empty');
    assert.equal(result.duration, 4000);
    assert.deepEqual(result.beats, []);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
