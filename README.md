# Mineradio

![Mineradio 暗场启动页](./docs/assets/readme/cinema-beat-smoke.png)

Mineradio 是一款桌面沉浸式音乐播放器，把天气电台、搜索播放、歌词舞台、粒子视觉和 3D 歌单架组合成一个更接近现场感的私人音乐空间。

本仓库是基于原版 Mineradio 的 macOS 预览与重构研究分支，重点目标是：让应用先能在 macOS 上运行和打包，再用测试护栏逐步拆开原本偏大的 Electron 服务端与 renderer 代码。

## 和原版相比的主要改动

- 增加 macOS 预览打包链路：`npm run build:mac` 会生成 arm64 DMG，产物在 `dist/Mineradio-1.1.1-arm64.dmg`。
- 将原本很厚的 `server.js` 缩成启动 shim，服务端主体拆到 `server/` TypeScript 源码和 `server-dist/` 编译产物。
- 按 controller、runtime、composition、service 等边界拆分服务端逻辑，保留 Electron 本地服务的行为兼容。
- 为服务端、更新链路、音乐平台适配、天气电台、renderer core helper 等补充测试。
- 引入 TypeScript 编译门禁，保留 renderer classic script 形态，避免一次性切 ESM/React 带来过大风险。
- 将 renderer 中可纯函数化的模块逐步拆到 `public/renderer/core/`，包括 API client、搜索逻辑、队列、歌词、更新状态、搜索结果、歌单 panel、播客结果等。
- 覆盖率门禁要求纳入范围内的生产代码 line coverage 达到 100%：`npm run coverage`。
- README、handoff 和本地文档记录了当前重构策略，便于后续继续拆 renderer 层。

## 当前状态

当前版本：`1.1.1`

当前分支：`feat/macos-preview`

状态：macOS 预览可打包，核心功能经本地验证可启动使用；Windows 原版安装包发布说明请以原作者仓库为准。

> 说明：这个 fork 目前主要用于 macOS 化和架构重构研究，不代表原作者正式发布的跨平台版本。

## macOS 预览包

本地打包：

```bash
npm install
npm run build:mac
```

产物：

```text
dist/Mineradio-1.1.1-arm64.dmg
```

## 下载或安装被拦截怎么办

小众 Electron 桌面软件、未签名安装包有时会被浏览器、Windows Defender、SmartScreen 或 macOS Gatekeeper 提示风险。

1. macOS 首次打开未签名 app 时，可能需要在系统设置的隐私与安全性中允许打开。
2. Windows SmartScreen 弹出蓝色拦截窗口时，点 `更多信息`，再点 `仍要运行`。
3. 如果杀毒软件明确显示木马、高危或已经隔离，不要强行运行；删除该文件后重新从可信来源重新构建或下载。

## 作者支持

如果 Mineradio 陪你多听了一首歌，也欢迎请作者一杯咖啡。

[查看完整支持页](./docs/SUPPORT.md)

![Mineradio 作者支持渠道](./docs/assets/support/mineradio-author-support-poster.png)

原版 1.1.1 的核心目标是把 Mineradio 重新整理成一份可公开下载的纯净安装版：默认视觉参数来自内置「默认测试」用户存档，首次启动就进入统一的视觉手感；3D 歌单架、歌词层级、用户存档和后台性能策略都在同一轮里收口。本 fork 在此基础上继续推进 macOS 预览和工程架构拆分。

## 核心特性

- Open-Meteo 天气电台，根据当前位置、城市和天气 mood 生成更合适的播放队列
- 首页包含天气电台、每日推荐、私人电台、继续听、听歌画像和我的歌单入口
- Wallpaper 银河首页背景，未播放状态保持干净的星河氛围
- 播放后切换到 Emily / 默认播放态视觉，歌词舞台与粒子舞台同步工作
- 基于节奏的电影镜头视觉系统
- 面向长播客和 DJ 曲目的专属视觉模式
- 歌词舞台、自定义歌词、歌词位置与视觉控制
- 自定义专辑封面上传与裁剪
- 右键唤起 3D 歌单架，支持歌单队列浏览
- 网易云音乐账号、搜索、歌单、播客等体验接入
- QQ 音乐搜索、登录态与音源补充接入
- GitHub Releases 更新检测与下载入口
- 首次启动内置「默认测试」视觉用户存档，软件内默认视觉参数与该存档一致

## 使用说明

macOS 预览版可以通过本仓库自行构建 DMG 后安装体验。

Windows 用户如果只是想使用原版稳定安装包，请优先查看原作者仓库的 GitHub Releases。本 fork 保留 Windows 打包命令，但主要验证目标是 macOS 预览和架构重构。

## 开发运行

```bash
npm install
npm start
npm test
npm run coverage
npm run build:mac
npm run build:win
```

桌面版入口由 Electron 主进程加载本地服务。`npm run build:mac` 会生成 macOS DMG，`npm run build:win` 会生成 Windows NSIS 安装包，产物位于 `dist/`。

## 重构版工程结构

```text
server.js                  # 极薄启动 shim
server/                    # TypeScript 服务端源码
server-dist/               # 编译后的服务端运行代码
public/index.html          # Electron renderer HTML
public/renderer/app.js     # renderer 状态与 DOM effect 主入口
public/renderer/core/      # 已拆出的 renderer 纯逻辑/helper
tests/                     # node:test 单测与 renderer DOM harness
.agent/handoff.md          # 当前重构进度与下一步记录
```

## 测试与质量门禁

```bash
npm test
npm run coverage
```

`npm run coverage` 会对 `server.js`、`dj-analyzer.js`、`lib/**/*.js`、`server-dist/server/**/*.js` 和 `public/renderer/core/**/*.js` 执行 Node 原生测试覆盖率检查，并要求 line coverage 为 100%。

## 更新机制

Mineradio 会请求 GitHub Releases latest 检测新版本。远端版本高于本地版本时，应用内更新入口会展示 Release 内容、下载安装包到本机用户数据目录，并通过系统打开安装包。

本地验证更新链路时，可以通过 `MINERADIO_UPDATE_MANIFEST` 指向一个本地 manifest JSON 或 HTTP 地址来模拟线上 Release。

## 第三方音乐平台说明

Mineradio 不是网易云音乐、QQ 音乐或腾讯音乐娱乐集团的官方客户端，也不隶属于任何音乐平台。

项目中的第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。请遵守对应平台的用户协议、版权规则和会员权益规则。项目不会提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。

## 用户数据与隐私

登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存等数据只应保存在本机用户数据目录或浏览器本地存储中，不应提交到仓库。

更多说明见 [PRIVACY.md](./PRIVACY.md)。

## 致谢

Mineradio 由 XxHuberrr 主要设计与打造。emily 作为早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此感谢。

同时感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。

## 版权与授权

Copyright (C) 2026 XxHuberrr.

本项目采用 GPL-3.0 授权。详见 [LICENSE](./LICENSE)。

MR Logo、Mineradio 名称、界面视觉设计与原创视觉表达归作者所有；第三方依赖和第三方服务分别遵循其各自授权与服务条款。
