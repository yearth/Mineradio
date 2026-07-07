declare function require(name: string): any;
declare const process: { platform: string };

const {
  safeUpdateFileName: defaultSafeUpdateFileName,
} = require('../../../lib/update-utils');
const {
  once: defaultOnce,
} = require('events');

import {
  uniqueDownloadCandidates as defaultUniqueDownloadCandidates,
} from '../services/update-download-candidates';
import {
  normalizeManifestUpdateInfo as defaultNormalizeManifestUpdateInfo,
} from '../services/update-manifest';
import {
  classifyUpdateError,
  updateError,
} from '../services/update-errors';
import {
  parseLatestYmlUpdateInfo as defaultParseLatestYmlUpdateInfo,
} from '../services/update-latest-yml';
import {
  decodePatchFile,
  normalizePatchPayload as defaultNormalizePatchPayload,
  patchTargetPath as defaultPatchTargetPath,
  safePatchRelativePath,
} from '../services/update-patch-payload';
import {
  activeUpdateJobFor as defaultActiveUpdateJobFor,
  ensureMirrorCanBeVerified,
  prepareUpdateJobAttempt,
  publicUpdateJob,
  setUpdateJobError,
  trimUpdateJobs as defaultTrimUpdateJobs,
} from '../services/update-job-runtime';
import {
  moveInvalidUpdateFile as defaultMoveInvalidUpdateFile,
  reuseVerifiedInstallerJob as defaultReuseVerifiedInstallerJob,
  sha256Hex,
  verifyUpdateBuffer,
  verifyUpdateFile as defaultVerifyUpdateFile,
} from '../services/update-file-cache';
import {
  startUpdateDownloadJob as defaultStartUpdateDownloadJob,
  startUpdatePatchJob as defaultStartUpdatePatchJob,
} from '../services/update-job-factory';
import {
  writePatchFile as defaultWritePatchFile,
} from '../services/update-patch-apply';
import {
  installerProgress,
  patchProgress,
  speedBps as updateSpeedBps,
} from '../services/update-progress';
import {
  fetchTextFromCandidates as defaultFetchTextFromCandidates,
  localUpdateFallback as defaultLocalUpdateFallback,
} from '../services/update-fetch';
import {
  fetchManifestUpdateInfo as defaultFetchManifestUpdateInfo,
  readUpdateManifest as defaultReadUpdateManifest,
} from '../services/update-manifest-source';
import {
  fetchLatestUpdateInfo as defaultFetchLatestUpdateInfo,
  fetchLatestYmlUpdateInfo as defaultFetchLatestYmlUpdateInfo,
} from '../services/update-check';
import {
  downloadPatchBufferFromCandidate as defaultDownloadPatchBufferFromCandidate,
} from '../services/update-patch-download';
import {
  downloadUpdateAssetWithMirrors as defaultDownloadUpdateAssetWithMirrors,
} from '../services/update-installer-download';
import {
  downloadAndApplyPatchWithMirrors as defaultDownloadAndApplyPatchWithMirrors,
} from '../services/update-patch-runner';

type AnyFn = (...args: any[]) => any;
type Services = Record<string, AnyFn>;

export interface UpdateRuntimeAdapters {
  readonly updateDownloadJobs: Map<string, unknown>;
  readonly publicUpdateJob: AnyFn;
  readonly updateRuntimePlatform: () => unknown;
  readonly updateManifestRef: () => unknown;
  readonly uniqueDownloadCandidates: AnyFn;
  readonly normalizeManifestUpdateInfo: AnyFn;
  readonly readUpdateManifest: AnyFn;
  readonly fetchManifestUpdateInfo: AnyFn;
  readonly localUpdateFallback: AnyFn;
  readonly fetchWithTimeout: AnyFn;
  readonly fetchTextFromCandidates: AnyFn;
  readonly parseLatestYmlUpdateInfo: AnyFn;
  readonly fetchLatestYmlUpdateInfo: AnyFn;
  readonly fetchLatestUpdateInfo: AnyFn;
  readonly activeUpdateJobFor: AnyFn;
  readonly trimUpdateJobs: AnyFn;
  readonly verifyUpdateFile: AnyFn;
  readonly moveInvalidUpdateFile: AnyFn;
  readonly reuseVerifiedInstallerJob: AnyFn;
  readonly downloadUpdateAssetWithMirrors: AnyFn;
  readonly startUpdateDownloadJob: AnyFn;
  readonly patchTargetPath: AnyFn;
  readonly writePatchFile: AnyFn;
  readonly normalizePatchPayload: AnyFn;
  readonly downloadPatchBufferFromCandidate: AnyFn;
  readonly downloadAndApplyPatchWithMirrors: AnyFn;
  readonly startUpdatePatchJob: AnyFn;
}

