# Mineradio macOS UI Polish Design

## Goal

Make the existing Mineradio desktop UI feel more like a native macOS music app in the first viewport, without changing playback logic, API behavior, routing, or persistence.

## Scope

- Modify only the visual layer in `public/index.html` for this first pass.
- Keep the current HTML structure, event handlers, player state, and server APIs unchanged.
- Focus on desktop shell mode because the user is validating macOS DMG builds.
- Preserve the existing DIY/simple modes and responsive rules.

## Visual Direction

Mineradio should read as a floating macOS glass console rather than a game-like HUD. The design keeps the dark immersive stage, but lowers neon intensity and makes primary controls feel quieter, more spatial, and easier to scan.

Palette:

- `--mac-panel`: `rgba(16,18,22,.58)` for floating glass panels.
- `--mac-panel-strong`: `rgba(22,24,30,.74)` for focused controls.
- `--mac-line`: `rgba(255,255,255,.105)` for thin borders.
- `--mac-line-strong`: `rgba(255,255,255,.18)` for focused/hover states.
- `--mac-text`: `rgba(246,248,250,.94)` for primary labels.
- `--mac-muted`: `rgba(226,232,240,.54)` for metadata.
- Accent remains Mineradio cyan/champagne, used sparingly for active/focus states only.

Typography:

- Keep existing `Noto Sans SC`/system stack.
- Use smaller, calmer utility labels in titlebar, search result metadata, and control buttons.
- Avoid new external font dependencies.

Signature Element:

- The bottom player becomes a “floating media shelf”: a wide frosted strip with softer border, clearer album art, calm progress line, and a centered transport cluster. This is the most visible macOS polish marker.

## Components

### Desktop Shell And Titlebar

The shell keeps its rounded clipped window shape. The titlebar controls should look less like heavy buttons and more like macOS toolbar capsules:

- Keep custom window controls and existing drag regions.
- Reduce button contrast and hover glow.
- Use subtle blur for titlebar actions.
- Keep fullscreen/maximized behavior unchanged.

### Search

Search should feel closer to Spotlight:

- Search field keeps existing position and behavior.
- Reduce border glow and make the glass surface smoother.
- Search results get stronger list hierarchy: calmer row hover, slightly larger cover radius, and clearer title/meta contrast.

### Home Empty State

Home cards should feel less like many floating cards and more like a dashboard:

- Reduce heavy shadows and neon grid energy.
- Slightly lower border radius.
- Keep all existing cards, buttons, and animations, but make animations less visually dominant through subtler shadows.

### Bottom Player

The bottom player is the main polish target:

- Keep existing control IDs and layout model.
- Change the visible glass surface to a macOS media shelf with restrained blur, thinner borders, and less inner glow.
- Make album cover slightly more tactile.
- Make progress bar lower contrast by default, clearer on hover.
- Keep responsive and immersive mode behavior intact.

## Testing And Validation

- Run `npm run build:ts`.
- Run `node --check server.js`.
- Run `npm test` to ensure backend/test hooks remain intact even though only UI is changed.
- Run `npm run build:mac` for a user-verifiable DMG.
- Inspect the app visually in macOS package output; minimum checks are app start, Home visible, search open, bottom player visible after playback/controls shown.

## Non-Goals

- Do not split `public/index.html` in this pass.
- Do not replace the frontend framework or introduce a bundler.
- Do not change playback, search, login, update, or API behavior.
- Do not redesign desktop lyrics or wallpaper pages.
