# Mineradio QQ Read Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the non-UI refactor by moving QQ lyric, artist detail, and song comments orchestration out of `server.js` into typed TS services while preserving behavior and 100% production line coverage.

**Architecture:** Keep root `server.js` as the compatibility entry, runtime-state holder, and dependency-injection boundary. Extend `server/services/qq-orchestration.ts` with read-only QQ orchestration functions; route/controllers remain unchanged and call the same `handleQQ*` wrappers. Tests drive each migration before implementation.

**Tech Stack:** Node.js, Electron, TypeScript compiled to `server-dist`, Node built-in test runner, `npm run coverage` with 100% production line coverage gate.

## Global Constraints

- Do not touch UI in this plan.
- Do not refactor QQ playback URL logic in this plan.
- Keep root `server.js` compatible with existing `__test` hooks and route dependency factories.
- Keep behavior-equivalent response shapes, error strings, QQ API URLs, query params, and `Referer` headers.
- Add service-level tests first, verify RED, then implement.
- Every slice must pass focused tests, static checks, full tests, and coverage.
- Use QA subagent before claiming completion.
- Update `.agent/handoff.md` after the verified slice.
- Commit only source/test/handoff files; do not stage `dist/`, `server-dist/`, or coverage artifacts.

---

## File Structure

- Modify: `server/services/qq-orchestration.ts`
  - Add `fetchQQArtistDetail(...)`, `fetchQQSongComments(...)`, and `fetchQQLyric(...)`.
  - Keep dependency injection explicit: `qqMusicRequest`, `qqGetJSON`, mappers, decoders, ID normalizers, cookie helpers, and logger come from `server.js`.
- Modify: `server.js`
  - Import new service functions from `./server-dist/server/services/qq-orchestration`.
  - Keep `handleQQArtistDetail`, `handleQQSongComments`, and `handleQQLyric` as thin wrappers.
- Modify: `tests/qq-orchestration-service.test.js`
  - Extend existing service tests with artist, comments, and lyric cases.
- Modify: `.agent/handoff.md`
  - Record latest verified QQ read orchestration slice, commands, coverage, QA result, and commit.

---

### Task 1: QQ Artist Detail Orchestration

**Files:**
- Modify: `tests/qq-orchestration-service.test.js`
- Modify: `server/services/qq-orchestration.ts`
- Modify: `server.js`

**Interfaces:**
- Consumes:
  - `qqMusicRequest(payload, opts)`
  - `mapQQTrack(track, fallback)`
  - `qqSingerAvatar(singerMid, size)`
- Produces:
  - `fetchQQArtistDetail(mid: unknown, limit: unknown, deps: FetchQQArtistDetailDeps): Promise<Record<string, unknown>>`

- [ ] **Step 1: Write failing artist detail service tests**

Add tests to `tests/qq-orchestration-service.test.js`:

