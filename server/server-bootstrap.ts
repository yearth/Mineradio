import type {
  CreateHttpServerOptions,
  CreateRequestHandlerOptions,
  ListenIfNeededOptions,
} from './http-utils';
import type {
  RootRouteDispatcherDependencies,
  RootRouteRequest,
} from './root-dispatcher';

export type ServerBootstrapOptions<TServer> = {
  readonly port: string | number;
  readonly host: string;
  readonly env: ListenIfNeededOptions['env'];
  readonly hasUserCookie: boolean;
  readonly routeDependencies: RootRouteDispatcherDependencies;
  readonly createServer: CreateHttpServerOptions<TServer>['createServer'];
  readonly createHttpServer: (options: CreateHttpServerOptions<TServer>) => TServer;
  readonly createRequestHandler: (options: CreateRequestHandlerOptions) => CreateHttpServerOptions<TServer>['requestHandler'];
  readonly dispatchRootRoute: (
    request: RootRouteRequest,
    deps: RootRouteDispatcherDependencies
  ) => Promise<boolean> | boolean;
  readonly listenIfNeeded: (options: ListenIfNeededOptions) => boolean;
};

export function createServerBootstrap<TServer extends ListenIfNeededOptions['server']>(
  options: ServerBootstrapOptions<TServer>
): TServer {
  const server = options.createHttpServer({
    createServer: options.createServer,
    requestHandler: options.createRequestHandler({
      port: options.port,
      handleRequest: ({ req, res, url, pathname }) => options.dispatchRootRoute(
        { pathname, url, req, res },
        options.routeDependencies
      ),
    }),
  });

  options.listenIfNeeded({
    server,
    env: options.env,
    port: options.port,
    host: options.host,
    hasUserCookie: options.hasUserCookie,
  });

  return server;
}
