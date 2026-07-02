export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type PodcastRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
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
  now: () => number;
  logger: Pick<Console, 'log' | 'error'>;
};

export async function handlePodcastRoutes(ctx: PodcastRouteContext): Promise<boolean> {
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
