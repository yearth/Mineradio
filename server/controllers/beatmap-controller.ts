export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

type CacheInfo = {
  allowed?: boolean;
  available?: boolean;
  dir?: unknown;
  drive?: unknown;
};

type BeatmapError = Error & {
  code?: string;
  info?: CacheInfo;
};

export type BeatmapRouteContext = {
  pathname: string;
  url: URL;
  req: { method?: string };
  res: unknown;
  sendJSON: JsonSender;
  readRequestBody: (req: unknown) => Promise<unknown>;
  beatCacheRootInfo: () => CacheInfo;
  readBeatMapCache: (key: string) => Record<string, any> | null;
  writeBeatMapCache: (body: unknown) => unknown;
};

function beatmapCacheStatusPayload(info: CacheInfo): Record<string, unknown> {
  const enabled = !!(info.allowed && info.available);
  return {
    enabled,
    dir: info.dir,
    drive: info.drive,
    reason: !info.allowed ? 'C_DRIVE_DISABLED' : (!info.available ? 'TARGET_DRIVE_UNAVAILABLE' : ''),
    mode: enabled ? 'disk' : 'memory-only',
  };
}

export async function handleBeatmapRoutes(ctx: BeatmapRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/beatmap/cache/status') {
    ctx.sendJSON(ctx.res, beatmapCacheStatusPayload(ctx.beatCacheRootInfo()));
    return true;
  }

  if (ctx.pathname !== '/api/beatmap/cache') return false;

  if (ctx.req.method === 'GET') {
    const key = ctx.url.searchParams.get('key') || '';
    try {
      const entry = ctx.readBeatMapCache(key);
      ctx.sendJSON(ctx.res, entry
        ? { ok: true, hit: true, key: entry.key || key, map: entry.map, meta: entry.meta || {}, savedAt: entry.savedAt || 0 }
        : { ok: true, hit: false, key });
    } catch (err: any) {
      const typedErr = err as BeatmapError;
      const info = typedErr.info || ctx.beatCacheRootInfo();
      ctx.sendJSON(ctx.res, {
        ok: false,
        hit: false,
        enabled: false,
        mode: 'memory-only',
        key,
        reason: typedErr.code || typedErr.message || 'BEAT_CACHE_READ_FAILED',
        dir: info.dir,
      });
    }
    return true;
  }

  if (ctx.req.method === 'POST') {
    try {
      const body = await ctx.readRequestBody(ctx.req);
      ctx.sendJSON(ctx.res, ctx.writeBeatMapCache(body));
    } catch (err: any) {
      const typedErr = err as BeatmapError;
      const info = typedErr.info || ctx.beatCacheRootInfo();
      ctx.sendJSON(ctx.res, {
        ok: false,
        enabled: false,
        mode: 'memory-only',
        reason: typedErr.code || typedErr.message || 'BEAT_CACHE_WRITE_FAILED',
        dir: info.dir,
      });
    }
    return true;
  }

  ctx.sendJSON(ctx.res, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  return true;
}
