export interface ServerTestRuntimePlan {
  readonly purpose: string;
}

export interface ServerTestRuntimeGroups {
  readonly music: readonly string[];
  readonly update: readonly string[];
  readonly helpers: readonly string[];
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
