# Mineradio macOS UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a narrow macOS visual polish pass to Mineradio's desktop shell, search, Home, and bottom player without touching playback/API behavior.

**Architecture:** This is a CSS-only first pass in `public/index.html`. It uses existing selectors and adds a scoped polish layer after the current relevant rules so the old UI remains structurally intact.

**Tech Stack:** Static HTML/CSS/vanilla JS in `public/index.html`, Electron macOS packaging, existing npm scripts.

## Global Constraints

- Modify only `public/index.html` for implementation.
- Do not change JS event handlers, API calls, player state, or backend code.
- Preserve simple mode, DIY mode, fullscreen, and responsive behavior.
- No new dependencies, fonts, assets, or build tooling.
- Verify with `npm run build:ts`, `node --check server.js`, `npm test`, and `npm run build:mac`.

---

### Task 1: Add Scoped macOS Polish CSS Layer

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: existing CSS selectors such as `#desktop-titlebar`, `#search-box`, `#search-results`, `#empty-home`, `.home-hero`, `.home-card`, `#bottom-bar`, `#controls`, `.control-cover`, `.ctrl-btn`, and `#progress-bar`.
- Produces: no new JS or HTML API. Produces visual-only overrides scoped to existing desktop/simple/diy mode selectors.

- [ ] **Step 1: Write the visual CSS layer**

Add a new comment block named `/* ---------- macOS polish pass ---------- */` near the existing control/home CSS. Include variables for `--mac-panel`, `--mac-panel-strong`, `--mac-line`, `--mac-line-strong`, `--mac-text`, and `--mac-muted`.

- [ ] **Step 2: Polish titlebar and search**

Override only existing selectors:

```css
body.desktop-shell #desktop-titlebar{height:46px;padding:0 14px 0 18px}
body.desktop-shell #desktop-titlebar #visual-guide-btn,
body.desktop-shell #desktop-titlebar #update-entry,
.desktop-window-btn,
.desktop-mode-btn{background:rgba(16,18,22,.48);border-color:rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
#search-box{background:linear-gradient(145deg,rgba(24,26,32,.70),rgba(10,12,16,.58));border-color:rgba(255,255,255,.13)}
#search-results{background:rgba(14,16,21,.72);border-color:rgba(255,255,255,.10)}
```

- [ ] **Step 3: Polish Home and bottom player**

Keep layout dimensions stable while reducing heavy glow:

```css
.home-hero,.home-card,.home-tile{box-shadow:0 18px 58px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.07)}
#bottom-bar.visible{background:linear-gradient(145deg,rgba(24,26,32,.68),rgba(8,10,14,.52));border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 58px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.14)}
.control-cover{border-radius:13px;box-shadow:0 12px 30px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.16)}
#progress-bar{background:rgba(255,255,255,.10)}
```

- [ ] **Step 4: Run static and test validation**

Run:

```bash
npm run build:ts
node --check server.js
npm test
```

Expected:

- TypeScript build passes.
- `server.js` syntax check passes.
- All tests pass.

- [ ] **Step 5: Build mac package**

Run:

```bash
npm run build:mac
```

Expected:

- DMG exists at `dist/Mineradio-1.1.1-arm64.dmg`.
- App launches for user validation.

- [ ] **Step 6: Commit**

Run:

```bash
git add public/index.html docs/superpowers/specs/2026-07-07-macos-ui-polish-design.md docs/superpowers/plans/2026-07-07-macos-ui-polish.md
git commit -m "style: polish macos player shell"
```

Expected:

- Commit contains the design doc, implementation plan, and CSS-only UI polish.

## Self-Review

- Spec coverage: titlebar, search, Home, and bottom player are covered by Task 1.
- Placeholder scan: no TBD/TODO placeholders.
- Scope check: implementation is one CSS-only task and does not touch JS or backend behavior.
