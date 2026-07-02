export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type DiscoverRouteContext = {
  pathname: string;
  res: unknown;
  sendJSON: JsonSender;
  handleDiscoverHome: () => Promise<unknown>;
  logger: Pick<Console, 'error'>;
};

export async function handleDiscoverRoutes(ctx: DiscoverRouteContext): Promise<boolean> {
  if (ctx.pathname !== '/api/discover/home') return false;

  try {
    ctx.sendJSON(ctx.res, await ctx.handleDiscoverHome());
  } catch (err: any) {
    ctx.logger.error('[DiscoverHome]', err);
    ctx.sendJSON(ctx.res, {
      error: err.message,
      loggedIn: false,
      dailySongs: [],
      playlists: [],
      podcasts: [],
    }, 500);
  }
  return true;
}
