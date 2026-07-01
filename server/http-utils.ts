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

export interface StartupLogger {
  log(message: string): void;
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

export function listenIfNeeded(options: ListenIfNeededOptions): boolean {
  if (!shouldAutoListen(options.env)) return false;

  const logger = options.logger || console;
  options.server.listen(options.port, options.host, () => {
    startupBannerLines(options).forEach(line => logger.log(line));
  });
  return true;
}
