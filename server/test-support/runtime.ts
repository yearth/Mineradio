export interface ServerTestRuntimePlan {
  readonly purpose: string;
}

export interface ServerTestRuntimeGroups {
  readonly music: readonly string[];
  readonly update: readonly string[];
  readonly helpers: readonly string[];
}

export interface ServerTestRuntimeDependencies {
  readonly setNeteaseApi: (value: unknown) => void;
  readonly setRequestText: (value: unknown) => void;
  readonly helpers: Record<string, unknown>;
  readonly resetMusicRuntime: () => void;
  readonly setUpdatePlatform: (value: unknown) => void;
  readonly setUpdateManifest: (value: unknown) => void;
  readonly setUpdateAutoDownload: (value: unknown) => void;
  readonly setUpdateAutoPatch: (value: unknown) => void;
  readonly resetUpdateRuntime: () => void;
}

export const serverTestRuntimePlan: ServerTestRuntimePlan = {
  purpose: 'Centralize test-only dependency injection while server.js remains the legacy runtime entry.'
};

export const serverTestRuntimeGroups: ServerTestRuntimeGroups = {
  music: [
    'setNeteaseApi',
    'setRequestText',
    'resetMusicRuntime'
  ],
  update: [
    'setUpdatePlatform',
    'setUpdateManifest',
    'setUpdateAutoDownload',
    'setUpdateAutoPatch',
    'resetUpdateRuntime'
  ],
  helpers: [
    'normalizeCookieHeader',
    'rawCookieFallback',
    'parseGitHubRepository',
    'readUpdateConfig',
    'requestText',
    'moveInvalidUpdateFile',
    'buildWeatherMood'
  ]
};

export const serverTestRuntimeExportNames: readonly string[] = [
  'setNeteaseApi',
  'setRequestText',
  ...serverTestRuntimeGroups.helpers,
  'resetMusicRuntime',
  ...serverTestRuntimeGroups.update
];

export function buildServerTestRuntime(deps: ServerTestRuntimeDependencies): Record<string, unknown> {
  return {
    setNeteaseApi(overrides: unknown): void {
      deps.setNeteaseApi(overrides);
    },
    setRequestText(fn: unknown): void {
      deps.setRequestText(fn);
    },
    normalizeCookieHeader: deps.helpers.normalizeCookieHeader,
    rawCookieFallback: deps.helpers.rawCookieFallback,
    parseGitHubRepository: deps.helpers.parseGitHubRepository,
    readUpdateConfig: deps.helpers.readUpdateConfig,
    requestText: deps.helpers.requestText,
    moveInvalidUpdateFile: deps.helpers.moveInvalidUpdateFile,
    buildWeatherMood: deps.helpers.buildWeatherMood,
    resetMusicRuntime(): void {
      deps.resetMusicRuntime();
    },
    setUpdatePlatform(value: unknown): void {
      deps.setUpdatePlatform(value);
    },
    setUpdateManifest(value: unknown): void {
      deps.setUpdateManifest(value);
    },
    setUpdateAutoDownload(value: unknown): void {
      deps.setUpdateAutoDownload(value);
    },
    setUpdateAutoPatch(value: unknown): void {
      deps.setUpdateAutoPatch(value);
    },
    resetUpdateRuntime(): void {
      deps.resetUpdateRuntime();
    },
  };
}
