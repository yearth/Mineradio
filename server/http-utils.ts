export function createRequestUrl(rawUrl: string | undefined, port: string | number): URL {
  return new URL(rawUrl === undefined ? 'undefined' : rawUrl, `http://localhost:${port}`);
}

export function shouldAutoListen(env: { readonly NODE_ENV?: string } = {}): boolean {
  return env.NODE_ENV !== 'test';
}

export interface StartupBannerOptions {
  readonly port: string | number;
  readonly hasUserCookie: boolean;
}

export interface ListenableServer {
  listen(port: string | number, host: string, callback: () => void): unknown;
}

export interface HttpServerFactory<TServer> {
  createServer(requestHandler: (req: unknown, res: unknown) => unknown): TServer;
}

export interface CreateHttpServerOptions<TServer> {
  readonly createServer: HttpServerFactory<TServer>['createServer'];
  readonly requestHandler: (req: unknown, res: unknown) => unknown;
}

export interface RequestHandlerContext {
  readonly req: { readonly url?: string };
  readonly res: unknown;
  readonly url: URL;
  readonly pathname: string;
}

export interface CreateRequestHandlerOptions {
  readonly port: string | number;
  readonly handleRequest: (context: RequestHandlerContext) => unknown;
}

export interface StartupLogger {
  log(message: string): void;
}

export interface JsonResponse {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body: string): unknown;
}

export interface ListenIfNeededOptions extends StartupBannerOptions {
  readonly server: ListenableServer;
  readonly host: string;
  readonly env?: { readonly NODE_ENV?: string };
  readonly logger?: StartupLogger;
}

export function startupBannerLines(options: StartupBannerOptions): string[] {
  return [
    '======================================================',
    ` 粒子音乐可视化 v2  →  http://localhost:${options.port}`,
    ` 登录态: ${options.hasUserCookie ? '已登录(cookie已加载)' : '未登录'}`,
    '======================================================'
  ];
}

export function createHttpServer<TServer>(options: CreateHttpServerOptions<TServer>): TServer {
  return options.createServer(options.requestHandler);
}

export function createRequestHandler(options: CreateRequestHandlerOptions): (req: { readonly url?: string }, res: unknown) => unknown {
  return (req, res) => {
    const url = createRequestUrl(req.url, options.port);
    return options.handleRequest({ req, res, url, pathname: url.pathname });
  };
}

export function sendJson(res: JsonResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(JSON.stringify(data));
}

export function listenIfNeeded(options: ListenIfNeededOptions): boolean {
  if (!shouldAutoListen(options.env)) return false;

  const logger = options.logger || console;
  options.server.listen(options.port, options.host, () => {
    startupBannerLines(options).forEach(line => logger.log(line));
  });
  return true;
}
