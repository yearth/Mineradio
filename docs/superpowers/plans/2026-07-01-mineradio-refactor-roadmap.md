# Mineradio 重构路线图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Mineradio 从少数巨型 JS 文件演进为可测试、可类型检查、可小步打包验证的模块化 Electron 音乐播放器。

**Architecture:** 保留现有 Electron + 本地 HTTP server + 静态 renderer 形态，不引入 Nest。优先用 TypeScript 和清晰边界拆分 `server.js`，再拆 `desktop/main.js`，最后处理高风险 renderer。

**Tech Stack:** Electron, Node.js HTTP server, TypeScript, `node:test`, electron-builder, vanilla renderer.

## Global Constraints

- 不引入 Nest，除非后续出现真实大型后端框架需求。
- 保留 `server.js` 和 `desktop/main.js` 作为兼容入口，直到对应模块完成迁移并通过打包验证。
- 每个阶段必须保持 `npm test` 通过。
- 改动 Electron 启动、打包或平台行为后必须运行 macOS 打包验证。
- 不先拆 `public/index.html` 的 3D、播放状态机、动画主循环。
- API response shape、IPC 暴露对象、localStorage key 不得在重构中顺手变更。

---

## 阶段版图

### 阶段 1：TypeScript 基础设施

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Create: `server/index.ts`
- Create: `server/router.ts`
- Create: `server/test-support/runtime.ts`
- Create: `tests/project-structure.test.js`

**Outcome:** TS 可独立 typecheck，Electron 打包包含未来编译产物，现有运行入口不变。

**Validation:**
- `node --test tests/project-structure.test.js`
- `npm run typecheck`
- `npm test`
- `npm run build:mac`

### 阶段 2：server 外壳拆分

**Files:**
- Modify: `server.js`
- Modify: `server/index.ts`
- Modify: `server/router.ts`
- Create: `server/http-utils.ts`
- Create: `server/test-support/runtime.ts`

**Outcome:** `server.js` 继续导出现有 server，但 HTTP 创建、路由分发、测试注入点开始有独立边界。

**Validation:**
- `npm test`
- route 相关测试单跑：`node --test tests/music-routes.test.js tests/update-routes.test.js`

### 阶段 3：server 领域拆分

**Files:**
- Create: `server/routes/update.ts`
- Create: `server/routes/beatmap.ts`
- Create: `server/routes/auth.ts`
- Create: `server/routes/music.ts`
- Create: `server/routes/media.ts`
- Create: `server/routes/weather.ts`
- Create: `server/services/*`
- Create: `server/adapters/*`
- Create: `server/mappers/*`
- Create: `server/state/*`

**Outcome:** 长 `if (pn === ...)` 路由链逐步替换为 route table，provider 适配、映射、缓存、业务处理分层。

**Validation:**
- 每拆一个领域先跑对应测试文件。
- 每完成一组跑 `npm test` 和 `npm run typecheck`。

### 阶段 4：Electron main 拆分

**Files:**
- Modify: `desktop/main.js`
- Create: `desktop/app/*`
- Create: `desktop/windows/*`
- Create: `desktop/ipc/*`
- Create: `desktop/overlays/*`
- Create: `desktop/platform/*`
- Create: `desktop/cookies/*`

**Outcome:** `desktop/main.js` 变成 composition root；窗口、IPC、overlay、平台差异各自独立。

**Validation:**
- `npm test`
- `npm run build:mac`
- 手动或 QA gate 验证主窗口、登录窗口、桌面歌词、壁纸、更新入口。

### 阶段 5：共享类型边界

**Files:**
- Create: `shared/api-types.ts`
- Create: `shared/ipc-types.ts`
- Create: `shared/music-types.ts`
- Modify: `desktop/preload.js`
- Modify: `desktop/overlay-preload.js`

**Outcome:** API、IPC、音乐实体有集中类型定义，但不改变 renderer 可见对象形状。

**Validation:**
- `npm run typecheck`
- `npm test`
- Electron smoke test。

### 阶段 6：renderer 低风险拆分

**Files:**
- Modify: `public/index.html`
- Create: `public/js/api-client.js`
- Create: `public/js/storage.js`
- Create: `public/js/update-ui.js`
- Create: `public/js/login-ui.js`
- Create: `public/js/playlist-helpers.js`
- Create: `public/js/formatters.js`

**Outcome:** 从 `index.html` 抽出边缘工具和 UI glue，暂不触碰播放核心和 3D 主循环。

**Validation:**
- 浏览器/Electron smoke test。
- macOS 打包验证。

### 阶段 7：renderer 核心拆分

**Files:**
- Create: `public/js/player/*`
- Create: `public/js/visualizer/*`
- Create: `public/js/scene/*`
- Create: `public/js/state/*`
- Modify: `public/index.html`

**Outcome:** 播放状态、音频引擎、beat 分析、3D 场景、动画循环逐步独立。

**Validation:**
- 需要先建立 UI smoke 测试。
- 每个小块拆分后做手动或 subagent QA gate。

## 执行策略

- 每个任务以测试或结构护栏开始。
- 每个任务只迁移一个边界，不顺手重构视觉或交互。
- 每个阶段结束后提交一次。
- 打包验证通过后再进入下一个高风险阶段。
