# Mineradio Controller Router TS Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `server.js` 的 HTTP route/controller 逻辑逐步迁移到 TypeScript controller 模块，同时保留根 `server.js` 作为 Electron 和测试兼容入口。

**Architecture:** `server.js` 继续创建 HTTP server、持有运行时状态和 legacy `__test` 注入点；新的 `server/controllers/*.ts` 只承接某个 route 领域的 path 判断、参数解析、响应状态和错误 payload。每个 controller 通过显式依赖对象调用现有 service/wrapper，不直接读取 `server.js` 全局变量。

**Tech Stack:** Node.js HTTP server, TypeScript `Node16`, CommonJS runtime via `server-dist`, `node:test`, electron-builder.

## Global Constraints

- 保留根目录 `server.js`，不要在本阶段直接改名为 `server.ts`。
- 保留 `desktop/main.js` 的 `require(path.join(__dirname, '..', 'server.js'))` 行为。
- 保留 `module.exports = server` 和 `module.exports.__test` 测试入口。
- API response shape、HTTP status、route order、日志语义、cookie/runtime state 语义不得因拆分改变。
- 每个代码切片必须先写 RED 测试，再实现，再跑 targeted tests、`node --check server.js`、`npm run typecheck`、`git diff --check`、`npm test`、`npm run coverage`。
- `npm run coverage` 必须保持生产代码 line coverage `100.00%`。
- 每个非平凡代码切片完成前必须只读 QA gate；通过后更新 `.agent/handoff.md` 并提交。

---

## 文件结构

- Create: `server/controllers/app-controller.ts`
  - 负责 `/api/app/version`。
- Create: `server/controllers/weather-controller.ts`
  - 负责 `/api/weather/radio` 和 `/api/weather/ip-location`。
- Create: `server/controllers/podcast-controller.ts`
  - 负责 `/api/podcast/search`、`/api/podcast/hot`、`/api/podcast/detail`、`/api/podcast/programs`、`/api/podcast/my`、`/api/podcast/my/items`。
- Create: `server/controllers/qq-controller.ts`
  - 负责 `/api/qq/*` 只读和播放相关 routes。
- Create: `server/controllers/netease-controller.ts`
  - 负责 `/api/search`、`/api/song/url`、Netease login、playlist、like、lyric、comments、artist/detail、playlist/tracks。
- Create: `server/controllers/update-controller.ts`
  - 负责 `/api/update/*`。
- Create: `server/controllers/media-controller.ts`
  - 负责 `/api/cover`、`/api/audio`、`/api/podcast/dj-beatmap`。
- Create: `tests/*controller.test.js`
  - 每个 controller 文件对应一个 service-style unit test，直接 require `server-dist/server/controllers/...`。
- Modify: `server.js`
  - 每个切片只把对应 `if (pn === ...)` route 块替换成 controller 调用，保留 wrapper 函数和 runtime state。
- Modify: `tests/project-structure.test.js`
  - 增加 controller 编译产物和打包包含规则的结构断言。
- Modify: `.agent/handoff.md`
  - 每个切片记录状态、验证、QA 结论和下一步。

## 通用 Controller 约定

第一刀先使用最小约定，避免过早抽象：

```ts
export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type RouteHandled = boolean;
```

每个 controller 初期暴露一个领域函数：

```ts
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
```

`server.js` 调用方式固定为：

```js
if (await handleAppRoutes({
  pathname: pn,
  res,
  sendJSON,
  packageInfo: APP_PACKAGE,
  appVersion: APP_VERSION,
  updateConfig: UPDATE_CONFIG,
  buildAppVersionPayload,
})) return;
```

这个约定的目的：controller 可以独立测试；`server.js` 仍然明确注入依赖；后续如果 route 数量变多，再抽 `RouteContext` 类型，不在第一刀提前泛化。

---

### Task 1: App Controller First Slice

**Files:**
- Create: `server/controllers/app-controller.ts`
- Create: `tests/app-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes: `buildAppVersionPayload` from `server/services/app-info.ts`.
- Produces: `handleAppRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Write the failing controller test**

