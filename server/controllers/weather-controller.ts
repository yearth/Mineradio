export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type WeatherRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
  buildWeatherRadio: (params: {
    city: string;
    lat: string | null;
    lon: string | null;
    timezone: string;
  }) => Promise<unknown>;
  fetchIpWeatherLocation: () => Promise<unknown>;
  logger: Pick<Console, 'error'>;
};

export async function handleWeatherRoutes(ctx: WeatherRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/weather/radio') {
    try {
      const data = await ctx.buildWeatherRadio({
        city: ctx.url.searchParams.get('city') || ctx.url.searchParams.get('q') || '',
        lat: ctx.url.searchParams.get('lat'),
        lon: ctx.url.searchParams.get('lon'),
        timezone: ctx.url.searchParams.get('timezone') || '',
      });
      ctx.sendJSON(ctx.res, data);
    } catch (err: any) {
      ctx.logger.error('[WeatherRadio]', err);
      ctx.sendJSON(ctx.res, {
        ok: false,
        error: err.message,
        weather: null,
        radio: { title: '天气电台', subtitle: '天气暂时没有回来，可以先听今日推荐。', seedQueries: [], songs: [] },
      }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/weather/ip-location') {
    try {
      ctx.sendJSON(ctx.res, { ok: true, location: await ctx.fetchIpWeatherLocation() });
    } catch (err: any) {
      ctx.logger.error('[WeatherIpLocation]', err);
      ctx.sendJSON(ctx.res, { ok: false, error: err.message, location: null }, 500);
    }
    return true;
  }

  return false;
}
