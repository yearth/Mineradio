import type { BeatmapRouteContext } from '../controllers/beatmap-controller';
import type { UpdateRouteContext } from '../controllers/update-controller';

export type UpdateRouteDependencies = Omit<UpdateRouteContext, 'pathname' | 'url' | 'res'>;
export type UpdateRouteRequestContext = Pick<UpdateRouteContext, 'pathname' | 'url' | 'res'>;

export type BeatmapRouteDependencies = Omit<BeatmapRouteContext, 'pathname' | 'url' | 'req' | 'res'>;
export type BeatmapRouteRequestContext = Pick<BeatmapRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export function createUpdateRouteContext(
  deps: UpdateRouteDependencies,
  route: UpdateRouteRequestContext
): UpdateRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    res: route.res,
    sendJSON: deps.sendJSON,
    fetchLatestUpdateInfo: deps.fetchLatestUpdateInfo,
    localUpdateFallback: deps.localUpdateFallback,
    updateConfig: deps.updateConfig,
    startUpdateDownloadJob: deps.startUpdateDownloadJob,
    startUpdatePatchJob: deps.startUpdatePatchJob,
    updateDownloadJobs: deps.updateDownloadJobs,
    publicUpdateJob: deps.publicUpdateJob,
    logger: deps.logger,
  };
}

export function createBeatmapRouteContext(
  deps: BeatmapRouteDependencies,
  route: BeatmapRouteRequestContext
): BeatmapRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    req: route.req,
    res: route.res,
    sendJSON: deps.sendJSON,
    readRequestBody: deps.readRequestBody,
    beatCacheRootInfo: deps.beatCacheRootInfo,
    readBeatMapCache: deps.readBeatMapCache,
    writeBeatMapCache: deps.writeBeatMapCache,
  };
}
