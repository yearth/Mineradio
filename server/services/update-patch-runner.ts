export interface PatchRunnerDeps {
  readonly fs: any;
  readonly downloadDir: string;
  readonly uniqueDownloadCandidates: (urls: unknown) => any[];
  readonly downloadPatchBufferFromCandidate: (job: any, candidate: any, index: number, total: number) => Promise<any>;
  readonly normalizePatchPayload: (payload: any) => any;
  readonly writePatchFile: (job: any, file: any) => any;
  readonly classifyUpdateError: (err: unknown) => { reason: string; detail?: string };
  readonly setUpdateJobError: (job: any, err: unknown, message: string) => void;
  readonly now?: () => number;
}

export async function downloadAndApplyPatchWithMirrors(job: any, deps: PatchRunnerDeps) {
  const candidates = Array.isArray(job.downloadCandidates) && job.downloadCandidates.length
    ? job.downloadCandidates
    : deps.uniqueDownloadCandidates(job.downloadUrl || '');
  const failures: any[] = [];
  const now = deps.now || Date.now;
  deps.fs.mkdirSync(deps.downloadDir, { recursive: true });
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const raw = await deps.downloadPatchBufferFromCandidate(job, candidate, i, candidates.length);
      const patch = deps.normalizePatchPayload(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')));
      job.version = patch.to;
      job.message = '正在应用快速补丁';
      job.progress = 88;
      job.etaSeconds = 0;
      job.updatedAt = now();
      const changed: any[] = [];
      patch.files.forEach((file: any) => changed.push(deps.writePatchFile(job, file)));
      job.changedFiles = changed;
      job.status = 'ready';
      job.progress = 100;
      job.restartRequired = patch.restartRequired;
      job.message = patch.restartRequired ? '快速补丁已应用，重启后生效' : '快速补丁已应用';
      job.updatedAt = now();
      return;
    } catch (err) {
      const info = deps.classifyUpdateError(err);
      failures.push({ source: candidate.label || '下载线路', reason: info.reason, detail: info.detail });
      job.failedAttempts = failures.slice(-6);
      job.message = i < candidates.length - 1 ? ((candidate.label || '当前线路') + '失败，正在切换线路') : info.reason;
      job.updatedAt = now();
      if (i >= candidates.length - 1) deps.setUpdateJobError(job, err, '快速补丁失败：' + info.reason);
    }
  }
}
