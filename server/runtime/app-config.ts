declare function require(id: string): { join(...parts: string[]): string };

const path = require('path');

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type AppConfigEnvironment = Record<string, string | undefined>;

export interface WeatherDefaultLocation {
  readonly name: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

export interface AppConfig {
  readonly port: string | number;
  readonly host: string;
  readonly userAgent: string;
  readonly cookieFile: string;
  readonly qqCookieFile: string;
  readonly updateWorkDir: string;
  readonly updateDownloadDir: string;
  readonly updatePatchBackupDir: string;
  readonly beatmapCacheDir: string;
  readonly neteaseSongUrlRoute: string;
  readonly appVersion: unknown;
  readonly patchMaxBytes: number;
  readonly updateFallbackNotes: string[];
  readonly openMeteoForecastUrl: string;
  readonly openMeteoGeocodeUrl: string;
  readonly weatherIpLocationUrl: string;
  readonly weatherDefaultLocation: WeatherDefaultLocation;
}

export function buildAppConfig(opts: {
  env?: AppConfigEnvironment;
  rootDir: string;
  packageInfo?: { version?: unknown } | null;
  defaultBeatMapCacheDir: () => string;
}): AppConfig {
  const env = opts.env || {};
  const packageInfo = opts.packageInfo || {};
  const updateWorkDir = env.MINERADIO_UPDATE_DIR || path.join(opts.rootDir, 'updates');
  return {
    port: env.PORT || 3000,
    host: env.HOST || '0.0.0.0',
    userAgent: DEFAULT_USER_AGENT,
    cookieFile: env.COOKIE_FILE || path.join(opts.rootDir, '.cookie'),
    qqCookieFile: env.QQ_COOKIE_FILE || path.join(opts.rootDir, '.qq-cookie'),
    updateWorkDir,
    updateDownloadDir: env.MINERADIO_UPDATE_DOWNLOAD_DIR || path.join(updateWorkDir, 'downloads'),
    updatePatchBackupDir: env.MINERADIO_PATCH_BACKUP_DIR || path.join(updateWorkDir, 'backups', 'patches'),
    beatmapCacheDir: env.MINERADIO_BEAT_CACHE_DIR || opts.defaultBeatMapCacheDir(),
    neteaseSongUrlRoute: '/api/song/url',
    appVersion: env.MINERADIO_VERSION || packageInfo.version || '0.9.11',
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
  };
}