export interface UpdateRuntimeAdapterOptions {
  readonly fs: unknown;
  readonly path: unknown;
  readonly once?: unknown;
  readonly fetch?: AnyFn;
  readonly getFetch?: () => AnyFn;
  readonly rootDir: string;
  readonly appVersion: string;
  readonly updateConfig: Record<string, any>;
  readonly updateFallbackNotes: string;
  readonly updateDownloadDir: string;
  readonly updatePatchBackupDir: string;
  readonly patchMaxBytes: number;
  readonly updateRuntime: {
    readonly jobs: Map<string, unknown>;
    readonly platform: (value: unknown) => unknown;
    readonly manifest: (value: unknown) => unknown;
    readonly autoDownload: () => unknown;
    readonly autoPatch: () => unknown;
  };
  readonly userAgent: string;
  readonly safeUpdateFileName?: AnyFn;
  readonly logger: unknown;
  readonly services?: Partial<Services>;
}

const defaultServices: Services = {
  uniqueDownloadCandidates: defaultUniqueDownloadCandidates,
  normalizeManifestUpdateInfo: defaultNormalizeManifestUpdateInfo,
  readUpdateManifest: defaultReadUpdateManifest,
  fetchManifestUpdateInfo: defaultFetchManifestUpdateInfo,
  localUpdateFallback: defaultLocalUpdateFallback,
  fetchTextFromCandidates: defaultFetchTextFromCandidates,
  parseLatestYmlUpdateInfo: defaultParseLatestYmlUpdateInfo,
  fetchLatestYmlUpdateInfo: defaultFetchLatestYmlUpdateInfo,
  fetchLatestUpdateInfo: defaultFetchLatestUpdateInfo,
  activeUpdateJobFor: defaultActiveUpdateJobFor,
  trimUpdateJobs: defaultTrimUpdateJobs,
  verifyUpdateFile: defaultVerifyUpdateFile,
  moveInvalidUpdateFile: defaultMoveInvalidUpdateFile,
  reuseVerifiedInstallerJob: defaultReuseVerifiedInstallerJob,
  downloadUpdateAssetWithMirrors: defaultDownloadUpdateAssetWithMirrors,
  startUpdateDownloadJob: defaultStartUpdateDownloadJob,
  patchTargetPath: defaultPatchTargetPath,
  writePatchFile: defaultWritePatchFile,
  normalizePatchPayload: defaultNormalizePatchPayload,
  downloadPatchBufferFromCandidate: defaultDownloadPatchBufferFromCandidate,
  downloadAndApplyPatchWithMirrors: defaultDownloadAndApplyPatchWithMirrors,
  startUpdatePatchJob: defaultStartUpdatePatchJob,
};

