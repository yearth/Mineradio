declare const Buffer: any;

export interface PatchDownloadDeps {
  readonly patchMaxBytes: number;
  readonly userAgent: string;
  readonly ensureMirrorCanBeVerified: (job: any, candidate: any) => void;
  readonly prepareUpdateJobAttempt: (job: any, candidate: any, index: number, total: number) => void;
  readonly fetchWithTimeout: (url: string, opts: any, timeoutMs: number) => Promise<any>;
  readonly updateError: (code: string, message?: string) => Error;
  readonly updateSpeedBps: (bytes: number, elapsedMs: number) => number;
  readonly patchProgress: (input: { received: number; total: number; speedBps: number }) => any;
  readonly verifyUpdateBuffer: (buffer: any, job: any) => void;
  readonly now?: () => number;
  readonly Buffer?: any;
}

export async function downloadPatchBufferFromCandidate(job: any, candidate: any, index: number, total: number, deps: PatchDownloadDeps) {
  deps.ensureMirrorCanBeVerified(job, candidate);
  deps.prepareUpdateJobAttempt(job, candidate, index, total);
  job.mode = 'patch';
  job.message = '正在下载快速补丁';
  job.progress = 0;
  job.updatedAt = (deps.now || Date.now)();

  const resp = await deps.fetchWithTimeout(candidate.url, {
    headers: { 'User-Agent': deps.userAgent },
  }, 12000);
  if (!resp.ok) throw deps.updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);

  job.total = parseInt(resp.headers.get('content-length') || '0', 10) || job.expectedSize || job.total || 0;
  job.received = 0;
  const chunks: any[] = [];
  const reader = resp.body.getReader();
  let speedWindowAt = (deps.now || Date.now)();
  let speedWindowBytes = 0;
  const BufferApi = deps.Buffer || Buffer;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const buf = BufferApi.from(chunk.value);
    job.received += buf.length;
    speedWindowBytes += buf.length;
    if (job.received > deps.patchMaxBytes) throw deps.updateError('PATCH_TOO_LARGE', 'Patch package is too large');
    chunks.push(buf);
    const now = (deps.now || Date.now)();
    if (now - speedWindowAt >= 700) {
      job.speedBps = deps.updateSpeedBps(speedWindowBytes, now - speedWindowAt);
      speedWindowAt = now;
      speedWindowBytes = 0;
    }
    Object.assign(job, deps.patchProgress({ received: job.received, total: job.total, speedBps: job.speedBps }));
    job.updatedAt = (deps.now || Date.now)();
  }
  const raw = BufferApi.concat(chunks);
  deps.verifyUpdateBuffer(raw, job);
  return raw;
}
