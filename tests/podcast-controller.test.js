const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handlePodcastRoutes,
} = require('../server-dist/server/controllers/podcast-controller');

function baseContext(overrides = {}) {
  const calls = [];
  const logs = [];
  return {
    ctx: {
      pathname: '/api/podcast/dj-beatmap',
      url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=https%3A%2F%2Faudio.example%2Fmix.mp3&duration=360'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      analyzePodcastDjStream: async (audioUrl, opts) => ({ visualBeatCount: 4, decode: { stream: true }, audioUrl, opts }),
      analyzePodcastDjIntro: async (audioUrl, opts) => ({ visualBeatCount: 2, decode: { intro: true }, audioUrl, opts }),
      userAgent: 'MineradioTest/1.0',
      now: (() => {
        const values = [1000, 1250];
        return () => values.shift() || 1250;
      })(),
      logger: {
        log: (...args) => logs.push(['log', ...args]),
        error: (...args) => logs.push(['error', ...args]),
      },
      ...overrides,
    },
    calls,
    logs,
  };
}

test('handlePodcastRoutes rejects invalid DJ beatmap URLs before analysis', async () => {
  let analyzed = false;
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=file%3A%2F%2F%2Ftmp%2Faudio.mp3'),
    analyzePodcastDjStream: async () => {
      analyzed = true;
      return {};
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { error: 'Invalid audio url' },
    status: 400,
  }]);
  assert.equal(analyzed, false);
});

test('handlePodcastRoutes analyzes full DJ streams with legacy logging and payload', async () => {
  const analyzed = [];
  const { ctx, calls, logs } = baseContext({
    analyzePodcastDjStream: async (audioUrl, opts) => {
      analyzed.push({ audioUrl, opts });
      return { visualBeatCount: 4, decode: { stream: true } };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(analyzed, [{
    audioUrl: 'https://audio.example/mix.mp3',
    opts: { durationSec: 360, userAgent: 'MineradioTest/1.0' },
  }]);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { ok: true, map: { visualBeatCount: 4, decode: { stream: true } } },
    status: undefined,
  }]);
  assert.deepEqual(logs, [
    ['log', '[PodcastDjBeatmap] start', '360s'],
    ['log', '[PodcastDjBeatmap] done beats:', 4, 'ms:', 250, 'decode:', { stream: true }],
  ]);
});

test('handlePodcastRoutes uses intro analysis when intro seconds are present', async () => {
  const analyzed = [];
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/podcast/dj-beatmap?url=https%3A%2F%2Faudio.example%2Fmix.mp3&duration=360&intro=120'),
    analyzePodcastDjIntro: async (audioUrl, opts) => {
      analyzed.push({ audioUrl, opts });
      return { visualBeatCount: 2, decode: { intro: true } };
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(analyzed, [{
    audioUrl: 'https://audio.example/mix.mp3',
    opts: { durationSec: 360, introSec: 120, userAgent: 'MineradioTest/1.0' },
  }]);
  assert.deepEqual(calls[0].data, { ok: true, map: { visualBeatCount: 2, decode: { intro: true } } });
});

test('handlePodcastRoutes reports DJ beatmap analysis failures', async () => {
  const { ctx, calls, logs } = baseContext({
    analyzePodcastDjStream: async () => {
      throw new Error('audio failed');
    },
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { ok: false, error: 'audio failed' },
    status: 500,
  }]);
  assert.equal(logs[1][0], 'error');
  assert.equal(logs[1][1], '[PodcastDjBeatmap]');
});

test('handlePodcastRoutes ignores unrelated paths', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/search',
  });

  const handled = await handlePodcastRoutes(ctx);

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
