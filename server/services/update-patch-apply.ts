declare function require(name: string): any;

const defaultFs = require('fs');
const defaultPath = require('path');
const {
  sha256Hex: defaultSha256Hex,
} = require('./update-file-cache');
const {
  decodePatchFile: defaultDecodePatchFile,
  safePatchRelativePath: defaultSafePatchRelativePath,
} = require('./update-patch-payload');

export interface UpdatePatchApplyDeps {
  readonly fs?: any;
  readonly path?: any;
  readonly backupDir: string;
  readonly patchTargetPath: (rel: string) => string | null;
  readonly safePatchRelativePath?: (value: unknown) => string;
  readonly decodePatchFile?: (file: any) => any;
  readonly sha256Hex?: (buffer: any) => string;
  readonly maxBytes: number;
}

function depsWithDefaults(deps: UpdatePatchApplyDeps) {
  return {
    fs: deps.fs || defaultFs,
    path: deps.path || defaultPath,
    backupDir: deps.backupDir,
    patchTargetPath: deps.patchTargetPath,
    safePatchRelativePath: deps.safePatchRelativePath || defaultSafePatchRelativePath,
    decodePatchFile: deps.decodePatchFile || defaultDecodePatchFile,
    sha256Hex: deps.sha256Hex || defaultSha256Hex,
    maxBytes: deps.maxBytes,
  };
}

export function backupPatchTarget(job: any, rel: string, target: string, deps: UpdatePatchApplyDeps): void {
  const { fs, path, backupDir } = depsWithDefaults(deps);
  if (!fs.existsSync(target)) return;
  const backup = path.join(backupDir, job.id, rel);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(target, backup);
}

export function writePatchFile(job: any, file: any, deps: UpdatePatchApplyDeps): string {
  const resolved = depsWithDefaults(deps);
  const { fs, path, maxBytes, patchTargetPath, safePatchRelativePath, decodePatchFile, sha256Hex } = resolved;
  const rel = safePatchRelativePath(file.path || file.name);
  const target = rel ? patchTargetPath(rel) : null;
  const content = decodePatchFile(file);
  if (!rel || !target || !content) throw new Error('INVALID_PATCH_FILE');
  if (content.length > maxBytes) throw new Error('PATCH_FILE_TOO_LARGE');
  const expected = String(file.sha256 || '').trim().toLowerCase();
  const actual = sha256Hex(content);
  if (expected && expected !== actual) throw new Error('PATCH_HASH_MISMATCH:' + rel);
  backupPatchTarget(job, rel, target, deps);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.mineradio-patch';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, target);
  if (expected && sha256Hex(fs.readFileSync(target)) !== expected) throw new Error('PATCH_WRITE_VERIFY_FAILED:' + rel);
  return rel;
}
