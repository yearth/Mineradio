declare const Buffer: any;

export interface InstallerDownloadDeps {
  readonly fs: any;
  readonly once: (emitter: any, event: string) => Promise<any>;
  readonly downloadDir: string;
  readonly userAgent: string;
  readonly uniqueDownloadCandidates: (urls: unknown) => any[];
  readonly ensureMirrorCanBeVerified: (job: any, candidate: any) => void;
  readonly prepareUpdateJobAttempt: (job: any, candidate: any, index: number, total: number) => void;
  readonly fetchWithTimeout: (url: string, opts: any, timeoutMs: number) => Promise<any>;
  readonly updateError: (code: string, message?: string) => Error;
  readonly updateSpeedBps: (bytes: number, elapsedMs: number) => number;
  readonly installerProgress: (input: { received: number; total: number; speedBps: number }) => any;
  readonly verifyUpdateFile: (filePath: string, job: any) => void;
  readonly classifyUpdateError: (err: unknown) => { reason: string; detail?: string };
  readonly setUpdateJobError: (job: any, err: unknown, message: string) => void;
  readonly now?: () => number;
  readonly Buffer?: any;
}

export async function downloadUpdateAssetWithMirrors(job: any, deps: InstallerDownloadDeps) {
  const tmpPath = job.filePath + '.download';
  const candidates = Array.isArray(job.downloadCandidates) && job.downloadCandidates.length
    ? job.downloadCandidates
    : deps.uniqueDownloadCandidates(job.downloadUrl || '');
  const failures: any[] = [];
  const now = deps.now || Date.now;
  const BufferApi = deps.Buffer || Buffer;
  deps.fs.mkdirSync(deps.downloadDir, { recursive: true });
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      try { if (deps.fs.existsSync(tmpPath)) deps.fs.unlinkSync(tmpPath); } catch (_) {}
      deps.ensureMirrorCanBeVerified(job, candidate);
      deps.prepareUpdateJobAttempt(job, candidate, i, candidates.length);
      job.message = job.total ? '正在下载完整安装包' : '正在下载完整安装包，等待服务器返回大小';

      const resp = await deps.fetchWithTimeout(candidate.url, {
        headers: { 'User-Agent': deps.userAgent },
      }, 14000);
      if (!resp.ok) throw deps.updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);

      const totalHeader = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
      job.total = totalHeader || job.expectedSize || job.total || 0;
      job.progress = 0;
      job.updatedAt = now();
      let speedWindowAt = now();
      let speedWindowBytes = 0;

      const writer = deps.fs.createWriteStream(tmpPath);
      const reader = resp.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const buf = BufferApi.from(chunk.value);
          job.received += buf.length;
          speedWindowBytes += buf.length;
          const current = now();
          if (current - speedWindowAt >= 900) {
            job.speedBps = deps.updateSpeedBps(speedWindowBytes, current - speedWindowAt);
            speedWindowAt = current;
            speedWindowBytes = 0;
          }
          Object.assign(job, deps.installerProgress({ received: job.received, total: job.total, speedBps: job.speedBps }));
          job.message = job.total > 0 ? '正在下载完整安装包' : '正在下载完整安装包，服务器未提供总大小';
          job.updatedAt = now();
          if (!writer.write(buf)) await deps.once(writer, 'drain');
        }
      } finally {
        writer.end();
        await deps.once(writer, 'finish').catch(() => {});
      }

      deps.verifyUpdateFile(tmpPath, job);
      if (deps.fs.existsSync(job.filePath)) deps.fs.unlinkSync(job.filePath);
      deps.fs.renameSync(tmpPath, job.filePath);
      job.status = 'ready';
      job.progress = 100;
      job.etaSeconds = 0;
      job.message = '安装包已下载';
      job.updatedAt = now();
      return;
    } catch (err) {
      try { if (deps.fs.existsSync(tmpPath)) deps.fs.unlinkSync(tmpPath); } catch (_) {}
      const info = deps.classifyUpdateError(err);
      failures.push({ source: candidate.label || '下载线路', reason: info.reason, detail: info.detail });
      job.failedAttempts = failures.slice(-6);
      job.message = i < candidates.length - 1 ? ((candidate.label || '当前线路') + '失败，正在切换线路') : info.reason;
      job.updatedAt = now();
      if (i >= candidates.length - 1) deps.setUpdateJobError(job, err, '下载失败：' + info.reason);
    }
  }
}
