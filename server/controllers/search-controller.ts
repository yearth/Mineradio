export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type SearchRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
  handleSearch: (keywords: string, limit: number) => Promise<unknown>;
  logger: Pick<Console, 'error'>;
};

export async function handleSearchRoutes(ctx: SearchRouteContext): Promise<boolean> {
  if (ctx.pathname !== '/api/search') return false;

  try {
    const keywords = ctx.url.searchParams.get('keywords') || '';
    const limit = parseInt(ctx.url.searchParams.get('limit') || '20');
    const songs = await ctx.handleSearch(keywords, limit);
    ctx.sendJSON(ctx.res, { songs });
  } catch (err: any) {
    ctx.logger.error('[Search]', err);
    ctx.sendJSON(ctx.res, { error: err.message, songs: [] }, 500);
  }
  return true;
}