Create `tests/app-controller.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleAppRoutes,
} = require('../server-dist/server/controllers/app-controller');

test('handleAppRoutes handles app version and sends legacy payload', async () => {
  const calls = [];
  const handled = await handleAppRoutes({
    pathname: '/api/app/version',
    res: 'res',
    sendJSON: (res, data, status) => calls.push({ res, data, status }),
    packageInfo: { name: 'mineradio', version: '1.1.1' },
    appVersion: '1.1.1',
    updateConfig: { provider: 'github' },
    buildAppVersionPayload: opts => ({ ok: true, opts }),
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: {
      ok: true,
      opts: {
        packageInfo: { name: 'mineradio', version: '1.1.1' },
        appVersion: '1.1.1',
        updateConfig: { provider: 'github' },
      },
    },
    status: undefined,
  }]);
});

test('handleAppRoutes ignores unrelated paths', async () => {
  const calls = [];
  const handled = await handleAppRoutes({
    pathname: '/api/search',
    res: 'res',
    sendJSON: () => calls.push('unexpected'),
    packageInfo: {},
    appVersion: '1.1.1',
    updateConfig: {},
    buildAppVersionPayload: () => ({}),
  });

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run build:ts && node --test tests/app-controller.test.js
```

Expected: FAIL with `Cannot find module '../server-dist/server/controllers/app-controller'` or `handleAppRoutes is not a function`.

- [ ] **Step 3: Implement app controller**

Create `server/controllers/app-controller.ts`:

```ts
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
```

- [ ] **Step 4: Wire `server.js`**

Add import:

```js
const {
  handleAppRoutes,
} = require('./server-dist/server/controllers/app-controller');
```

Replace the inline app route:

```js
if (await handleAppRoutes({
  pathname: pn,
  res,
  sendJSON,
  packageInfo: APP_PACKAGE,
  appVersion: APP_VERSION,
  updateConfig: UPDATE_CONFIG,
  buildAppVersionPayload,
})) return;
```

- [ ] **Step 5: Verify targeted**

Run:

```bash
npm run build:ts && node --test tests/app-controller.test.js tests/music-routes.test.js tests/project-structure.test.js
node --check server.js
npm run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Verify full**

Run:

```bash
npm test
npm run coverage
```

Expected: all tests pass and production-code line coverage remains `100.00%`.

- [ ] **Step 7: QA, handoff, commit**

Ask a read-only QA subagent to review:

- `server.js` route order is unchanged.
- `/api/app/version` response shape still comes from `buildAppVersionPayload`.
- unrelated routes still fall through.
- tests and validation evidence pass.

Update `.agent/handoff.md`, then commit:

```bash
git add .agent/handoff.md server.js server/controllers/app-controller.ts tests/app-controller.test.js
git commit -m "refactor: extract app controller route"
```

### Task 2: Weather Controller

**Files:**
- Create: `server/controllers/weather-controller.ts`
- Create: `tests/weather-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes injected functions `buildWeatherRadio(params)` and `fetchIpWeatherLocation()`.
- Produces `handleWeatherRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Write RED tests**

Test `/api/weather/radio` parameter parsing, success payload, provider failure fallback payload, `/api/weather/ip-location` success/error payload, and unrelated path ignored.

- [ ] **Step 2: Implement minimal controller**

Move only the route-level try/catch and query parsing from `server.js`; keep `buildWeatherRadio` and `fetchIpWeatherLocation` wrappers in `server.js`.

- [ ] **Step 3: Verify**

Run targeted:

```bash
npm run build:ts && node --test tests/weather-controller.test.js tests/music-routes.test.js tests/project-structure.test.js
node --check server.js
npm run typecheck
git diff --check
```

Then full:

```bash
npm test
npm run coverage
```

- [ ] **Step 4: QA, handoff, commit**

Commit message:

```bash
git commit -m "refactor: extract weather controller routes"
```

### Task 3: Podcast Read Controller

**Files:**
- Create: `server/controllers/podcast-controller.ts`
- Create: `tests/podcast-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes injected Netease podcast API functions, `getLoginInfo`, `fetchMyPodcastItems`, `firstArrayFrom`, and mapper helpers already in services.
- Produces `handlePodcastRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Start with `/api/podcast/search` and `/api/podcast/hot` only**

Write RED tests for blank search, search success/error, hot success/error, unrelated path ignored.

- [ ] **Step 2: Implement and verify**

Move only those two routes. Do not move login-backed podcast routes in the same commit.

- [ ] **Step 3: Follow-up slices**

After QA/commit, repeat the same TDD flow for:

- `/api/podcast/detail` and `/api/podcast/programs`
- `/api/podcast/my` and `/api/podcast/my/items`

### Task 4: QQ Controller

**Files:**
- Create: `server/controllers/qq-controller.ts`
- Create: `tests/qq-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes injected wrappers: `handleQQSearch`, `handleQQSongUrl`, `handleQQLyric`, `getQQLoginInfo`, `saveQQCookie`, `normalizeQQCookieInput`, `qqCookieObject`, `qqCookieUin`, `qqCookieMusicKey`, `getQQLoginInfo`, `handleQQUserPlaylists`, `handleQQPlaylistTracks`, `handleQQArtistDetail`, `handleQQSongComments`.
- Produces `handleQQRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Split by risk**

Do not move all QQ routes in one commit. Use this order:

1. `/api/qq/search`, `/api/qq/song/url`, `/api/qq/lyric`
2. `/api/qq/login/status`, `/api/qq/login/cookie`, `/api/qq/logout`
3. `/api/qq/user/playlists`, `/api/qq/playlist/tracks`, `/api/qq/artist/detail`, `/api/qq/song/comments`

- [ ] **Step 2: Verify each slice**

Each slice gets its own controller tests, targeted route tests, full tests, coverage, QA, handoff, commit.

### Task 5: Update And Beatmap Controllers

**Files:**
- Create: `server/controllers/update-controller.ts`
- Create: `server/controllers/beatmap-controller.ts`
- Create: `tests/update-controller.test.js`
- Create: `tests/beatmap-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Update consumes injected update job wrappers and state.
- Beatmap consumes injected cache wrappers and `readRequestBody`.

