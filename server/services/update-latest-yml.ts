declare function require(name: string): any;

const {
  normalizeDigest,
  updateAssetNameFromUrl,
} = require('../../../lib/update-utils');
const {
  compareVersions,
  normalizeVersion,
} = require('../../../lib/version-utils');
const {
  publicDownloadUrls,
} = require('./update-download-candidates');

export interface LatestYmlOptions {
  readonly currentVersion: string;
  readonly owner: string;
  readonly repo: string;
  readonly uniqueDownloadCandidates: (urls: unknown) => unknown;
}

export function yamlScalar(text: unknown, key: string): string {
  const pattern = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(.+?)\\s*$', 'm');
  const match = String(text || '').match(pattern);
  if (!match) return '';
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

export function githubReleaseDownloadUrl(version: unknown, fileName: unknown, opts: Pick<LatestYmlOptions, 'owner' | 'repo'>): string {
  const tag = 'v' + normalizeVersion(version);
  const encodedOwner = encodeURIComponent(opts.owner);
  const encodedRepo = encodeURIComponent(opts.repo);
  const encodedName = String(fileName || '').split('/').map(part => encodeURIComponent(part)).join('/');
  return `https://github.com/${encodedOwner}/${encodedRepo}/releases/download/${tag}/${encodedName}`;
}

export function parseLatestYmlUpdateInfo(text: unknown, reason: unknown, opts: LatestYmlOptions) {
  const currentVersion = opts.currentVersion;
  const latestVersion = normalizeVersion(yamlScalar(text, 'version') || currentVersion) || currentVersion;
  const assetPath = yamlScalar(text, 'path') || yamlScalar(text, 'url') || `Mineradio-${latestVersion}-Setup.exe`;
  const sha512 = normalizeDigest(yamlScalar(text, 'sha512'), 'sha512');
  const size = Number(yamlScalar(text, 'size') || 0) || 0;
  const releaseDate = yamlScalar(text, 'releaseDate');
  const downloadUrl = githubReleaseDownloadUrl(latestVersion, assetPath, opts);
  const candidates = opts.uniqueDownloadCandidates(downloadUrl);
  const asset = {
    name: updateAssetNameFromUrl(downloadUrl) || assetPath,
    size,
    contentType: 'application/octet-stream',
    downloadUrl,
    downloadUrls: publicDownloadUrls(candidates),
    sha256: '',
    sha512,
  };
  return {
    configured: true,
    preview: false,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    currentVersion,
    latestVersion,
    release: {
      tagName: 'v' + latestVersion,
      name: 'Mineradio v' + latestVersion,
      version: latestVersion,
      publishedAt: releaseDate,
      htmlUrl: `https://github.com/${opts.owner}/${opts.repo}/releases/tag/v${latestVersion}`,
      downloadUrl,
      asset,
      patch: null,
      patchAvailable: false,
      summary: '发现新版本，已启用备用更新线路。',
      notes: ['更新检测已切换到备用线路', '下载时会自动选择国内加速线路', '下载失败会显示具体原因和当前速度'],
    },
    source: 'latest-yml',
    reason: reason || '',
  };
}
