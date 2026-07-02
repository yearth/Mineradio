declare function require(name: string): any;

const {
  classifyUpdateError,
  updateError,
} = require('./update-errors');

function jobList(jobs: unknown): any[] {
  if (jobs && typeof (jobs as { values?: unknown }).values === 'function') {
    return Array.from((jobs as { values: () => Iterable<unknown> }).values());
  }
  return Array.isArray(jobs) ? jobs : [];
}

export function publicUpdateJob(job: any) {
  if (!job) return { ok: false, error: 'UPDATE_JOB_NOT_FOUND' };
  return {
    ok: job.status !== 'error',
    id: job.id,
    status: job.status,
    progress: job.progress || 0,
    received: job.received || 0,
    total: job.total || 0,
    speedBps: job.speedBps || 0,
    etaSeconds: job.etaSeconds || 0,
    sourceLabel: job.sourceLabel || '',
    attempt: job.attempt || 0,
    attempts: job.attempts || 0,
    mode: job.mode || 'installer',
    message: job.message || '',
    restartRequired: !!job.restartRequired,
    cached: !!job.cached,
    fileName: job.fileName || '',
    filePath: job.status === 'ready' ? job.filePath : '',
    version: job.version || '',
    releaseUrl: job.releaseUrl || '',
    error: job.error || '',
    errorReason: job.errorReason || '',
    errorDetail: job.errorDetail || '',
    failedAttempts: Array.isArray(job.failedAttempts) ? job.failedAttempts.slice(0, 6) : [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function activeUpdateJobFor(jobs: unknown, version: unknown) {
  return jobList(jobs)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .find(job => job.version === version && (job.status === 'queued' || job.status === 'downloading' || job.status === 'ready'));
}

export function trimUpdateJobs(jobs: any, limit = 8): void {
  if (!jobs || typeof jobs.delete !== 'function') return;
  jobList(jobs)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(limit)
    .forEach(job => jobs.delete(job.id));
}

export function setUpdateJobError(job: any, err: unknown, fallbackMessage?: string): void {
  const info = classifyUpdateError(err);
  job.status = 'error';
  job.error = info.code;
  job.errorReason = info.reason;
  job.errorDetail = info.detail;
  job.message = fallbackMessage || info.reason;
  job.updatedAt = Date.now();
}

export function prepareUpdateJobAttempt(job: any, candidate: any, index: number, total: number): void {
  job.status = 'downloading';
  job.sourceLabel = candidate.label || '下载线路';
  job.attempt = index + 1;
  job.attempts = total;
  job.received = 0;
  job.speedBps = 0;
  job.etaSeconds = 0;
  job.error = '';
  job.errorReason = '';
  job.errorDetail = '';
  job.updatedAt = Date.now();
}

export function ensureMirrorCanBeVerified(job: any, candidate: any): void {
  if (!candidate || !candidate.mirrored) return;
  if (job.sha256 || job.sha512) return;
  throw updateError('MIRROR_HASH_MISSING', 'Mirror download skipped because no digest is available');
}
