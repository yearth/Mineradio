export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export async function handleAppRoutes(ctx: {
  pathname: string;
  res: unknown;
  sendJSON: JsonSender;
  packageInfo: Record<string, unknown>;
  appVersion: string;
  updateConfig: Record<string, unknown>;
  buildAppVersionPayload: (opts: {
    packageInfo: Record<string, unknown>;
    appVersion: string;
    updateConfig: Record<string, unknown>;
  }) => Record<string, unknown>;
}): Promise<boolean> {
  if (ctx.pathname !== '/api/app/version') return false;
  ctx.sendJSON(ctx.res, ctx.buildAppVersionPayload({
    packageInfo: ctx.packageInfo,
    appVersion: ctx.appVersion,
    updateConfig: ctx.updateConfig,
  }));
  return true;
}
