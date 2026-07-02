const test = require('node:test');
const assert = require('node:assert/strict');

const {
  installerProgress,
  patchProgress,
  speedBps,
} = require('../server-dist/server/services/update-progress');

test('speedBps preserves legacy rounded bytes-per-second calculation', () => {
  assert.equal(speedBps(900, 900), 1000);
  assert.equal(speedBps(42, 0), 42000);
});

test('installerProgress clamps known-size downloads between 1 and 99', () => {
  assert.deepEqual(installerProgress({ received: 0, total: 100, speedBps: 0 }), {
    progress: 1,
    etaSeconds: 0,
  });
  assert.deepEqual(installerProgress({ received: 50, total: 100, speedBps: 25 }), {
    progress: 50,
    etaSeconds: 2,
  });
  assert.deepEqual(installerProgress({ received: 200, total: 100, speedBps: 10 }), {
    progress: 99,
    etaSeconds: 0,
  });
});

test('installerProgress preserves legacy logarithmic fallback when total size is unknown', () => {
  assert.deepEqual(installerProgress({ received: 0, total: 0, speedBps: 0 }), {
    progress: 7,
    etaSeconds: 0,
  });
  assert.deepEqual(installerProgress({ received: 1024 * 1024, total: 0, speedBps: 0 }), {
    progress: 72,
    etaSeconds: 0,
  });
});

test('patchProgress scales known-size patch downloads to 84 percent before apply', () => {
  assert.deepEqual(patchProgress({ received: 50, total: 100, speedBps: 25 }), {
    progress: 42,
    etaSeconds: 2,
  });
  assert.deepEqual(patchProgress({ received: 200, total: 100, speedBps: 10 }), {
    progress: 84,
    etaSeconds: 0,
  });
});

test('patchProgress preserves legacy logarithmic fallback when total size is unknown', () => {
  assert.deepEqual(patchProgress({ received: 1024 * 1024, total: 0, speedBps: 0 }), {
    progress: 72,
    etaSeconds: 0,
  });
  assert.deepEqual(patchProgress({ received: 1024 * 1024 * 1024, total: 0, speedBps: 0 }), {
    progress: 76,
    etaSeconds: 0,
  });
});
