import type { handleAppRoutes } from '../controllers/app-controller';
import type { DiscoverRouteContext } from '../controllers/discover-controller';
import type { MediaRouteContext } from '../controllers/media-controller';
import type { SearchRouteContext } from '../controllers/search-controller';
import type { WeatherRouteContext } from '../controllers/weather-controller';

export type AppRouteContext = Parameters<typeof handleAppRoutes>[0];
export type AppRouteDependencies = Omit<AppRouteContext, 'pathname' | 'res'>;
export type AppRouteRequestContext = Pick<AppRouteContext, 'pathname' | 'res'>;

export type DiscoverRouteDependencies = Omit<DiscoverRouteContext, 'pathname' | 'res'>;
export type DiscoverRouteRequestContext = Pick<DiscoverRouteContext, 'pathname' | 'res'>;

export type WeatherRouteDependencies = Omit<WeatherRouteContext, 'pathname' | 'url' | 'res'>;
export type WeatherRouteRequestContext = Pick<WeatherRouteContext, 'pathname' | 'url' | 'res'>;

export type SearchRouteDependencies = Omit<SearchRouteContext, 'pathname' | 'url' | 'res'>;
export type SearchRouteRequestContext = Pick<SearchRouteContext, 'pathname' | 'url' | 'res'>;

export type MediaRouteDependencies = Omit<MediaRouteContext, 'pathname' | 'url' | 'req' | 'res'>;
export type MediaRouteRequestContext = Pick<MediaRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export function createAppRouteContext(
  deps: AppRouteDependencies,
  route: AppRouteRequestContext
): AppRouteContext {
  return {
    pathname: route.pathname,
    res: route.res,
    sendJSON: deps.sendJSON,
    packageInfo: deps.packageInfo,
    appVersion: deps.appVersion,
    updateConfig: deps.updateConfig,
    buildAppVersionPayload: deps.buildAppVersionPayload,
  };
}

export function createDiscoverRouteContext(
  deps: DiscoverRouteDependencies,
  route: DiscoverRouteRequestContext
): DiscoverRouteContext {
  return {
    pathname: route.pathname,
    res: route.res,
    sendJSON: deps.sendJSON,
    handleDiscoverHome: deps.handleDiscoverHome,
    logger: deps.logger,
  };
}

export function createWeatherRouteContext(
  deps: WeatherRouteDependencies,
  route: WeatherRouteRequestContext
): WeatherRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    res: route.res,
    sendJSON: deps.sendJSON,
    buildWeatherRadio: deps.buildWeatherRadio,
    fetchIpWeatherLocation: deps.fetchIpWeatherLocation,
    logger: deps.logger,
  };
}

export function createSearchRouteContext(
  deps: SearchRouteDependencies,
  route: SearchRouteRequestContext
): SearchRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    res: route.res,
    sendJSON: deps.sendJSON,
    handleSearch: deps.handleSearch,
    logger: deps.logger,
  };
}

export function createMediaRouteContext(
  deps: MediaRouteDependencies,
  route: MediaRouteRequestContext
): MediaRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    req: route.req,
    res: route.res,
    fetch: deps.fetch,
    audioProxyHeadersFor: deps.audioProxyHeadersFor,
    audioContentTypeForUrl: deps.audioContentTypeForUrl,
    userAgent: deps.userAgent,
    logger: deps.logger,
  };
}