```js
test('fetchQQArtistDetail returns missing-singer payload without upstream calls', async () => {
  let called = false;
  const result = await fetchQQArtistDetail('   ', 36, {
    qqMusicRequest: async () => { called = true; return {}; },
    mapQQTrack,
    qqSingerAvatar,
  });

  assert.deepEqual(result, { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] });
  assert.equal(called, false);
});

test('fetchQQArtistDetail clamps limits and maps artist songs', async () => {
  const calls = [];
  const result = await fetchQQArtistDetail('singer001', 500, {
    qqMusicRequest: async (payload, opts) => {
      calls.push({ payload, opts });
      return {
        singer: {
          code: 0,
          data: {
            singer_info: { id: 66, mid: 'singer001', name: 'QQ Artist', pic: 'artist.jpg', fans: 12 },
            total_song: 2,
            total_album: 3,
            total_mv: 4,
            songlist: [
              {
                track_info: {
                  mid: 'song001',
                  name: 'Song One',
                  singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
                  album: { mid: 'album001', name: 'Album One' },
                  interval: 201,
                },
              },
            ],
          },
        },
      };
    },
    mapQQTrack,
    qqSingerAvatar,
  });

  assert.equal(calls[0].payload.singer.param.num, 80);
  assert.deepEqual(calls[0].opts, { cookie: true });
  assert.equal(result.artist.name, 'QQ Artist');
  assert.equal(result.artist.avatar, 'artist.jpg');
  assert.equal(result.total, 2);
  assert.equal(result.songs[0].id, 'song001');
});

test('fetchQQArtistDetail returns provider errors and fallback artist names', async () => {
  const failed = await fetchQQArtistDetail('singer001', 4, {
    qqMusicRequest: async () => ({ singer: { code: 1000, message: 'artist unavailable' } }),
    mapQQTrack,
    qqSingerAvatar,
  });
  assert.deepEqual(failed, { provider: 'qq', error: 'artist unavailable', artist: null, songs: [] });

  const fallback = await fetchQQArtistDetail('fallbackSinger', 4, {
    qqMusicRequest: async () => ({
      singer: {
        code: 0,
        data: {
          singerInfo: {},
          song_count: 1,
          songlist: [
            {
              mid: 'song002',
              name: 'Fallback Song',
              singer: [{ mid: 'fallbackSinger', name: 'Fallback Name' }],
              album: {},
            },
          ],
        },
      },
    }),
    mapQQTrack,
    qqSingerAvatar,
  });
  assert.equal(fallback.artist.mid, 'fallbackSinger');
  assert.equal(fallback.artist.name, 'Fallback Name');
  assert.match(fallback.artist.avatar, /T001R300x300M000fallbackSinger/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js
```

Expected: fail with `fetchQQArtistDetail is not a function` or missing export.

- [ ] **Step 3: Implement `fetchQQArtistDetail`**

Move the current `handleQQArtistDetail` body from `server.js` into `server/services/qq-orchestration.ts` with injected deps:

```ts
type FetchQQArtistDetailDeps = {
  qqMusicRequest: (payload: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<any>;
  mapQQTrack: (track: any, fallback: any) => Record<string, unknown>;
  qqSingerAvatar: (singerMid: unknown, size?: number) => string;
};
```

Preserve:
- missing-mid payload: `{ provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] }`
- limit clamp: `Math.max(10, Math.min(80, parseInt(limit || '36', 10) || 36))`
- QQ module/method: `music.web_singer_info_svr` / `get_singer_detail_info`
- nonzero response error fallback: `message || msg || code || 'QQ_ARTIST_DETAIL_FAILED'`
- fallback artist name from first mapped song artist matching `singerMid`

- [ ] **Step 4: Thin `server.js` wrapper**

Replace `handleQQArtistDetail` with:

```js
async function handleQQArtistDetail(mid, limit) {
  return fetchQQArtistDetail(mid, limit, {
    qqMusicRequest,
    mapQQTrack,
    qqSingerAvatar,
  });
}
```

