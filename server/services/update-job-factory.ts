declare function require(name: string): any;

const {
  normalizeDigest,
} = require('../../../lib/update-utils');

export interface UpdateJobFactoryDeps {
  readonly path: any;
  readonly jobs: Map<string, any>;
  readonly downloadDir: string;
  readonly safeUpdateFileName: (name: string, version: string) => string;
  readonly uniqueDownloadCandidates: (urls: unknown) => any[];
  readonly activeUpdateJobFor?: (version: string) => any;
  readonly publicUpdateJob: (job: any) => any;
  readonly trimUpdateJobs: () => void;
  readonly reuseVerifiedInstallerJob?: (opts: any) => any;
  readonly runDownload?: (job: any) => void;
  readonly runPatch?: (job: any) => void;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly autoDownload?: boolean;
  readonly autoPatch?: boolean;
}

function activePatchJobFor(jobs: Map<string, any>, version: string) {
  return Array.from(jobs.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .find(job => job.mode === 'patch' && job.version === version && (job.status === 'queued' || job.status === 'downloading' || job.status === 'ready'));
}

function randomIdSuffix(random: () => number): string {
  return random().toString(36).slice(2, 8);
}

function depsWithDefaults(deps: UpdateJobFactoryDeps) {
  return {
    ...deps,
    now: deps.now || Date.now,
    random: deps.random || Math.random,
    reuseVerifiedInstallerJob: deps.reuseVerifiedInstallerJob || (() => null),
    runDownload: deps.runDownload || (() => {}),
    runPatch: deps.runPatch || (() => {}),
  };
}

export function startUpdateDownloadJob(info: any, deps: UpdateJobFactoryDeps) {
  const resolved = depsWithDefaults(deps);
  const release = info && info.release ? info.release : {};
  const asset = release.asset || {};
  const downloadUrl = release.downloadUrl || asset.downloadUrl || '';
  if (!info || !info.configured) return { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' };
  if (!info.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE' };
  if (!/^https?:\/\//i.test(downloadUrl)) return { ok: false, error: 'UPDATE_ASSET_MISSING' };

  const version = info.latestVersion || release.version || '';
  const existing = resolved.activeUpdateJobFor ? resolved.activeUpdateJobFor(version) : undefined;
  if (existing) return resolved.publicUpdateJob(existing);

  const fileName = resolved.safeUpdateFileName(asset.name || '', version);
  const filePath = resolved.path.join(resolved.downloadDir, fileName);
  const downloadCandidates = resolved.uniqueDownloadCandidates([downloadUrl].concat(Array.isArray(asset.downloadUrls) ? asset.downloadUrls : []));
  const expectedSize = asset.size || 0;
  const sha256 = normalizeDigest(asset.sha256 || '', 'sha256').toLowerCase();
  const sha512 = normalizeDigest(asset.sha512 || '', 'sha512');
  const cached = resolved.reuseVerifiedInstallerJob({
    fileName,
    filePath,
    version,
    downloadUrl,
    downloadCandidates,
    expectedSize,
    sha256,
    sha512,
    releaseUrl: release.htmlUrl || '',
    attempts: downloadCandidates.length,
  });
  if (cached) return resolved.publicUpdateJob(cached);

  const createdAt = resolved.now();
  const job = {
    id: createdAt.toString(36) + '-' + randomIdSuffix(resolved.random),
    status: 'queued',
    progress: 0,
    received: 0,
    total: expectedSize,
    mode: 'installer',
    fileName,
    filePath,
    version,
    downloadUrl,
    downloadCandidates,
    expectedSize,
    sha256,
    sha512,
    releaseUrl: release.htmlUrl || '',
    sourceLabel: '',
    attempt: 0,
    attempts: downloadCandidates.length,
    failedAttempts: [],
    createdAt,
    updatedAt: createdAt,
    error: '',
  };
  resolved.jobs.set(job.id, job);
  resolved.trimUpdateJobs();
  if (resolved.autoDownload !== false) resolved.runDownload(job);
  return resolved.publicUpdateJob(job);
}

export function startUpdatePatchJob(info: any, deps: UpdateJobFactoryDeps) {
  const resolved = depsWithDefaults(deps);
  const release = info && info.release ? info.release : {};
  const patch = release.patch || {};
  const downloadUrl = patch.downloadUrl || '';
  if (!info || !info.configured) return { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' };
  if (!info.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE' };
  if (!release.patchAvailable || !/^https?:\/\//i.test(downloadUrl)) return { ok: false, error: 'PATCH_ASSET_MISSING' };

  const version = info.latestVersion || release.version || patch.to || '';
  const existing = activePatchJobFor(resolved.jobs, version);
  if (existing) return resolved.publicUpdateJob(existing);

  const createdAt = resolved.now();
  const downloadCandidates = resolved.uniqueDownloadCandidates([downloadUrl].concat(Array.isArray(patch.downloadUrls) ? patch.downloadUrls : []));
  const job = {
    id: 'patch-' + createdAt.toString(36) + '-' + randomIdSuffix(resolved.random),
    status: 'queued',
    progress: 0,
    received: 0,
    total: patch.size || 0,
    mode: 'patch',
    fileName: patch.name || resolved.safeUpdateFileName('', version).replace(/\.exe$/i, '.patch.json'),
    filePath: '',
    version,
    downloadUrl,
    downloadCandidates,
    releaseUrl: release.htmlUrl || '',
    expectedSize: patch.size || 0,
    sha256: normalizeDigest(patch.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(patch.sha512 || '', 'sha512'),
    restartRequired: true,
    sourceLabel: '',
    attempt: 0,
    attempts: downloadCandidates.length,
    failedAttempts: [],
    message: '等待下载快速补丁',
    createdAt,
    updatedAt: createdAt,
    error: '',
  };
  resolved.jobs.set(job.id, job);
  resolved.trimUpdateJobs();
  if (resolved.autoPatch !== false) resolved.runPatch(job);
  return resolved.publicUpdateJob(job);
}
