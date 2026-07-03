const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_USER_AGENT,
  buildAppConfig,
} = require('../server-dist/server/runtime/app-config');

test('buildAppConfig preserves default server, cookie, update, and weather configuration', () => {
  const config = buildAppConfig({
    env: {},
    rootDir: '/app/root',
    packageInfo: { version: '1.2.3' },
    defaultBeatMapCacheDir: () => '/cache/beatmap',
  });

  assert.deepEqual(config, {
    port: 3000,
    host: '0.0.0.0',
    userAgent: DEFAULT_USER_AGENT,
    cookieFile: '/app/root/.cookie',
    qqCookieFile: '/app/root/.qq-cookie',
    updateWorkDir: '/app/root/updates',
    updateDownloadDir: '/app/root/updates/downloads',
    updatePatchBackupDir: '/app/root/updates/backups/patches',
    beatmapCacheDir: '/cache/beatmap',
    neteaseSongUrlRoute: '/api/song/url',
    appVersion: '1.2.3',
    patchMaxBytes: 12 * 1024 * 1024,
    updateFallbackNotes: [
      '电影镜头节奏更松',
      '音源失败自动换源',
      '右上角更新提示',
    ],
    openMeteoForecastUrl: 'https://api.open-meteo.com/v1/forecast',
    openMeteoGeocodeUrl: 'https://geocoding-api.open-meteo.com/v1/search',
    weatherIpLocationUrl: 'http://ip-api.com/json/',
    weatherDefaultLocation: {
      name: '上海',
      country: 'China',
      latitude: 31.2304,
      longitude: 121.4737,
      timezone: 'Asia/Shanghai',
    },
  });
});

test('buildAppConfig preserves environment overrides and version fallback order', () => {
  const config = buildAppConfig({
    env: {
      PORT: '4123',
      HOST: '127.0.0.1',
      COOKIE_FILE: '/tmp/user.cookie',
      QQ_COOKIE_FILE: '/tmp/qq.cookie',
      MINERADIO_UPDATE_DIR: '/tmp/update-work',
      MINERADIO_UPDATE_DOWNLOAD_DIR: '/tmp/update-downloads',
      MINERADIO_PATCH_BACKUP_DIR: '/tmp/patch-backups',
      MINERADIO_BEAT_CACHE_DIR: '/tmp/beat-cache',
      MINERADIO_VERSION: '9.9.9',
    },
    rootDir: '/app/root',
    packageInfo: { version: '1.2.3' },
    defaultBeatMapCacheDir: () => '/cache/beatmap',
  });

  assert.equal(config.port, '4123');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.cookieFile, '/tmp/user.cookie');
  assert.equal(config.qqCookieFile, '/tmp/qq.cookie');
  assert.equal(config.updateWorkDir, '/tmp/update-work');
  assert.equal(config.updateDownloadDir, '/tmp/update-downloads');
  assert.equal(config.updatePatchBackupDir, '/tmp/patch-backups');
  assert.equal(config.beatmapCacheDir, '/tmp/beat-cache');
  assert.equal(config.appVersion, '9.9.9');
});

test('buildAppConfig falls back to the legacy app version when package metadata is empty', () => {
  const config = buildAppConfig({
    env: {},
    rootDir: '/app/root',
    packageInfo: {},
    defaultBeatMapCacheDir: () => '/cache/beatmap',
  });

  assert.equal(config.appVersion, '0.9.11');
});
