declare function require(name: string): any;
declare const fetch: any;

const {
  extractReleaseNotes,
  pickPatchAsset,
  pickReleaseAsset,
} = require('../../../lib/update-utils');
const {
  compareVersions,
  normalizeVersion,
} = require('../../../lib/version-utils');
const { updateError: defaultUpdateError } = require('./update-errors');

export interface UpdateCheckConfig {
  readonly configured?: boolean;
  readonly provider?: string;
  readonly owner?: string;
  readonly repo?: string;
}

export interface LatestYmlCheckDeps {
  readonly config: UpdateCheckConfig;
  readonly updateError?: (code: string, message?: string) => Error;
  readonly uniqueDownloadCandidates: (urls: unknown) => any;
  readonly fetchTextFromCandidates: (candidates: any, timeoutMs: number) => Promise<{ text: string }>;
  readonly parseLatestYmlUpdateInfo: (text: string, reason: unknown) => any;
}

export interface LatestUpdateDeps {
  readonly platform: () => string;
  readonly manifestRef: () => string;
  readonly config: UpdateCheckConfig;
  readonly currentVersion?: string;
  readonly fallbackNotes?: readonly string[];
  readonly fetch?: any;
  readonly setTimeout?: typeof setTimeout;
  readonly clearTimeout?: typeof clearTimeout;
  readonly AbortController?: any;
  readonly fetchManifestUpdateInfo?: (ref: string) => Promise<any>;
  readonly localUpdateFallback: (reason?: string, opts?: { configured?: boolean }) => any;
  readonly fetchLatestYmlUpdateInfo?: (reason?: string) => Promise<any>;
  readonly uniqueDownloadCandidates?: (urls: unknown) => any;
}

export async function fetchLatestYmlUpdateInfo(reason: unknown, deps: LatestYmlCheckDeps) {
  const config = deps.config || {};
  const updateError = deps.updateError || defaultUpdateError;
  if (!config.configured || config.provider !== 'github') throw updateError('UPDATE_REPOSITORY_NOT_CONFIGURED');
  const latestYmlUrl = `https://github.com/${encodeURIComponent(String(config.owner || ''))}/${encodeURIComponent(String(config.repo || ''))}/releases/latest/download/latest.yml`;
  const candidates = deps.uniqueDownloadCandidates(latestYmlUrl);
  const result = await deps.fetchTextFromCandidates(candidates, 6500);
  return deps.parseLatestYmlUpdateInfo(result.text, reason);
}

export async function fetchLatestUpdateInfo(deps: LatestUpdateDeps) {
  if (deps.platform() !== 'win32') {
    return deps.localUpdateFallback('当前 macOS 预览版暂不启用 Windows 更新通道。', { configured: true });
  }

  const manifest = deps.manifestRef();
  if (manifest) return deps.fetchManifestUpdateInfo!(manifest);

  const config = deps.config || {};
  if (!config.configured || config.provider !== 'github') return deps.localUpdateFallback();

  const currentVersion = deps.currentVersion || '0.9.11';
  const fallbackNotes = deps.fallbackNotes || [];
  const fetchApi = deps.fetch || fetch;
  const setTimer = deps.setTimeout || setTimeout;
  const clearTimer = deps.clearTimeout || clearTimeout;
  const Controller = deps.AbortController || AbortController;
  const controller = new Controller();
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(String(config.owner || ''))}/${encodeURIComponent(String(config.repo || ''))}/releases/latest`;
  const timer = setTimer(() => controller.abort(), 8500);
  try {
    const resp = await fetchApi(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': `Mineradio/${currentVersion}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      try { return await deps.fetchLatestYmlUpdateInfo!('GitHub Releases ' + resp.status); }
      catch (_) { return deps.localUpdateFallback('GitHub Releases ' + resp.status, { configured: true }); }
    }
    const data = await resp.json();
    const latestVersion = normalizeVersion(data.tag_name || data.name || currentVersion) || currentVersion;
    const asset = pickReleaseAsset(data.assets, { uniqueDownloadCandidates: deps.uniqueDownloadCandidates });
    const patch = pickPatchAsset(data.assets, currentVersion, latestVersion, { uniqueDownloadCandidates: deps.uniqueDownloadCandidates });
    const extractedNotes = extractReleaseNotes(data.body);
    const notes = extractedNotes.length ? extractedNotes : fallbackNotes;
    return {
      configured: true,
      preview: false,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
      release: {
        tagName: data.tag_name || ('v' + latestVersion),
        name: data.name || ('Mineradio v' + latestVersion),
        version: latestVersion,
        publishedAt: data.published_at || '',
        htmlUrl: data.html_url || '',
        downloadUrl: asset ? asset.downloadUrl : '',
        asset,
        patch,
        patchAvailable: !!(patch && patch.downloadUrl && compareVersions(latestVersion, currentVersion) > 0),
        summary: notes[0] || '发现新版本，建议更新。',
        notes,
      },
    };
  } catch (err: any) {
    const reason = err && err.message || 'Update check failed';
    try { return await deps.fetchLatestYmlUpdateInfo!(reason); }
    catch (fallbackErr: any) { return deps.localUpdateFallback((fallbackErr && fallbackErr.message) || reason, { configured: true }); }
  } finally {
    clearTimer(timer);
  }
}
