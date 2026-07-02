declare function require(name: string): any;
declare const Buffer: any;

const crypto = require('crypto');
const defaultFs = require('fs');
const defaultPath = require('path');
const {
  normalizeDigest,
} = require('../../../lib/update-utils');
const {
  updateError,
} = require('./update-errors');

export interface FileCacheDeps {
  readonly fs?: any;
  readonly path?: any;
  readonly jobs?: Map<string, unknown>;
  readonly trimJobs?: () => void;
  readonly moveInvalid?: (filePath: string, reason: string) => void;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly logger?: { warn: (...args: unknown[]) => void };
}

function depsWithDefaults(deps: FileCacheDeps = {}) {
  return {
    fs: deps.fs || defaultFs,
    path: deps.path || defaultPath,
    jobs: deps.jobs,
    trimJobs: deps.trimJobs || (() => {}),
    moveInvalid: deps.moveInvalid,
    now: deps.now || Date.now,
    random: deps.random || Math.random,
    logger: deps.logger || console,
  };
}

export function sha256Hex(buffer: unknown): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha512Base64(buffer: unknown): string {
  return crypto.createHash('sha512').update(buffer).digest('base64');
}

export function sha512Hex(buffer: unknown): string {
  return crypto.createHash('sha512').update(buffer).digest('hex');
}

export function verifyUpdateBuffer(buffer: any, job: any): void {
  const expectedSize = Number(job.expectedSize || job.total || 0) || 0;
  if (expectedSize > 0 && buffer.length !== expectedSize) {
    throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, got ${buffer.length}`);
  }
  const expectedSha256 = normalizeDigest(job.sha256 || '', 'sha256').toLowerCase();
  if (expectedSha256 && sha256Hex(buffer) !== expectedSha256) {
    throw updateError('UPDATE_SHA256_MISMATCH', 'Downloaded sha256 mismatch');
  }
  const expectedSha512 = normalizeDigest(job.sha512 || '', 'sha512');
  if (expectedSha512) {
    const actualBase64 = sha512Base64(buffer);
    const actualHex = sha512Hex(buffer).toLowerCase();
    if (actualBase64 !== expectedSha512 && actualHex !== expectedSha512.toLowerCase()) {
      throw updateError('UPDATE_SHA512_MISMATCH', 'Downloaded sha512 mismatch');
    }
  }
}

export function verifyUpdateFile(filePath: string, job: any, deps?: FileCacheDeps): void {
  const { fs } = depsWithDefaults(deps);
  verifyUpdateBuffer(fs.readFileSync(filePath), job);
}

export function moveInvalidUpdateFile(filePath: string, reason?: string, deps?: FileCacheDeps): void {
  const { fs, path, logger, now } = depsWithDefaults(deps);
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const invalidPath = path.join(dir, `${base}.invalid-${now()}${ext || '.bin'}`);
    fs.renameSync(filePath, invalidPath);
    logger.warn('[UpdateDownload] cached installer moved aside:', reason || 'invalid', invalidPath);
  } catch (e: any) {
    logger.warn('[UpdateDownload] failed to move invalid cached installer:', e.message);
  }
}

export function reuseVerifiedInstallerJob(opts: any, deps?: FileCacheDeps) {
  const resolved = depsWithDefaults(deps);
  const { fs, path, jobs, trimJobs, now, random } = resolved;
  if (!opts || !opts.filePath || !fs.existsSync(opts.filePath)) return null;
  if (!opts.expectedSize && !opts.sha256 && !opts.sha512) return null;
  const createdAt = now();
  const stat = fs.statSync(opts.filePath);
  const job = {
    id: 'cached-' + createdAt.toString(36) + '-' + random().toString(36).slice(2, 8),
    status: 'ready',
    progress: 100,
    received: stat.size || 0,
    total: opts.expectedSize || stat.size || 0,
    speedBps: 0,
    etaSeconds: 0,
    sourceLabel: '本地缓存',
    attempt: 0,
    attempts: opts.attempts || 0,
    mode: 'installer',
    message: '安装包已下载，可直接打开安装',
    fileName: opts.fileName || path.basename(opts.filePath),
    filePath: opts.filePath,
    version: opts.version || '',
    downloadUrl: opts.downloadUrl || '',
    downloadCandidates: opts.downloadCandidates || [],
    expectedSize: opts.expectedSize || 0,
    sha256: opts.sha256 || '',
    sha512: opts.sha512 || '',
    releaseUrl: opts.releaseUrl || '',
    failedAttempts: [],
    cached: true,
    createdAt,
    updatedAt: createdAt,
    error: '',
  };
  try {
    verifyUpdateFile(opts.filePath, job, deps);
    if (jobs && typeof jobs.set === 'function') jobs.set(job.id, job);
    trimJobs();
    return job;
  } catch (err: any) {
    const moveInvalid = resolved.moveInvalid || ((filePath: string, reason: string) => moveInvalidUpdateFile(filePath, reason, deps));
    moveInvalid(opts.filePath, (err && err.message) || 'cache verification failed');
    return null;
  }
}
