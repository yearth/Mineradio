export type RootRouteRequest = {
  pathname: string;
  url: URL;
  req: unknown;
  res: unknown;
};

type AsyncRouteHandler = (ctx: any) => Promise<boolean> | boolean;
type ContextFactory = (deps: any, route: any) => any;
type DependencyFactory = () => any;

export type RootRouteDispatcherDependencies = {
  neteaseSongUrlRoute: string;
  rootDir: string;
  appRouteDependencies: any;
  updateRouteDependencies: any;
  beatmapRouteDependencies: any;
  createDiscoverRouteDependencies: DependencyFactory;
  createWeatherRouteDependencies: DependencyFactory;
  createSearchRouteDependencies: DependencyFactory;
  createQQRouteDependencies: DependencyFactory;
  createPodcastRouteDependencies: DependencyFactory;
  createNeteaseMediaRouteDependencies: DependencyFactory;
  createNeteaseAuthRouteDependencies: DependencyFactory;
  createNeteaseLibraryRouteDependencies: DependencyFactory;
  createMediaRouteDependencies: DependencyFactory;
  createAppRouteContext: ContextFactory;
  createUpdateRouteContext: ContextFactory;
  createBeatmapRouteContext: ContextFactory;
  createDiscoverRouteContext: ContextFactory;
  createWeatherRouteContext: ContextFactory;
  createSearchRouteContext: ContextFactory;
  createQQRouteContext: ContextFactory;
  createPodcastRouteContext: ContextFactory;
  createNeteaseMediaRouteContext: ContextFactory;
  createNeteaseAuthRouteContext: ContextFactory;
  createNeteaseLibraryRouteContext: ContextFactory;
  createMediaRouteContext: ContextFactory;
  handleAppRoutes: AsyncRouteHandler;
  handleUpdateRoutes: AsyncRouteHandler;
  handleBeatmapRoutes: AsyncRouteHandler;
  handleDiscoverRoutes: AsyncRouteHandler;
  handleWeatherRoutes: AsyncRouteHandler;
  handleSearchRoutes: AsyncRouteHandler;
  handleQQRoutes: AsyncRouteHandler;
  handlePodcastPublicRoutes: AsyncRouteHandler;
  handlePodcastAuthenticatedRoutes: AsyncRouteHandler;
  handleNeteaseMediaRoutes: AsyncRouteHandler;
  handleNeteaseAuthRoutes: AsyncRouteHandler;
  handlePodcastBeatmapRoutes: AsyncRouteHandler;
  handleNeteaseLibraryRoutes: AsyncRouteHandler;
  handleMediaRoutes: AsyncRouteHandler;
  resolveStaticFilePath: (pathname: string, rootDir: string) => unknown;
  serveStatic: (res: unknown, filePath: unknown) => void;
};

export async function dispatchRootRoute(
  route: RootRouteRequest,
  deps: RootRouteDispatcherDependencies
): Promise<boolean> {
  const pn = route.pathname;
  const { url, req, res } = route;

  if (await deps.handleAppRoutes(deps.createAppRouteContext(
    deps.appRouteDependencies,
    { pathname: pn, res }
  ))) return true;

  if (await deps.handleUpdateRoutes(deps.createUpdateRouteContext(
    deps.updateRouteDependencies,
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleBeatmapRoutes(deps.createBeatmapRouteContext(
    deps.beatmapRouteDependencies,
    { pathname: pn, url, req, res }
  ))) return true;

  if (await deps.handleDiscoverRoutes(deps.createDiscoverRouteContext(
    deps.createDiscoverRouteDependencies(),
    { pathname: pn, res }
  ))) return true;

  if (await deps.handleWeatherRoutes(deps.createWeatherRouteContext(
    deps.createWeatherRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleSearchRoutes(deps.createSearchRouteContext(
    deps.createSearchRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleQQRoutes(deps.createQQRouteContext(
    deps.createQQRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return true;

  if (await deps.handlePodcastPublicRoutes(deps.createPodcastRouteContext(
    deps.createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handlePodcastAuthenticatedRoutes(deps.createPodcastRouteContext(
    deps.createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (pn === deps.neteaseSongUrlRoute && await deps.handleNeteaseMediaRoutes(deps.createNeteaseMediaRouteContext(
    deps.createNeteaseMediaRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleNeteaseAuthRoutes(deps.createNeteaseAuthRouteContext(
    deps.createNeteaseAuthRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return true;

  if (await deps.handlePodcastBeatmapRoutes(deps.createPodcastRouteContext(
    deps.createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleNeteaseLibraryRoutes(deps.createNeteaseLibraryRouteContext(
    deps.createNeteaseLibraryRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return true;

  if (await deps.handleNeteaseMediaRoutes(deps.createNeteaseMediaRouteContext(
    deps.createNeteaseMediaRouteDependencies(),
    { pathname: pn, url, res }
  ))) return true;

  if (await deps.handleMediaRoutes(deps.createMediaRouteContext(
    deps.createMediaRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return true;

  deps.serveStatic(res, deps.resolveStaticFilePath(pn, deps.rootDir));
  return true;
}
