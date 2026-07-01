const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseGitHubRepository,
  readUpdateConfig,
  readUpdateMirrors,
} = require('../server-dist/server/services/update-config');

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => {
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  });
  try {
    return fn();
  } finally {
    previous.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

test('parseGitHubRepository accepts legacy shorthand and GitHub URLs', () => {
  assert.deepEqual(parseGitHubRepository('owner/repo.git'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseGitHubRepository('git@github.com:Owner.Name/repo-name.git'), {
    owner: 'Owner.Name',
    repo: 'repo-name',
  });
  assert.deepEqual(parseGitHubRepository('https://github.com/owner/repo.git?tab=readme'), {
    owner: 'owner',
    repo: 'repo',
  });
  assert.equal(parseGitHubRepository('not a github repo'), null);
  assert.equal(parseGitHubRepository(''), null);
});

test('readUpdateMirrors keeps legacy normalization, dedupe, and six item limit', () => {
  const mirrors = withEnv({
    MINERADIO_UPDATE_MIRRORS: [
      'https://a.example.com/',
      'https://A.example.com',
      'ftp://ignored.example.com',
      '',
      'https://b.example.com',
      'https://c.example.com',
      'https://d.example.com',
      'https://e.example.com',
      'https://f.example.com',
      'https://g.example.com',
    ].join(','),
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateMirrors({ mirrors: ['https://local.example.com'] }));

  assert.deepEqual(mirrors, [
    'https://a.example.com/',
    'https://b.example.com',
    'https://c.example.com',
    'https://d.example.com',
    'https://e.example.com',
    'https://f.example.com',
  ]);
});

test('readUpdateConfig merges package update settings and environment overrides', () => {
  const pkg = {
    repository: { url: 'https://github.com/pkg-owner/pkg-repo.git' },
    mineradio: {
      update: {
        provider: 'github',
        preview: false,
        preferMirrors: false,
        mirrors: [
          'https://mirror.example.com/',
          'https://mirror.example.com',
          'ftp://ignored.example.com/',
          '',
        ],
      },
    },
  };

  const local = withEnv({
    MINERADIO_UPDATE_REPOSITORY: undefined,
    GITHUB_REPOSITORY: undefined,
    MINERADIO_UPDATE_OWNER: undefined,
    MINERADIO_UPDATE_REPO: undefined,
    MINERADIO_UPDATE_MANIFEST: undefined,
    MINERADIO_UPDATE_MANIFEST_URL: undefined,
    MINERADIO_UPDATE_MANIFEST_FILE: undefined,
    MINERADIO_UPDATE_MIRRORS: undefined,
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateConfig(pkg));

  assert.equal(local.configured, true);
  assert.equal(local.owner, 'pkg-owner');
  assert.equal(local.repo, 'pkg-repo');
  assert.equal(local.preview, false);
  assert.equal(local.preferMirrors, false);
  assert.deepEqual(local.mirrors, ['https://mirror.example.com/']);
  assert.equal(local.manifest, '');

  const overridden = withEnv({
    MINERADIO_UPDATE_REPOSITORY: 'env-owner/env-repo',
    GITHUB_REPOSITORY: undefined,
    MINERADIO_UPDATE_OWNER: 'manual-owner',
    MINERADIO_UPDATE_REPO: 'manual-repo',
    MINERADIO_UPDATE_MANIFEST: 'https://updates.example.com/manifest.json',
    MINERADIO_UPDATE_MANIFEST_URL: undefined,
    MINERADIO_UPDATE_MANIFEST_FILE: undefined,
    MINERADIO_UPDATE_MIRRORS: 'https://a.example.com/, https://A.example.com ; https://b.example.com/',
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateConfig(pkg));

  assert.equal(overridden.configured, true);
  assert.equal(overridden.owner, 'manual-owner');
  assert.equal(overridden.repo, 'manual-repo');
  assert.equal(overridden.manifest, 'https://updates.example.com/manifest.json');
  assert.deepEqual(overridden.mirrors, ['https://a.example.com/', 'https://b.example.com/']);
});

test('readUpdateConfig preserves the legacy empty config fallback for null package data', () => {
  const config = withEnv({
    MINERADIO_UPDATE_REPOSITORY: undefined,
    GITHUB_REPOSITORY: undefined,
    MINERADIO_UPDATE_OWNER: undefined,
    MINERADIO_UPDATE_REPO: undefined,
    MINERADIO_UPDATE_MANIFEST: undefined,
    MINERADIO_UPDATE_MANIFEST_URL: undefined,
    MINERADIO_UPDATE_MANIFEST_FILE: undefined,
    MINERADIO_UPDATE_MIRRORS: undefined,
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateConfig(null));

  assert.deepEqual(config, {
    provider: 'github',
    owner: '',
    repo: '',
    configured: false,
    preview: true,
    preferMirrors: true,
    mirrors: [],
    manifest: '',
  });
});
