import type { PodcastRouteContext } from '../controllers/podcast-controller';

export type PodcastRouteDependencies = Omit<PodcastRouteContext, 'pathname' | 'url' | 'res' | 'userCookie'> & {
  readonly getUserCookie: () => string;
};

export type RouteRequestContext = Pick<PodcastRouteContext, 'pathname' | 'url' | 'res'>;

export function createPodcastRouteContext(
  deps: PodcastRouteDependencies,
  route: RouteRequestContext
): PodcastRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    res: route.res,
    sendJSON: deps.sendJSON,
    cloudsearch: deps.cloudsearch,
    djHot: deps.djHot,
    djDetail: deps.djDetail,
    djProgram: deps.djProgram,
    mapPodcastRadio: deps.mapPodcastRadio,
    mapPodcastProgram: deps.mapPodcastProgram,
    getLoginInfo: deps.getLoginInfo,
    fetchMyPodcastItems: deps.fetchMyPodcastItems,
    podcastCollectionMeta: deps.podcastCollectionMeta,
    analyzePodcastDjStream: deps.analyzePodcastDjStream,
    analyzePodcastDjIntro: deps.analyzePodcastDjIntro,
    userAgent: deps.userAgent,
    userCookie: deps.getUserCookie(),
    timestamp: deps.timestamp,
    now: deps.now,
    logger: deps.logger,
  };
}
