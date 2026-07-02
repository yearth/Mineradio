export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type PodcastRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
  cloudsearch: (opts: Record<string, unknown>) => Promise<any>;
  djHot: (opts: Record<string, unknown>) => Promise<any>;
  djDetail: (opts: Record<string, unknown>) => Promise<any>;
  djProgram: (opts: Record<string, unknown>) => Promise<any>;
  mapPodcastRadio: (item: any) => any;
  mapPodcastProgram: (item: any, radio: any) => any;
  analyzePodcastDjStream: (audioUrl: string, opts: {
    durationSec: number;
    userAgent: string;
  }) => Promise<any>;
  analyzePodcastDjIntro: (audioUrl: string, opts: {
    durationSec: number;
    introSec: number;
    userAgent: string;
  }) => Promise<any>;
  userAgent: string;
  userCookie: string;
  timestamp: () => number;
  now: () => number;
  logger: Pick<Console, 'log' | 'error'>;
};

export async function handlePodcastPublicRoutes(ctx: PodcastRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/podcast/search') {
    try {
      const kw = String(ctx.url.searchParams.get('keywords') || '').trim();
      const limit = Math.max(6, Math.min(30, parseInt(ctx.url.searchParams.get('limit') || '18', 10) || 18));
      if (!kw) {
        ctx.sendJSON(ctx.res, { podcasts: [] });
        return true;
      }
      const r = await ctx.cloudsearch({ keywords: kw, type: 1009, limit, cookie: ctx.userCookie, timestamp: ctx.timestamp() });
      const result = (r.body && r.body.result) || {};
      const raw = result.djRadios || result.djradios || result.radios || [];
      const podcasts = raw.map(ctx.mapPodcastRadio).filter((podcast: any) => podcast.id);
      ctx.sendJSON(ctx.res, { podcasts, total: result.djRadiosCount || result.djradiosCount || podcasts.length });
    } catch (err: any) {
      ctx.logger.error('[PodcastSearch]', err);
      ctx.sendJSON(ctx.res, { error: err.message, podcasts: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/podcast/hot') {
    try {
      const limit = Math.max(6, Math.min(30, parseInt(ctx.url.searchParams.get('limit') || '18', 10) || 18));
      const offset = Math.max(0, parseInt(ctx.url.searchParams.get('offset') || '0', 10) || 0);
      const r = await ctx.djHot({ limit, offset, cookie: ctx.userCookie, timestamp: ctx.timestamp() });
      const body = r.body || {};
      const raw = body.djRadios || body.djradios || body.radios || body.data || [];
      const podcasts = (Array.isArray(raw) ? raw : []).map(ctx.mapPodcastRadio).filter((podcast: any) => podcast.id);
      ctx.sendJSON(ctx.res, { podcasts, more: !!body.hasMore });
    } catch (err: any) {
      ctx.logger.error('[PodcastHot]', err);
      ctx.sendJSON(ctx.res, { error: err.message, podcasts: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/podcast/detail') {
    try {
      const rid = ctx.url.searchParams.get('id') || ctx.url.searchParams.get('rid');
      if (!rid) {
        ctx.sendJSON(ctx.res, { error: 'Missing podcast id' }, 400);
        return true;
      }
      const r = await ctx.djDetail({ rid, cookie: ctx.userCookie, timestamp: ctx.timestamp() });
      const body = r.body || {};
      const radio = ctx.mapPodcastRadio(body.data || body.djRadio || body.radio || body);
      ctx.sendJSON(ctx.res, { podcast: radio });
    } catch (err: any) {
      ctx.logger.error('[PodcastDetail]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/podcast/programs') {
    try {
      const rid = ctx.url.searchParams.get('id') || ctx.url.searchParams.get('rid');
      if (!rid) {
        ctx.sendJSON(ctx.res, { error: 'Missing podcast id', programs: [] }, 400);
        return true;
      }
      const limit = Math.max(10, Math.min(60, parseInt(ctx.url.searchParams.get('limit') || '30', 10) || 30));
      const offset = Math.max(0, parseInt(ctx.url.searchParams.get('offset') || '0', 10) || 0);
      const r = await ctx.djProgram({ rid, limit, offset, asc: false, cookie: ctx.userCookie, timestamp: ctx.timestamp() });
      const body = r.body || {};
      const raw = body.programs || (body.data && (body.data.list || body.data.programs)) || [];
      const radio = raw[0] && raw[0].radio ? ctx.mapPodcastRadio(raw[0].radio) : { id: rid, rid };
      const programs = (Array.isArray(raw) ? raw : [])
        .map((program: any) => ctx.mapPodcastProgram(program, radio))
        .filter((program: any) => program.id && program.name);
      ctx.sendJSON(ctx.res, { radio, programs, more: !!body.more, total: body.count || programs.length });
    } catch (err: any) {
      ctx.logger.error('[PodcastPrograms]', err);
      ctx.sendJSON(ctx.res, { error: err.message, programs: [] }, 500);
    }
    return true;
  }

  return false;
}

export async function handlePodcastBeatmapRoutes(ctx: PodcastRouteContext): Promise<boolean> {
  if (ctx.pathname !== '/api/podcast/dj-beatmap') return false;

  try {
    const audioUrl = ctx.url.searchParams.get('url');
    const durationSec = Math.max(0, Number(ctx.url.searchParams.get('duration') || 0) || 0);
    if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
      ctx.sendJSON(ctx.res, { error: 'Invalid audio url' }, 400);
      return true;
    }
    ctx.logger.log('[PodcastDjBeatmap] start', Math.round(durationSec || 0) + 's');
    const started = ctx.now();
    const introSec = Math.max(0, Number(ctx.url.searchParams.get('intro') || 0) || 0);
    const map = introSec
      ? await ctx.analyzePodcastDjIntro(audioUrl, { durationSec, introSec, userAgent: ctx.userAgent })
      : await ctx.analyzePodcastDjStream(audioUrl, { durationSec, userAgent: ctx.userAgent });
    ctx.logger.log('[PodcastDjBeatmap] done beats:', map.visualBeatCount || 0, 'ms:', ctx.now() - started, 'decode:', map.decode || {});
    ctx.sendJSON(ctx.res, { ok: true, map });
  } catch (err: any) {
    ctx.logger.error('[PodcastDjBeatmap]', err);
    ctx.sendJSON(ctx.res, { ok: false, error: err.message || String(err) }, 500);
  }
  return true;
}

export async function handlePodcastRoutes(ctx: PodcastRouteContext): Promise<boolean> {
  return (await handlePodcastPublicRoutes(ctx)) || handlePodcastBeatmapRoutes(ctx);
}