- [ ] **Step 1: Move update status/read-only routes first**

Start with `/api/update/latest`, `/api/update/download/status`, `/api/update/patch/status`.

- [ ] **Step 2: Move update mutation routes**

Move `/api/update/download` and `/api/update/patch` only after status/read-only routes are stable.

- [ ] **Step 3: Move beatmap cache routes**

Move `/api/beatmap/cache/status` and `/api/beatmap/cache` together because they share method branching and cache dependency injection.

### Task 6: Netease Controller

**Files:**
- Create: `server/controllers/netease-controller.ts`
- Create: `tests/netease-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes injected wrappers for Netease search/playback/login/playlist/like/lyrics/comments/artist/playlist tracks.
- Produces `handleNeteaseRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Move read-only/search routes first**

Move `/api/search`, `/api/lyric`, `/api/song/comments`, `/api/artist/detail`, `/api/playlist/tracks`.

- [ ] **Step 2: Move login/session routes**

Move `/api/login/status`, `/api/login/cookie`, `/api/logout`, `/api/login/qr/*`.

- [ ] **Step 3: Move mutation routes**

Move `/api/song/like/check`, `/api/song/like`, `/api/playlist/create`, `/api/playlist/add-song`.

### Task 7: Media Controller And Static Boundary

**Files:**
- Create: `server/controllers/media-controller.ts`
- Create: `tests/media-controller.test.js`
- Modify: `server.js`
- Modify: `.agent/handoff.md`

**Interfaces:**
- Consumes injected `fetch`, `analyzePodcastDjStream`, `audioProxyHeadersFor`, `audioContentTypeForUrl`, `sendJSON`.
- Produces `handleMediaRoutes(ctx): Promise<boolean>`.

- [ ] **Step 1: Move `/api/podcast/dj-beatmap`**

Keep analyzer functions injected; preserve error payloads.

- [ ] **Step 2: Move `/api/cover` and `/api/audio`**

Preserve stream headers and range behavior exactly. Run route tests and perform a build smoke test after this slice.

### Task 8: Final Route Chain Audit

**Files:**
- Modify: `server.js`
- Modify: `tests/server-router.test.js`
- Modify: `tests/project-structure.test.js`
- Modify: `.agent/handoff.md`

**Goal:** `server.js` should be a composition root: imports controllers, builds dependency objects, calls controllers in legacy route order, then serves static files.

- [ ] **Step 1: Add structure assertions**

Assert `server/controllers/*.ts` compile to `server-dist/server/controllers/*.js` and package build files still include `server-dist/**/*` and `server.js`.

- [ ] **Step 2: Route order audit**

Update or add tests comparing controller route ownership against `server/router.ts` route metadata.

- [ ] **Step 3: Full verification and packaging**

Run:

```bash
npm test
npm run coverage
npm run build:mac
```

Expected:

- All tests pass.
- Production-code line coverage `100.00%`.
- DMG is produced under `dist/`.

- [ ] **Step 4: Goal completion audit**

Verify:

- Root `server.js` remains.
- Controllers are TypeScript and compiled.
- Route behavior is covered by existing and controller tests.
- `desktop/main.js` still requires `server.js`.
- Full test/coverage/build evidence is recorded in `.agent/handoff.md`.
