declare function require(name: string): any;

const fs = require('fs');

export function readPackageInfo(packagePath: string, deps?: { fs?: any }): Record<string, unknown> {
  const fsDep = deps && deps.fs ? deps.fs : fs;
  try {
    const raw = fsDep.readFileSync(packagePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function buildAppVersionPayload(opts: {
  packageInfo?: any;
  appVersion?: string;
  updateConfig?: any;
}): Record<string, unknown> {
  const packageInfo = opts.packageInfo || {};
  const updateConfig = opts.updateConfig || {};
  return {
    name: packageInfo.name || 'mineradio',
    productName: packageInfo.productName || 'Mineradio',
    version: opts.appVersion,
    update: {
      provider: updateConfig.provider,
      configured: updateConfig.configured,
      owner: updateConfig.owner,
      repo: updateConfig.repo,
      preview: updateConfig.preview,
      manifestOverride: !!updateConfig.manifest,
    },
  };
}
