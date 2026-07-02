declare function require(name: string): any;
declare const fetch: any;

const defaultFs = require('fs');
const defaultPath = require('path');
const { fileURLToPath } = require('url');

export interface ManifestSourceDeps {
  readonly fs?: any;
  readonly path?: any;
  readonly fetch?: any;
  readonly userAgent?: string;
}

export interface FetchManifestDeps extends ManifestSourceDeps {
  readonly readManifest?: (ref: string) => Promise<any>;
  readonly normalizeManifestUpdateInfo: (data: any) => any;
  readonly localUpdateFallback: (reason: string, opts: { configured: boolean }) => any;
}

export async function readUpdateManifest(ref: unknown, deps: ManifestSourceDeps = {}) {
  const value = String(ref || '').trim();
  if (!value) throw new Error('UPDATE_MANIFEST_MISSING');
  if (/^https?:\/\//i.test(value)) {
    const fetchApi = deps.fetch || fetch;
    const resp = await fetchApi(value, {
      headers: { 'User-Agent': deps.userAgent || '' },
    });
    if (!resp.ok) throw new Error('Update manifest ' + resp.status);
    return resp.json();
  }
  const fs = deps.fs || defaultFs;
  const path = deps.path || defaultPath;
  const file = /^file:/i.test(value) ? fileURLToPath(value) : path.resolve(value);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function fetchManifestUpdateInfo(ref: string, deps: FetchManifestDeps) {
  try {
    const readManifest = deps.readManifest || ((value: string) => readUpdateManifest(value, deps));
    const data = await readManifest(ref);
    return deps.normalizeManifestUpdateInfo(data);
  } catch (err: any) {
    return deps.localUpdateFallback(err.message || 'Update manifest failed', { configured: true });
  }
}
