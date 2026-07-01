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

export function startupBannerLines(options: StartupBannerOptions): string[] {
  return [
    '======================================================',
    ` 粒子音乐可视化 v2  →  http://localhost:${options.port}`,
    ` 登录态: ${options.hasUserCookie ? '已登录(cookie已加载)' : '未登录'}`,
    '======================================================'
  ];
}
