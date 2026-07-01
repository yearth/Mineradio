declare function require(name: string): any;

const {
  cleanReleaseLine,
  extractReleaseNotes,
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

export interface ManifestUpdateOptions {
  readonly currentVersion: string;
  readonly fallbackNotes: readonly string[];
  readonly uniqueDownloadCandidates: (urls: unknown) => unknown;
}

function stringValue(value: unknown): string {
  return String(value || '');
}

export function normalizeManifestUpdateInfo(data: any, opts: ManifestUpdateOptions) {
  data = data || {};
  const release = data.release || {};
  const asset = release.asset || data.asset || {};
  const currentVersion = opts.currentVersion;
  const fallbackNotes = opts.fallbackNotes;
  const latestVersion = normalizeVersion(
    data.latestVersion
    || data.version
    || release.version
    || release.tagName
    || release.tag_name
    || release.name
    || currentVersion
  ) || currentVersion;
  const downloadUrl = release.downloadUrl || data.downloadUrl || asset.downloadUrl || asset.browser_download_url || '';
  const patch = release.patch || data.patch || null;
  const assetUrls = [downloadUrl].concat(Array.isArray(asset.downloadUrls) ? asset.downloadUrls : []);
  const patchUrls = patch ? [patch.downloadUrl].concat(Array.isArray(patch.downloadUrls) ? patch.downloadUrls : []) : [];
  const patchInfo = patch && patch.downloadUrl ? {
    name: patch.name || updateAssetNameFromUrl(patch.downloadUrl) || `Mineradio-${currentVersion}→${latestVersion}.patch.json`,
    size: Number(patch.size || 0) || 0,
    contentType: patch.contentType || patch.content_type || 'application/json',
    downloadUrl: patch.downloadUrl,
    downloadUrls: publicDownloadUrls(opts.uniqueDownloadCandidates(patchUrls)),
    from: normalizeVersion(patch.from || currentVersion),
    to: normalizeVersion(patch.to || latestVersion),
    sha256: normalizeDigest(patch.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(patch.sha512 || '', 'sha512'),
  } : null;
  const bodyNotes = extractReleaseNotes(release.body || data.body);
  const notes = Array.isArray(release.notes) && release.notes.length
    ? release.notes.slice(0, 4).map(cleanReleaseLine).filter(Boolean)
    : (bodyNotes.length ? bodyNotes : fallbackNotes);
  const assetInfo = downloadUrl ? {
    name: asset.name || updateAssetNameFromUrl(downloadUrl) || `Mineradio-${latestVersion}-Setup.exe`,
    size: Number(asset.size || 0) || 0,
    contentType: asset.contentType || asset.content_type || '',
    downloadUrl,
    downloadUrls: publicDownloadUrls(opts.uniqueDownloadCandidates(assetUrls)),
    sha256: normalizeDigest(asset.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(asset.sha512 || release.sha512 || data.sha512 || '', 'sha512'),
  } : null;

  return {
    configured: true,
    preview: false,
    updateAvailable: data.updateAvailable != null ? !!data.updateAvailable : compareVersions(latestVersion, currentVersion) > 0,
    currentVersion,
    latestVersion,
    release: {
      tagName: release.tagName || release.tag_name || data.tagName || ('v' + latestVersion),
      name: release.name || data.name || ('Mineradio v' + latestVersion),
      version: latestVersion,
      publishedAt: release.publishedAt || release.published_at || data.publishedAt || '',
      htmlUrl: release.htmlUrl || release.html_url || data.htmlUrl || '',
      downloadUrl,
      asset: assetInfo,
      patch: patchInfo,
      patchAvailable: !!(patchInfo && patchInfo.downloadUrl && compareVersions(latestVersion, currentVersion) > 0),
      summary: release.summary || data.summary || stringValue(notes[0]) || '发现新版本，建议更新。',
      notes,
    },
    source: 'manifest',
  };
}

