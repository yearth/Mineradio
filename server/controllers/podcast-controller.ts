import {
  fetchPodcastDetail,
  fetchPodcastHot,
  fetchPodcastPrograms,
  fetchPodcastSearch,
  fetchUserPodcastCollectionItems,
  fetchUserPodcastCollections,
} from '../services/podcast-orchestration';

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
  getLoginInfo: () => Promise<any>;
  fetchMyPodcastItems: (key: string, info: any, limit: number, offset: number) => Promise<any>;
  podcastCollectionMeta: (key: string, items: any[]) => any;
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
  logger: Pick<Console, 'log' | 'warn' | 'error'>;
};

export async function handlePodcastPublicRoutes(ctx: PodcastRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/podcast/search') {
    try {
      const kw = String(ctx.url.searchParams.get('keywords') || '').trim();
      const payload = await fetchPodcastSearch(kw, ctx.url.searchParams.get('limit') || '18', ctx);
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      ctx.logger.error('[PodcastSearch]', err);
      ctx.sendJSON(ctx.res, { error: err.message, podcasts: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/podcast/hot') {
    try {
      const payload = await fetchPodcastHot(
        ctx.url.searchParams.get('limit') || '18',
        ctx.url.searchParams.get('offset') || '0',
        ctx
      );
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await fetchPodcastDetail(rid, ctx);
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await fetchPodcastPrograms(
        rid,
        ctx.url.searchParams.get('limit') || '30',
        ctx.url.searchParams.get('offset') || '0',
        ctx
      );
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      ctx.logger.error('[PodcastPrograms]', err);
      ctx.sendJSON(ctx.res, { error: err.message, programs: [] }, 500);
    }
    return true;
  }

  return false;
}

export async function handlePodcastAuthenticatedRoutes(ctx: PodcastRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/podcast/my') {
    try {
      const payload = await fetchUserPodcastCollections(ctx);
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      ctx.logger.error('[MyPodcast]', err);
      ctx.sendJSON(ctx.res, { error: err.message, collections: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/podcast/my/items') {
    try {
      const key = String(ctx.url.searchParams.get('key') || 'collect');
      const limit = parseInt(ctx.url.searchParams.get('limit') || '36', 10) || 36;
      const offset = parseInt(ctx.url.searchParams.get('offset') || '0', 10) || 0;
      const payload = await fetchUserPodcastCollectionItems(key, limit, offset, ctx);
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      ctx.logger.error('[MyPodcastItems]', err);
      ctx.sendJSON(ctx.res, { error: err.message, items: [] }, 500);
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
  return (await handlePodcastPublicRoutes(ctx))
    || (await handlePodcastAuthenticatedRoutes(ctx))
    || handlePodcastBeatmapRoutes(ctx);
}
