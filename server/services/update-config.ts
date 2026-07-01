declare const process: { env: Record<string, string | undefined> };

export interface GitHubRepository {
  readonly owner: string;
  readonly repo: string;
}

export interface PackageUpdateSettings {
  readonly provider?: string;
  readonly repository?: string;
  readonly github?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly preview?: boolean;
  readonly preferMirrors?: boolean;
  readonly mirrors?: unknown;
  readonly downloadMirrors?: unknown;
}

export interface PackageInfo {
  readonly repository?: string | { readonly url?: string };
  readonly mineradio?: {
    readonly update?: PackageUpdateSettings;
  };
}

export interface UpdateConfig {
  readonly provider: string;
  readonly owner: string;
  readonly repo: string;
  readonly configured: boolean;
  readonly preview: boolean;
  readonly preferMirrors: boolean;
  readonly mirrors: string[];
  readonly manifest: string;
}

export function parseGitHubRepository(input: unknown): GitHubRepository | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const direct = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (direct) return { owner: direct[1], repo: direct[2].replace(/\.git$/i, '') };

  const github = raw.match(/github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[#/?].*)?$/i);
  if (github) return { owner: github[1], repo: github[2].replace(/\.git$/i, '') };

  return null;
}

export function parseUpdateMirrorList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[\n,;]/);
}

export function readUpdateMirrors(local: PackageUpdateSettings = {}): string[] {
  const envMirrors = process.env.MINERADIO_UPDATE_MIRRORS || process.env.MINERADIO_UPDATE_MIRROR || '';
  const raw = envMirrors
    ? parseUpdateMirrorList(envMirrors)
    : parseUpdateMirrorList(local.mirrors || local.downloadMirrors || []);
  const seen = new Set<string>();
  const mirrors: string[] = [];

  raw.forEach(item => {
    const url = String(item || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    const key = url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    mirrors.push(url);
  });

  return mirrors.slice(0, 6);
}

export function readUpdateConfig(packageInfo: PackageInfo | null = {}): UpdateConfig {
  const pkg = packageInfo || {};
  const local = (pkg.mineradio && pkg.mineradio.update) || {};
  const repository = pkg.repository;
  const packageRepository = typeof repository === 'string' ? repository : (repository && repository.url);
  const repoHint = process.env.MINERADIO_UPDATE_REPOSITORY
    || process.env.GITHUB_REPOSITORY
    || local.repository
    || local.github
    || packageRepository
    || '';
  const parsed = parseGitHubRepository(repoHint);
  const owner = process.env.MINERADIO_UPDATE_OWNER || local.owner || (parsed && parsed.owner) || '';
  const repo = process.env.MINERADIO_UPDATE_REPO || local.repo || (parsed && parsed.repo) || '';

  return {
    provider: local.provider || 'github',
    owner,
    repo,
    configured: !!(owner && repo),
    preview: local.preview !== false,
    preferMirrors: local.preferMirrors !== false,
    mirrors: readUpdateMirrors(local),
    manifest: process.env.MINERADIO_UPDATE_MANIFEST
      || process.env.MINERADIO_UPDATE_MANIFEST_URL
      || process.env.MINERADIO_UPDATE_MANIFEST_FILE
      || '',
  };
}
