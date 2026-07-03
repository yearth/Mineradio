type WeatherRadioDeps = {
  fetchWeather: (params: any) => Promise<any>;
  fallbackWeatherForRadio: (params: any, error: any, defaultLocation: any) => any;
  weatherRadioSeedQueries: (mood: any) => string[];
  searchSongs: (query: string, limit: number) => Promise<any[]>;
  orderWeatherSongs: (songs: any[], mood: any) => any[];
  defaultLocation: any;
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
};

export async function buildWeatherRadio(params: any, deps: WeatherRadioDeps): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  let weather;

  try {
    weather = await deps.fetchWeather(params);
  } catch (error: any) {
    logger.warn('[WeatherRadio] weather provider failed, using fallback radio:', error.message);
    weather = deps.fallbackWeatherForRadio(params, error, deps.defaultLocation);
  }

  const queries = deps.weatherRadioSeedQueries(weather.mood);
  let songs: any[] = [];
  const settled = await Promise.allSettled(queries.slice(0, 4).map(query => deps.searchSongs(query, 6)));
  settled.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) songs = songs.concat(result.value);
  });

  if (songs.length < 10 && weather.mood && Array.isArray(weather.mood.keywords)) {
    const more = await Promise.allSettled(weather.mood.keywords.slice(0, 2).map((query: string) => deps.searchSongs(query, 6)));
    more.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) songs = songs.concat(result.value);
    });
  }

  songs = deps.orderWeatherSongs(songs, weather.mood);
  return {
    ok: true,
    weather,
    radio: {
      title: weather.mood.title,
      subtitle: weather.mood.tagline,
      seedQueries: queries.slice(0, 4),
      songs: songs.slice(0, 18),
      updatedAt: now(),
    },
  };
}