- [ ] **Step 5: Verify artist slice**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/music-routes.test.js
node --check server.js
npm run typecheck
git diff --check
```

Expected: all pass.

---

### Task 2: QQ Song Comments Orchestration

**Files:**
- Modify: `tests/qq-orchestration-service.test.js`
- Modify: `server/services/qq-orchestration.ts`
- Modify: `server.js`

**Interfaces:**
- Consumes:
  - `qqSongDetail(mid, fallback)`
  - `qqGetJSON(url, params, opts)`
  - `qqCookieUin()`
  - `buildQQSongCommentsPayload(body, topid, limit, offset)`
  - `logger.warn(...)`
- Produces:
  - `fetchQQSongComments(id: unknown, mid: unknown, limit: unknown, offset: unknown, deps: FetchQQSongCommentsDeps): Promise<Record<string, unknown>>`

- [ ] **Step 1: Write failing song comments service tests**

Add tests:

```js
test('fetchQQSongComments returns missing id when id and detail fallback cannot resolve topid', async () => {
  const warnings = [];
  const result = await fetchQQSongComments('', 'missing-mid', 20, 0, {
    qqSongDetail: async () => { throw new Error('detail failed'); },
    qqGetJSON: async () => { throw new Error('should not fetch comments'); },
    qqCookieUin: () => '12345',
    buildQQSongCommentsPayload,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.deepEqual(result, { provider: 'qq', error: 'Missing QQ song id', comments: [] });
  assert.deepEqual(warnings, [['[QQComments] detail fallback failed:', 'detail failed']]);
});

test('fetchQQSongComments resolves topid from detail fallback and maps first page comments', async () => {
  const calls = [];
  const result = await fetchQQSongComments('', 'trackmid001', 6, 0, {
    qqSongDetail: async (mid, fallback) => {
      assert.deepEqual(fallback, { mid: 'trackmid001' });
      return { qqId: '22001', mid };
    },
    qqGetJSON: async (url, params, opts) => {
      calls.push({ url, params, opts });
      return {
        hot_comment: {
          commentlist: [
            { commentid: 'hot1', rootcommentcontent: 'nice', praisenum: 9, time: 1700000000, nick: 'Fan' },
          ],
        },
        comment: { commenttotal: 1, commentlist: [] },
      };
    },
    qqCookieUin: () => '12345',
    buildQQSongCommentsPayload,
    logger: { warn() {} },
  });

  assert.equal(calls[0].params.topid, '22001');
  assert.equal(calls[0].params.pagenum, '0');
  assert.equal(calls[0].params.pagesize, '6');
  assert.equal(calls[0].params.loginUin, '12345');
  assert.deepEqual(calls[0].opts, { headers: { Referer: 'https://y.qq.com/n/ryqq/songDetail/trackmid001' } });
  assert.equal(result.total, 1);
  assert.equal(result.hot, true);
  assert.equal(result.comments[0].content, 'nice');
});

test('fetchQQSongComments strips nonnumeric ids and maps paged comments', async () => {
  const result = await fetchQQSongComments('id-22001', '', 6, 12, {
    qqSongDetail: async () => { throw new Error('should not resolve detail'); },
    qqGetJSON: async (url, params) => {
      assert.equal(params.topid, '22001');
      assert.equal(params.pagenum, '2');
      return {
        comment: {
          commenttotal: 2,
          commentlist: [
            { commentid: 'c1', rootcommentcontent: 'regular', praisenum: 1, time: 1700000000, nick: 'Listener' },
          ],
        },
      };
    },
    qqCookieUin: () => '',
    buildQQSongCommentsPayload,
    logger: { warn() {} },
  });

  assert.equal(result.id, '22001');
  assert.equal(result.hot, false);
  assert.equal(result.comments[0].content, 'regular');
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js
```

Expected: fail with missing `fetchQQSongComments` export.

- [ ] **Step 3: Implement `fetchQQSongComments`**

Move current comments body into `server/services/qq-orchestration.ts`, preserving:
- numeric ID normalization: `String(id || '').replace(/\D/g, '')`
- detail fallback using `qqSongDetail(mid, { mid })`
- warning text: `[QQComments] detail fallback failed:`
- missing payload: `{ provider: 'qq', error: 'Missing QQ song id', comments: [] }`
- URL: `https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg`
- params including `cid: '205360772'`, `reqtype: '2'`, `biztype: '1'`, `cmd: '8'`
- referer: `https://y.qq.com/n/ryqq/songDetail/` + `encodeURIComponent(mid || topid)`

- [ ] **Step 4: Thin `server.js` wrapper**

Replace `handleQQSongComments` with:

```js
async function handleQQSongComments(id, mid, limit, offset) {
  return fetchQQSongComments(id, mid, limit, offset, {
    qqSongDetail,
    qqGetJSON,
    qqCookieUin,
    buildQQSongCommentsPayload,
    logger: console,
  });
}
```

- [ ] **Step 5: Verify comments slice**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/music-routes.test.js tests/qq-utils-service.test.js
node --check server.js
npm run typecheck
git diff --check
```

Expected: all pass.

---

### Task 3: QQ Lyric Orchestration

**Files:**
- Modify: `tests/qq-orchestration-service.test.js`
- Modify: `server/services/qq-orchestration.ts`
- Modify: `server.js`

**Interfaces:**
- Consumes:
  - `qqMusicRequest(payload, opts)`
  - `qqGetJSON(url, params, opts)`
  - `qqCookieUin()`
  - `normalizeQQSongId(id)`
  - `decodeQQLyricText(raw)`
  - `logger.warn(...)`
- Produces:
  - `fetchQQLyric(mid: unknown, id: unknown, deps: FetchQQLyricDeps): Promise<Record<string, unknown>>`

- [ ] **Step 1: Write failing lyric service tests**

Add tests:

```js
test('fetchQQLyric requires a QQ song mid or id before upstream calls', async () => {
  let called = false;
  const result = await fetchQQLyric('', '', {
    qqMusicRequest: async () => { called = true; return {}; },
    qqGetJSON: async () => { called = true; return {}; },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn() {} },
  });

  assert.deepEqual(result, { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' });
  assert.equal(called, false);
});

test('fetchQQLyric returns decoded musicu lyric data', async () => {
  const result = await fetchQQLyric('qqmid001', '12001', {
    qqMusicRequest: async (payload, opts) => {
      assert.deepEqual(payload.lyric.param, { songMID: 'qqmid001', songID: '12001' });
      assert.deepEqual(opts, { cookie: true });
      return {
        lyric: {
          data: {
            lyric: Buffer.from('[00:01]hello').toString('base64'),
            trans: Buffer.from('[00:01]你好').toString('base64'),
            qrc: Buffer.from('qrc text').toString('base64'),
            roma: Buffer.from('roma text').toString('base64'),
          },
        },
      };
    },
    qqGetJSON: async () => { throw new Error('legacy should not run'); },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn() {} },
  });

  assert.equal(result.id, '12001');
  assert.equal(result.mid, 'qqmid001');
  assert.equal(result.lyric, '[00:01]hello');
  assert.equal(result.tlyric, '[00:01]你好');
  assert.equal(result.qrc, 'qrc text');
  assert.equal(result.roma, 'roma text');
  assert.equal(result.source, 'qq-musicu');
});

test('fetchQQLyric falls back to legacy lyric lookup when musicu has no lyric', async () => {
  const warnings = [];
  const result = await fetchQQLyric('qqmid001', '', {
    qqMusicRequest: async () => ({ lyric: { data: {} } }),
    qqGetJSON: async (url, params, opts) => {
      assert.equal(params.songmid, 'qqmid001');
      assert.equal(params.loginUin, '12345');
      assert.deepEqual(opts, { headers: { Referer: 'https://y.qq.com/portal/player.html' } });
      return { lyric: '[00:02]legacy', trans: '[00:02]legacy trans' };
    },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.lyric, '[00:02]legacy');
  assert.equal(result.tlyric, '[00:02]legacy trans');
  assert.equal(result.source, 'qq-legacy');
  assert.deepEqual(warnings, []);
});

test('fetchQQLyric returns qq-empty when musicu and legacy fail', async () => {
  const warnings = [];
  const result = await fetchQQLyric('qqmid001', '', {
    qqMusicRequest: async () => { throw new Error('musicu offline'); },
    qqGetJSON: async () => { throw new Error('legacy offline'); },
    qqCookieUin: () => '0',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.lyric, '');
  assert.equal(result.source, 'qq-empty');
  assert.deepEqual(warnings, [
    ['[QQLyric] musicu failed:', 'musicu offline'],
    ['[QQLyric] legacy failed:', 'legacy offline'],
  ]);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js
```

Expected: fail with missing `fetchQQLyric` export.

- [ ] **Step 3: Implement `fetchQQLyric`**

Move current `handleQQLyric` body into `server/services/qq-orchestration.ts`, preserving:
- missing payload: `{ provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' }`
- primary QQ Musicu module/method: `music.musichallSong.PlayLyricInfo` / `GetPlayLyricInfo`
- warning texts: `[QQLyric] musicu failed:` and `[QQLyric] legacy failed:`
- legacy lyric URL: `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg`
- `source` values: `qq-musicu`, `qq-legacy`, `qq-empty`
- `tlyric`, `qrc`, `roma`, and empty `yrc`

- [ ] **Step 4: Thin `server.js` wrapper**

Replace `handleQQLyric` with:

```js
async function handleQQLyric(mid, id) {
  return fetchQQLyric(mid, id, {
    qqMusicRequest,
    qqGetJSON,
    qqCookieUin,
    normalizeQQSongId,
    decodeQQLyricText,
    logger: console,
  });
}
```

- [ ] **Step 5: Verify lyric slice**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/music-routes.test.js tests/lyric-utils-service.test.js tests/qq-utils-service.test.js
node --check server.js
npm run typecheck
git diff --check
```

Expected: all pass.

---

### Task 4: Full Verification, QA Gate, Handoff, Commit

**Files:**
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes: all functions added in Tasks 1-3.
- Produces: committed, verified QQ read orchestration slice.

- [ ] **Step 1: Run focused static verification**

Run:

```bash
npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/music-routes.test.js tests/music-mapper-service.test.js tests/qq-utils-service.test.js tests/lyric-utils-service.test.js
node --check server.js
npm run typecheck
git diff --check
```

Expected:
- all focused tests pass
- `server.js` syntax check passes
- TypeScript passes
- no whitespace errors

- [ ] **Step 2: Run full verification**

Run normally first:

```bash
npm test && npm run coverage
```

If sandbox blocks local HTTP server tests with `listen EPERM: operation not permitted 127.0.0.1`, rerun the same command with approved non-sandbox execution.

Expected:
- all tests pass
- all production files line coverage remains `100.00%`
- `server-dist/server/services/qq-orchestration.js` line coverage remains `100.00%`

- [ ] **Step 3: QA subagent read-only review**

Ask a QA subagent to review:
- `server.js` wrapper parity
- `server/services/qq-orchestration.ts` behavior parity
- `tests/qq-orchestration-service.test.js` coverage of artist, comments, lyric paths
- generated-file staging risk
- verification evidence

Expected: `PASS`. If `NEEDS WORK`, fix only the identified issues and rerun focused/full verification.

- [ ] **Step 4: Update handoff**

Update `.agent/handoff.md`:
- Current Status latest slice: QQ read orchestration extraction
- Latest Slice Verification:
  - RED command and expected failure
  - focused/static command and pass count
  - full verification command and pass count
  - coverage summary
  - QA result

- [ ] **Step 5: Commit**

Before commit:

```bash
git status --short
git config --get user.email
git diff --check
```

Expected:
- only `.agent/handoff.md`, `server.js`, `server/services/qq-orchestration.ts`, and `tests/qq-orchestration-service.test.js` are modified
- email is `yearthmain@gmail.com`
- diff check passes

Commit:

```bash
git add .agent/handoff.md server.js server/services/qq-orchestration.ts tests/qq-orchestration-service.test.js
git commit -m "refactor: extract qq read orchestration"
```

## Self-Review

- Spec coverage: This plan covers QQ lyric, QQ artist detail, and QQ song comments. It explicitly excludes UI and QQ playback URL logic.
- Placeholder scan: No task relies on vague TODOs; each task has concrete paths, command lines, expected outputs, and representative test code.
- Type consistency: Produced function names are `fetchQQArtistDetail`, `fetchQQSongComments`, and `fetchQQLyric`; `server.js` wrappers consume the same names and inject current runtime helpers.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-03-mineradio-qq-read-orchestration.md`.

Recommended execution: inline in this session with small checkpoints, plus one read-only QA subagent after implementation. This is a tightly coupled three-function refactor in one existing service file, so splitting into multiple writer subagents would create unnecessary merge friction.