export function createUpdateRuntimeAdapters(options: UpdateRuntimeAdapterOptions): UpdateRuntimeAdapters {
  const services = { ...defaultServices, ...(options.services || {}) } as Services;
  const updateDownloadJobs = options.updateRuntime.jobs;
  const safeUpdateFileName = options.safeUpdateFileName || defaultSafeUpdateFileName;
  const getFetch = options.getFetch || (() => options.fetch as AnyFn);

  function updateRuntimePlatform(): unknown {
    return options.updateRuntime.platform(process.platform);
  }

  function updateManifestRef(): unknown {
    return options.updateRuntime.manifest(options.updateConfig.manifest);
  }

  function uniqueDownloadCandidates(urls: unknown, opts?: Record<string, unknown>): unknown {
    return services.uniqueDownloadCandidates(urls, {
      ...(opts || {}),
      mirrors: options.updateConfig.mirrors || [],
      preferMirrors: options.updateConfig.preferMirrors,
    });
  }

  function normalizeManifestUpdateInfo(data: unknown): unknown {
    return services.normalizeManifestUpdateInfo(data, {
      currentVersion: options.appVersion,
      fallbackNotes: options.updateFallbackNotes,
      uniqueDownloadCandidates,
    });
  }

  async function readUpdateManifest(ref: unknown): Promise<unknown> {
    return services.readUpdateManifest(ref, {
      fs: options.fs,
      path: options.path,
      fetch: getFetch(),
      userAgent: options.userAgent,
    });
  }

  async function fetchManifestUpdateInfo(ref: unknown): Promise<unknown> {
    return services.fetchManifestUpdateInfo(ref, {
      readManifest: readUpdateManifest,
      normalizeManifestUpdateInfo,
      localUpdateFallback,
    });
  }

  function localUpdateFallback(reason: unknown, opts?: Record<string, unknown>): unknown {
    return services.localUpdateFallback(reason, {
      configured: opts && opts.configured,
      preview: options.updateConfig.preview,
      currentVersion: options.appVersion,
      fallbackNotes: options.updateFallbackNotes,
    });
  }

  async function fetchWithTimeout(url: unknown, opts: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
    try {
      return await getFetch()(url, { ...(opts || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchTextFromCandidates(candidates: unknown, timeoutMs?: number): Promise<unknown> {
    return services.fetchTextFromCandidates(candidates, {
      timeoutMs,
      userAgent: options.userAgent,
      fetchWithTimeout,
      classifyUpdateError,
    });
  }

  function parseLatestYmlUpdateInfo(text: unknown, reason: unknown): unknown {
    return services.parseLatestYmlUpdateInfo(text, reason, {
      currentVersion: options.appVersion,
      owner: options.updateConfig.owner,
      repo: options.updateConfig.repo,
      uniqueDownloadCandidates,
    });
  }

  async function fetchLatestYmlUpdateInfo(reason: unknown): Promise<unknown> {
    return services.fetchLatestYmlUpdateInfo(reason, {
      config: options.updateConfig,
      updateError,
      uniqueDownloadCandidates,
      fetchTextFromCandidates,
      parseLatestYmlUpdateInfo,
    });
  }

  async function fetchLatestUpdateInfo(): Promise<unknown> {
    return services.fetchLatestUpdateInfo({
      platform: updateRuntimePlatform,
      manifestRef: updateManifestRef,
      config: options.updateConfig,
      currentVersion: options.appVersion,
      fallbackNotes: options.updateFallbackNotes,
      fetch: getFetch(),
      fetchManifestUpdateInfo,
      localUpdateFallback,
      fetchLatestYmlUpdateInfo,
      uniqueDownloadCandidates,
    });
  }

  function activeUpdateJobFor(version: unknown): unknown {
    return services.activeUpdateJobFor(updateDownloadJobs, version);
  }

  function trimUpdateJobs(): unknown {
    return services.trimUpdateJobs(updateDownloadJobs);
  }

  function verifyUpdateFile(filePath: unknown, job: unknown): unknown {
    return services.verifyUpdateFile(filePath, job, { fs: options.fs });
  }

  function moveInvalidUpdateFile(filePath: unknown, reason: unknown): unknown {
    return services.moveInvalidUpdateFile(filePath, reason, {
      fs: options.fs,
      path: options.path,
      logger: options.logger,
    });
  }

  function reuseVerifiedInstallerJob(opts: unknown): unknown {
    return services.reuseVerifiedInstallerJob(opts, {
      fs: options.fs,
      path: options.path,
      jobs: updateDownloadJobs,
      trimJobs: trimUpdateJobs,
      moveInvalid: moveInvalidUpdateFile,
    });
  }

  async function downloadUpdateAssetWithMirrors(job: unknown): Promise<unknown> {
    return services.downloadUpdateAssetWithMirrors(job, {
      fs: options.fs,
      once: options.once || defaultOnce,
      downloadDir: options.updateDownloadDir,
      userAgent: options.userAgent,
      uniqueDownloadCandidates,
      ensureMirrorCanBeVerified,
      prepareUpdateJobAttempt,
      fetchWithTimeout,
      updateError,
      updateSpeedBps,
      installerProgress,
      verifyUpdateFile,
      classifyUpdateError,
      setUpdateJobError,
    });
  }

  function startUpdateDownloadJob(info: unknown): unknown {
    return services.startUpdateDownloadJob(info, {
      path: options.path,
      jobs: updateDownloadJobs,
      downloadDir: options.updateDownloadDir,
      safeUpdateFileName,
      uniqueDownloadCandidates,
      activeUpdateJobFor,
      publicUpdateJob,
      trimUpdateJobs,
      reuseVerifiedInstallerJob,
      runDownload: downloadUpdateAssetWithMirrors,
      autoDownload: options.updateRuntime.autoDownload(),
    });
  }

  function patchTargetPath(rel: unknown): unknown {
    return services.patchTargetPath(rel, options.rootDir);
  }

  function writePatchFile(job: unknown, file: unknown): unknown {
    return services.writePatchFile(job, file, {
      fs: options.fs,
      path: options.path,
      backupDir: options.updatePatchBackupDir,
      patchTargetPath,
      safePatchRelativePath,
      decodePatchFile,
      sha256Hex,
      maxBytes: options.patchMaxBytes,
    });
  }

  function normalizePatchPayload(payload: unknown): unknown {
    return services.normalizePatchPayload(payload, { currentVersion: options.appVersion });
  }

  async function downloadPatchBufferFromCandidate(
    job: unknown,
    candidate: unknown,
    index: unknown,
    total: unknown
  ): Promise<unknown> {
    return services.downloadPatchBufferFromCandidate(job, candidate, index, total, {
      patchMaxBytes: options.patchMaxBytes,
      userAgent: options.userAgent,
      ensureMirrorCanBeVerified,
      prepareUpdateJobAttempt,
      fetchWithTimeout,
      updateError,
      updateSpeedBps,
      patchProgress,
      verifyUpdateBuffer,
    });
  }

  async function downloadAndApplyPatchWithMirrors(job: unknown): Promise<unknown> {
    return services.downloadAndApplyPatchWithMirrors(job, {
      fs: options.fs,
      downloadDir: options.updateDownloadDir,
      uniqueDownloadCandidates,
      downloadPatchBufferFromCandidate,
      normalizePatchPayload,
      writePatchFile,
      classifyUpdateError,
      setUpdateJobError,
    });
  }

  function startUpdatePatchJob(info: unknown): unknown {
    return services.startUpdatePatchJob(info, {
      path: options.path,
      jobs: updateDownloadJobs,
      downloadDir: options.updateDownloadDir,
      safeUpdateFileName,
      uniqueDownloadCandidates,
      publicUpdateJob,
      trimUpdateJobs,
      runPatch: downloadAndApplyPatchWithMirrors,
      autoPatch: options.updateRuntime.autoPatch(),
    });
  }

  return {
    updateDownloadJobs,
    publicUpdateJob,
    updateRuntimePlatform,
    updateManifestRef,
    uniqueDownloadCandidates,
    normalizeManifestUpdateInfo,
    readUpdateManifest,
    fetchManifestUpdateInfo,
    localUpdateFallback,
    fetchWithTimeout,
    fetchTextFromCandidates,
    parseLatestYmlUpdateInfo,
    fetchLatestYmlUpdateInfo,
    fetchLatestUpdateInfo,
    activeUpdateJobFor,
    trimUpdateJobs,
    verifyUpdateFile,
    moveInvalidUpdateFile,
    reuseVerifiedInstallerJob,
    downloadUpdateAssetWithMirrors,
    startUpdateDownloadJob,
    patchTargetPath,
    writePatchFile,
    normalizePatchPayload,
    downloadPatchBufferFromCandidate,
    downloadAndApplyPatchWithMirrors,
    startUpdatePatchJob,
  };
}
