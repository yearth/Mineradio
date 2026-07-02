declare const URL: any;

import {
  buildWeatherMood,
  clampNumber,
  openMeteoWeatherLabel,
} from './weather-utils';

export interface WeatherProviderDeps {
  readonly defaultLocation: any;
  readonly forecastUrl?: string;
  readonly geocodeUrl?: string;
  readonly ipLocationUrl?: string;
  readonly requestJson: (targetUrl: string, opts?: any, body?: any) => Promise<any>;
  readonly userAgent: string;
  readonly now?: () => number;
}

export async function resolveOpenMeteoLocation(query: any, deps: WeatherProviderDeps): Promise<any> {
  const raw = String(query || '').trim();
  if (!raw) return deps.defaultLocation;
  const u = new URL(deps.geocodeUrl);
  u.searchParams.set('name', raw);
  u.searchParams.set('count', '1');
  u.searchParams.set('language', 'zh');
  u.searchParams.set('format', 'json');
  const body = await deps.requestJson(u.toString(), { headers: { 'User-Agent': deps.userAgent } });
  const first = body && Array.isArray(body.results) && body.results[0];
  if (!first) return { ...deps.defaultLocation, query: raw, fallback: true };
  return {
    name: first.name || raw,
    country: first.country || '',
    admin1: first.admin1 || '',
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: first.timezone || 'auto',
  };
}

export async function fetchOpenMeteoWeather(params: any, deps: WeatherProviderDeps): Promise<any> {
  params = params || {};
  let location;
  const lat = clampNumber(params.lat, -90, 90, NaN);
  const lon = clampNumber(params.lon, -180, 180, NaN);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    location = {
      name: String(params.city || params.name || '当前位置').trim() || '当前位置',
      country: '',
      latitude: lat,
      longitude: lon,
      timezone: params.timezone || 'auto',
    };
  } else {
    location = await resolveOpenMeteoLocation(params.city || params.q || params.location, deps);
  }
  const u = new URL(deps.forecastUrl);
  u.searchParams.set('latitude', String(location.latitude));
  u.searchParams.set('longitude', String(location.longitude));
  u.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m');
  u.searchParams.set('hourly', 'precipitation_probability,weather_code,temperature_2m');
  u.searchParams.set('forecast_days', '1');
  u.searchParams.set('timezone', location.timezone || 'auto');
  const body = await deps.requestJson(u.toString(), { headers: { 'User-Agent': deps.userAgent } });
  const cur = body && body.current || {};
  const weather: any = {
    provider: 'open-meteo',
    location: {
      name: location.name,
      country: location.country || '',
      admin1: location.admin1 || '',
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: body.timezone || location.timezone || '',
      fallback: !!location.fallback,
    },
    label: openMeteoWeatherLabel(cur.weather_code),
    weatherCode: Number(cur.weather_code),
    temperature: Number(cur.temperature_2m),
    apparentTemperature: Number(cur.apparent_temperature),
    humidity: Number(cur.relative_humidity_2m),
    precipitation: Number(cur.precipitation || cur.rain || cur.showers || cur.snowfall || 0),
    cloudCover: Number(cur.cloud_cover),
    windSpeed: Number(cur.wind_speed_10m),
    windGusts: Number(cur.wind_gusts_10m),
    isDay: Number(cur.is_day),
    time: cur.time || '',
    updatedAt: deps.now ? deps.now() : Date.now(),
  };
  weather.mood = buildWeatherMood(weather);
  return weather;
}

export async function fetchIpWeatherLocation(deps: WeatherProviderDeps): Promise<any> {
  const u = new URL(deps.ipLocationUrl);
  u.searchParams.set('fields', 'status,message,country,regionName,city,lat,lon,timezone,query');
  u.searchParams.set('lang', 'zh-CN');
  const body = await deps.requestJson(u.toString(), { headers: { 'User-Agent': deps.userAgent } });
  if (!body || body.status !== 'success' || !Number.isFinite(Number(body.lat)) || !Number.isFinite(Number(body.lon))) {
    const err: any = new Error(body && body.message || 'IP_LOCATION_FAILED');
    err.body = body;
    throw err;
  }
  return {
    provider: 'ip-api',
    city: body.city || deps.defaultLocation.name,
    region: body.regionName || '',
    country: body.country || '',
    latitude: Number(body.lat),
    longitude: Number(body.lon),
    timezone: body.timezone || 'auto',
    ip: body.query || '',
  };
}
