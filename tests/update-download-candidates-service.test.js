const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMirrorUrl,
  publicDownloadUrls,
  uniqueDownloadCandidates,
} = require('../server-dist/server/services/update-download-candidates');

test('buildMirrorUrl preserves legacy mirror template handling', () => {
  const source = 'https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio Setup.exe';

  assert.equal(
    buildMirrorUrl(source, 'https://mirror.example.com/?u={encodedUrl}'),
    'https://mirror.example.com/?u=https%3A%2F%2Fgithub.com%2Fyearthmain%2FMineradio%2Freleases%2Fdownload%2Fv1.2.0%2FMineradio%20Setup.exe'
  );
  assert.equal(
    buildMirrorUrl(source, 'https://mirror.example.com/proxy/{url}'),
    'https://mirror.example.com/proxy/' + source
  );
  assert.equal(
    buildMirrorUrl(source, 'https://mirror.example.com/base///'),
    'https://mirror.example.com/base/' + source
  );
  assert.equal(buildMirrorUrl('ftp://ignored.example.com/file.exe', 'https://mirror.example.com'), '');
  assert.equal(buildMirrorUrl(source, 'file:///tmp/mirror'), '');
});

test('uniqueDownloadCandidates prefers mirrors by default and dedupes by final URL', () => {
  const candidates = uniqueDownloadCandidates([
    ' https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio.exe ',
    'https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio.exe',
    'ftp://ignored.example.com/file.exe',
  ], {
    mirrors: [
      'https://mirror-a.example.com/{encodedUrl}',
      'https://mirror-a.example.com/{encodedUrl}',
      'https://mirror-b.example.com/{url}',
    ],
  });

  assert.deepEqual(candidates, [
    {
      url: 'https://mirror-a.example.com/https%3A%2F%2Fgithub.com%2Fyearthmain%2FMineradio%2Freleases%2Fdownload%2Fv1.2.0%2FMineradio.exe',
      label: '国内加速线路 1',
      mirrored: true,
    },
    {
      url: 'https://mirror-b.example.com/https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio.exe',
      label: '国内加速线路 3',
      mirrored: true,
    },
    {
      url: 'https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio.exe',
      label: 'GitHub 直连',
      mirrored: false,
    },
  ]);
});

test('uniqueDownloadCandidates preserves legacy direct-first and no-mirror modes', () => {
  const source = 'https://github.com/yearthmain/Mineradio/releases/download/v1.2.0/Mineradio.exe';

  assert.deepEqual(uniqueDownloadCandidates(source, {
    mirrors: ['https://mirror.example.com/{url}'],
    preferMirrors: false,
  }).map(candidate => candidate.label), [
    'GitHub 直连',
    '国内加速线路 1',
  ]);

  assert.deepEqual(uniqueDownloadCandidates(source, {
    mirrors: ['https://mirror.example.com/{url}'],
    useMirrors: false,
  }), [
    {
      url: source,
      label: 'GitHub 直连',
      mirrored: false,
    },
  ]);
});

test('publicDownloadUrls preserves legacy candidate URL filtering', () => {
  function callableCandidate() {}
  callableCandidate.url = 'https://callable.example.com/app.exe';

  assert.deepEqual(publicDownloadUrls([
    { url: 'https://example.com/app.exe' },
    callableCandidate,
    null,
    { url: '' },
    { label: 'missing url' },
    { url: 'https://mirror.example.com/app.exe' },
  ]), [
    'https://example.com/app.exe',
    'https://callable.example.com/app.exe',
    'https://mirror.example.com/app.exe',
  ]);

  assert.deepEqual(publicDownloadUrls(null), []);
});
