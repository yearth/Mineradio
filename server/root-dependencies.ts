import {
  createNeteaseMediaRouteContext,
  type NeteaseMediaRouteDependencies,
} from './composition/netease-media-context';
import {
  createNeteaseAuthRouteContext,
  type NeteaseAuthRouteDependencies,
} from './composition/netease-auth-context';
import {
  createNeteaseLibraryRouteContext,
  type NeteaseLibraryRouteDependencies,
} from './composition/netease-library-context';
import {
  createPodcastRouteContext,
  type PodcastRouteDependencies,
} from './composition/podcast-context';
import {
  createQQRouteContext,
  type QQRouteDependencies,
} from './composition/qq-context';
import {
  createAppRouteContext,
  createDiscoverRouteContext,
  createMediaRouteContext,
  createSearchRouteContext,
  createWeatherRouteContext,
  type AppRouteDependencies,
  type DiscoverRouteDependencies,
  type MediaRouteDependencies,
  type SearchRouteDependencies,
  type WeatherRouteDependencies,
} from './composition/simple-route-contexts';
import {
  createBeatmapRouteContext,
  createUpdateRouteContext,
  type BeatmapRouteDependencies,
  type UpdateRouteDependencies,
} from './composition/ops-route-contexts';
import { handleAppRoutes } from './controllers/app-controller';
import { handleUpdateRoutes } from './controllers/update-controller';
import { handleWeatherRoutes } from './controllers/weather-controller';
import { handleDiscoverRoutes } from './controllers/discover-controller';
import { handleBeatmapRoutes } from './controllers/beatmap-controller';
import {
  handlePodcastAuthenticatedRoutes,
  handlePodcastBeatmapRoutes,
  handlePodcastPublicRoutes,
} from './controllers/podcast-controller';
import { handleQQRoutes } from './controllers/qq-controller';
import { handleSearchRoutes } from './controllers/search-controller';
import { handleNeteaseAuthRoutes } from './controllers/netease-auth-controller';
import { handleNeteaseLibraryRoutes } from './controllers/netease-library-controller';
import { handleNeteaseMediaRoutes } from './controllers/netease-media-controller';
import { handleMediaRoutes } from './controllers/media-controller';
import { resolveStaticFilePath } from './static-utils';
import type { RootRouteDispatcherDependencies } from './root-dispatcher';

export type RootRouteRuntimeDependencies = {
  neteaseSongUrlRoute: string;
  rootDir: string;
  appRouteDependencies: AppRouteDependencies;
  updateRouteDependencies: UpdateRouteDependencies;
  beatmapRouteDependencies: BeatmapRouteDependencies;
  createDiscoverRouteDependencies: () => DiscoverRouteDependencies;
  createWeatherRouteDependencies: () => WeatherRouteDependencies;
  createSearchRouteDependencies: () => SearchRouteDependencies;
  createQQRouteDependencies: () => QQRouteDependencies;
  createPodcastRouteDependencies: () => PodcastRouteDependencies;
  createNeteaseMediaRouteDependencies: () => NeteaseMediaRouteDependencies;
  createNeteaseAuthRouteDependencies: () => NeteaseAuthRouteDependencies;
  createNeteaseLibraryRouteDependencies: () => NeteaseLibraryRouteDependencies;
  createMediaRouteDependencies: () => MediaRouteDependencies;
  serveStatic: RootRouteDispatcherDependencies['serveStatic'];
};

export function createRootRouteDispatcherDependencies(
  runtime: RootRouteRuntimeDependencies
): RootRouteDispatcherDependencies {
  return {
    neteaseSongUrlRoute: runtime.neteaseSongUrlRoute,
    rootDir: runtime.rootDir,
    appRouteDependencies: runtime.appRouteDependencies,
    updateRouteDependencies: runtime.updateRouteDependencies,
    beatmapRouteDependencies: runtime.beatmapRouteDependencies,
    createDiscoverRouteDependencies: runtime.createDiscoverRouteDependencies,
    createWeatherRouteDependencies: runtime.createWeatherRouteDependencies,
    createSearchRouteDependencies: runtime.createSearchRouteDependencies,
    createQQRouteDependencies: runtime.createQQRouteDependencies,
    createPodcastRouteDependencies: runtime.createPodcastRouteDependencies,
    createNeteaseMediaRouteDependencies: runtime.createNeteaseMediaRouteDependencies,
    createNeteaseAuthRouteDependencies: runtime.createNeteaseAuthRouteDependencies,
    createNeteaseLibraryRouteDependencies: runtime.createNeteaseLibraryRouteDependencies,
    createMediaRouteDependencies: runtime.createMediaRouteDependencies,
    createAppRouteContext,
    createUpdateRouteContext,
    createBeatmapRouteContext,
    createDiscoverRouteContext,
    createWeatherRouteContext,
    createSearchRouteContext,
    createQQRouteContext,
    createPodcastRouteContext,
    createNeteaseMediaRouteContext,
    createNeteaseAuthRouteContext,
    createNeteaseLibraryRouteContext,
    createMediaRouteContext,
    handleAppRoutes,
    handleUpdateRoutes,
    handleBeatmapRoutes,
    handleDiscoverRoutes,
    handleWeatherRoutes,
    handleSearchRoutes,
    handleQQRoutes,
    handlePodcastPublicRoutes,
    handlePodcastAuthenticatedRoutes,
    handleNeteaseMediaRoutes,
    handleNeteaseAuthRoutes,
    handlePodcastBeatmapRoutes,
    handleNeteaseLibraryRoutes,
    handleMediaRoutes,
    resolveStaticFilePath,
    serveStatic: runtime.serveStatic,
  };
}
