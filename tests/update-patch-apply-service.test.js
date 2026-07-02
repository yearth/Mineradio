const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  backupPatchTarget,
  writePatchFile,
} = require('../server-dist/server/services/update-patch-apply');

function memoryFs(files = {}) {
  const state = {
    files: new Map(Object.entries(files).map(([key, value]) => [key, Buffer.from(value)])),
    dirs: [],
    copied: [],
    written: [],
    renamed: [],
  };
  return {
    state,
    existsSync(filePath) {
      return state.files.has(filePath);
    },
    mkdirSync(dir) {
      state.dirs.push(dir);
    },
    copyFileSync(from, to) {
      if (!state.files.has(from)) throw new Error('ENOENT');
      state.files.set(to, Buffer.from(state.files.get(from)));
      state.copied.push([from, to]);
    },
    writeFileSync(filePath, content) {
      state.files.set(filePath, Buffer.from(content));
      state.written.push([filePath, Buffer.from(content)]);
    },
    renameSync(from, to) {
      if (!state.files.has(from)) throw new Error('ENOENT');
      state.files.set(to, state.files.get(from));
      state.files.delete(from);
      state.renamed.push([from, to]);
    },
    readFileSync(filePath) {
      if (!state.files.has(filePath)) throw new Error('ENOENT');
      return state.files.get(filePath);
    },
  };
}

const pathApi = {
  dirname(filePath) {
    return filePath.split('/').slice(0, -1).join('/') || '/';
  },
  join(...parts) {
    return parts.join('/').replace(/\/+/g, '/');
  },
};

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function deps(fsApi, overrides = {}) {
  return {
    fs: fsApi,
    path: pathApi,
    backupDir: '/backups',
    patchTargetPath(rel) {
      return '/app/' + rel;
    },
    safePatchRelativePath(value) {
      const raw = String(value || '');
      return raw.includes('..') || raw.includes('\\') ? '' : raw;
    },
    decodePatchFile(file) {
      if (file.contentBase64) return Buffer.from(file.contentBase64, 'base64');
      if (file.content) return Buffer.from(file.content);
      return null;
    },
    sha256Hex: sha256,
    maxBytes: 1024,
    ...overrides,
  };
}

test('backupPatchTarget preserves legacy backup path under job id and relative file path', () => {
  const fsApi = memoryFs({ '/app/public/index.html': 'old html' });

  backupPatchTarget({ id: 'job-1' }, 'public/index.html', '/app/public/index.html', deps(fsApi));

  assert.deepEqual(fsApi.state.dirs, ['/backups/job-1/public']);
  assert.deepEqual(fsApi.state.copied, [['/app/public/index.html', '/backups/job-1/public/index.html']]);
  assert.equal(fsApi.state.files.get('/backups/job-1/public/index.html').toString(), 'old html');
});

test('backupPatchTarget skips missing target files', () => {
  const fsApi = memoryFs();

  backupPatchTarget({ id: 'job-1' }, 'public/index.html', '/app/public/index.html', deps(fsApi));

  assert.deepEqual(fsApi.state.dirs, []);
  assert.deepEqual(fsApi.state.copied, []);
});

test('writePatchFile writes through a temporary file and verifies expected sha256', () => {
  const content = Buffer.from('new html');
  const fsApi = memoryFs({ '/app/public/index.html': 'old html' });

  const rel = writePatchFile({ id: 'job-1' }, {
    path: 'public/index.html',
    contentBase64: content.toString('base64'),
    sha256: sha256(content),
  }, deps(fsApi));

  assert.equal(rel, 'public/index.html');
  assert.deepEqual(fsApi.state.copied, [['/app/public/index.html', '/backups/job-1/public/index.html']]);
  assert.deepEqual(fsApi.state.written.map(item => item[0]), ['/app/public/index.html.mineradio-patch']);
  assert.deepEqual(fsApi.state.renamed, [['/app/public/index.html.mineradio-patch', '/app/public/index.html']]);
  assert.equal(fsApi.state.files.get('/app/public/index.html').toString(), 'new html');
});

test('writePatchFile preserves legacy validation errors', () => {
  const fsApi = memoryFs();
  const base = deps(fsApi);

  assert.throws(
    () => writePatchFile({ id: 'job-1' }, { path: '../secret.txt', content: 'x' }, base),
    /INVALID_PATCH_FILE/
  );
  assert.throws(
    () => writePatchFile({ id: 'job-1' }, { path: 'public/index.html' }, base),
    /INVALID_PATCH_FILE/
  );
  assert.throws(
    () => writePatchFile({ id: 'job-1' }, { path: 'public/index.html', content: 'too large' }, deps(fsApi, { maxBytes: 3 })),
    /PATCH_FILE_TOO_LARGE/
  );
  assert.throws(
    () => writePatchFile({ id: 'job-1' }, { path: 'public/index.html', content: 'x', sha256: 'bad' }, base),
    /PATCH_HASH_MISMATCH:public\/index\.html/
  );
});

test('writePatchFile verifies content after rename', () => {
  const fsApi = memoryFs();
  fsApi.renameSync = (from, to) => {
    fsApi.state.files.set(to, Buffer.from('corrupted'));
    fsApi.state.files.delete(from);
  };

  assert.throws(
    () => writePatchFile({ id: 'job-1' }, {
      path: 'public/index.html',
      content: 'new html',
      sha256: sha256(Buffer.from('new html')),
    }, deps(fsApi)),
    /PATCH_WRITE_VERIFY_FAILED:public\/index\.html/
  );
});
