export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

type UpdateJob = {
  mode?: string;
  createdAt?: number;
};

type UpdateRouteError = Error & {
  message: string;
};

export type UpdateRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
  fetchLatestUpdateInfo: () => Promise<unknown>;
  localUpdateFallback: (message: string, options: { configured: unknown }) => Record<string, unknown>;
  updateConfig: { configured?: unknown };
  startUpdateDownloadJob: (info: unknown) => Record<string, any>;
  startUpdatePatchJob: (info: unknown) => Record<string, any>;
  updateDownloadJobs: Map<string, UpdateJob>;
  publicUpdateJob: (job: UpdateJob | undefined) => unknown;
  logger: Pick<Console, 'error'>;
};

function latestJob(jobs: Iterable<UpdateJob>): UpdateJob | undefined {
  return Array.from(jobs).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
}

function latestPatchJob(jobs: Iterable<UpdateJob>): UpdateJob | undefined {
  return Array.from(jobs)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .find(item => item.mode === 'patch');
}

export async function handleUpdateRoutes(ctx: UpdateRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/update/latest') {
    try {
      ctx.sendJSON(ctx.res, await ctx.fetchLatestUpdateInfo());
    } catch (err: any) {
      const typedErr = err as UpdateRouteError;
      const message = typedErr.message || 'Update check failed';
      ctx.sendJSON(ctx.res, {
        ...ctx.localUpdateFallback(message, { configured: ctx.updateConfig.configured }),
        error: message,
      });
    }
    return true;
  }

  if (ctx.pathname === '/api/update/download') {
    try {
      const info = await ctx.fetchLatestUpdateInfo();
      const job = ctx.startUpdateDownloadJob(info);
      ctx.sendJSON(ctx.res, job, job.ok ? 200 : 400);
    } catch (err: any) {
      ctx.logger.error('[UpdateDownload]', err);
      ctx.sendJSON(ctx.res, { ok: false, error: err.message || 'UPDATE_DOWNLOAD_START_FAILED' }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/update/download/status') {
    const id = ctx.url.searchParams.get('id') || '';
    const job = id
      ? ctx.updateDownloadJobs.get(id)
      : latestJob(ctx.updateDownloadJobs.values());
    ctx.sendJSON(ctx.res, ctx.publicUpdateJob(job), job ? 200 : 404);
    return true;
  }

  if (ctx.pathname === '/api/update/patch') {
    try {
      const info = await ctx.fetchLatestUpdateInfo();
      const job = ctx.startUpdatePatchJob(info);
      ctx.sendJSON(ctx.res, job, job.ok ? 200 : 400);
    } catch (err: any) {
      ctx.logger.error('[UpdatePatch]', err);
      ctx.sendJSON(ctx.res, { ok: false, error: err.message || 'UPDATE_PATCH_START_FAILED' }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/update/patch/status') {
    const id = ctx.url.searchParams.get('id') || '';
    const job = id
      ? ctx.updateDownloadJobs.get(id)
      : latestPatchJob(ctx.updateDownloadJobs.values());
    ctx.sendJSON(ctx.res, ctx.publicUpdateJob(job), job ? 200 : 404);
    return true;
  }

  return false;
}
