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
