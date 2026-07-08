const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const indexHtmlPath = path.join(root, 'public', 'index.html');
const rendererPath = path.join(root, 'public', 'renderer', 'app.js');
const rendererApiClientPath = path.join(root, 'public', 'renderer', 'core', 'api-client.js');
const rendererPreferencesPath = path.join(root, 'public', 'renderer', 'core', 'preferences.js');
const rendererUpdateStatePath = path.join(root, 'public', 'renderer', 'core', 'update-state.js');
const rendererLyricsParserPath = path.join(root, 'public', 'renderer', 'core', 'lyrics-parser.js');
const rendererSearchLogicPath = path.join(root, 'public', 'renderer', 'core', 'search-logic.js');
const rendererPlayerQueuePath = path.join(root, 'public', 'renderer', 'core', 'player-queue.js');
const rendererMiniQueuePath = path.join(root, 'public', 'renderer', 'core', 'mini-queue.js');
const stylePath = path.join(root, 'public', 'styles', 'app.css');
const packageJson = require('../package.json');

function readProjectFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function orderedTagRefs(html) {
  const refs = [];
  const tagPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>|<link\b([^>]*)>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const scriptAttrs = match[1];
    const scriptBody = match[2];
    const linkAttrs = match[3];
    const tag = scriptAttrs !== undefined ? 'script' : 'link';
    const attrs = scriptAttrs !== undefined ? scriptAttrs : linkAttrs;
    const src = /\bsrc="([^"]+)"/i.exec(attrs);
    const href = /\bhref="([^"]+)"/i.exec(attrs);
    const rel = /\brel="([^"]+)"/i.exec(attrs);
    refs.push({
      tag,
      src: src && src[1],
      href: href && href[1],
      rel: rel && rel[1],
      body: scriptBody || '',
    });
  }
  return refs;
}

function scriptRefLabel(ref) {
  if (ref.src) {
    return ref.src;
  }
  return ref.body.includes('mineradio-diy-player-mode-v1') ? '[diy-preload-inline]' : '[inline-script]';
}

function extractInlineHandlerCalls(source, sourceLabel) {
  const handlers = [];
  const handlerPattern = /\s(on[a-z]+)=(["'])(.*?)\2/gi;
  let handlerMatch;
  while ((handlerMatch = handlerPattern.exec(source))) {
    const [, eventName, , expression] = handlerMatch;
    const calls = [];
    const callPattern = /(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g;
    let callMatch;
    while ((callMatch = callPattern.exec(expression))) {
      calls.push(callMatch[1]);
    }
    handlers.push({ sourceLabel, eventName, expression, calls });
  }
  return handlers;
}

function rendererGlobalNames(rendererSource) {
  const names = new Set();
  const patterns = [
    /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g,
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(rendererSource))) {
      names.add(match[1]);
    }
  }
  return names;
}

test('renderer entry assets are present and packaged with Electron', () => {
  assert.ok(fs.existsSync(indexHtmlPath), 'public/index.html must exist');
  assert.ok(fs.existsSync(rendererPath), 'public/renderer/app.js must exist');
  assert.ok(fs.existsSync(stylePath), 'public/styles/app.css must exist');
  assert.ok(packageJson.build.files.includes('public/**/*'), 'Electron package must include public assets');
});

test('index.html keeps the classic renderer boot order stable', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const stylesheetIndex = refs.findIndex(ref => ref.tag === 'link' && ref.rel === 'stylesheet' && ref.href === 'styles/app.css');
  const rendererIndex = scripts.indexOf('renderer/app.js');

  assert.deepEqual(scripts.slice(0, 4), [
    'vendor/three.r128.min.js',
    'vendor/music-tempo.min.js',
    'vendor/gsap.min.js',
    '[diy-preload-inline]',
  ]);
  assert.equal(scripts.at(-1), 'renderer/app.js');
  assert.ok(stylesheetIndex > -1, 'styles/app.css stylesheet link is required');
  assert.ok(rendererIndex > 3, 'renderer/app.js must load after vendor and preload scripts');
});

test('renderer app wires apiJson through the core API client', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const apiClientIndex = scripts.indexOf('renderer/core/api-client.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const apiClient = readProjectFile(rendererApiClientPath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(apiClientIndex > -1, 'renderer/core/api-client.js must be loaded');
  assert.ok(apiClientIndex < rendererIndex, 'core API client must load before renderer/app.js');
  vm.runInNewContext(apiClient, browserContext, { filename: rendererApiClientPath });
  assert.equal(typeof browserContext.window.MineradioApiClient.createApiJson, 'function');
  assert.match(renderer, /MineradioApiClient\.createApiJson/);
  assert.doesNotMatch(renderer, /async function apiJson\s*\(/);
});

test('renderer app wires preferences through the core preferences module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const preferencesIndex = scripts.indexOf('renderer/core/preferences.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const preferences = readProjectFile(rendererPreferencesPath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(preferencesIndex > -1, 'renderer/core/preferences.js must be loaded');
  assert.ok(preferencesIndex < rendererIndex, 'core preferences must load before renderer/app.js');
  vm.runInNewContext(preferences, browserContext, { filename: rendererPreferencesPath });
  assert.equal(typeof browserContext.window.MineradioPreferences.readSavedVolume, 'function');
  assert.match(renderer, /MineradioPreferences\.readSavedVolume/);
  assert.match(renderer, /MineradioPreferences\.normalizePlaybackQuality/);
  assert.doesNotMatch(renderer, /function readSavedVolume\s*\(\)\s*\{[\s\S]*?parseFloat\(localStorage\.getItem\('apex-player-volume'\)/);
  assert.doesNotMatch(renderer, /function normalizePlaybackQuality\s*\(value\)\s*\{[\s\S]*?String\(value \|\| ''\)\.toLowerCase\(\)/);
});

test('renderer app wires update state through the core update-state module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const updateStateIndex = scripts.indexOf('renderer/core/update-state.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const updateState = readProjectFile(rendererUpdateStatePath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(updateStateIndex > -1, 'renderer/core/update-state.js must be loaded');
  assert.ok(updateStateIndex < rendererIndex, 'core update-state must load before renderer/app.js');
  vm.runInNewContext(updateState, browserContext, { filename: rendererUpdateStatePath });
  assert.equal(typeof browserContext.window.MineradioUpdateState.applyLatestUpdateInfo, 'function');
  assert.match(renderer, /MineradioUpdateState\.applyLatestUpdateInfo/);
  assert.match(renderer, /MineradioUpdateState\.formatUpdateBytes/);
  assert.doesNotMatch(renderer, /function formatUpdateBytes\s*\(bytes\)\s*\{[\s\S]*?1024 \* 1024/);
});

test('renderer app wires lyrics parsing through the core lyrics parser module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const lyricsParserIndex = scripts.indexOf('renderer/core/lyrics-parser.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const lyricsParser = readProjectFile(rendererLyricsParserPath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(lyricsParserIndex > -1, 'renderer/core/lyrics-parser.js must be loaded');
  assert.ok(lyricsParserIndex < rendererIndex, 'core lyrics parser must load before renderer/app.js');
  vm.runInNewContext(lyricsParser, browserContext, { filename: rendererLyricsParserPath });
  assert.equal(typeof browserContext.window.MineradioLyricsParser.parseLyricText, 'function');
  assert.match(renderer, /MineradioLyricsParser\.parseLyricText/);
  assert.match(renderer, /MineradioLyricsParser\.parseYrcText/);
  assert.doesNotMatch(renderer, /function parseLyricText\s*\(text\)\s*\{[\s\S]*?String\(text \|\| ''\)\.split/);
});

test('renderer app wires search logic through the core search module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const searchLogicIndex = scripts.indexOf('renderer/core/search-logic.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const searchLogic = readProjectFile(rendererSearchLogicPath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(searchLogicIndex > -1, 'renderer/core/search-logic.js must be loaded');
  assert.ok(searchLogicIndex < rendererIndex, 'core search logic must load before renderer/app.js');
  vm.runInNewContext(searchLogic, browserContext, { filename: rendererSearchLogicPath });
  assert.equal(typeof browserContext.window.MineradioSearchLogic.mergeSongSearchResults, 'function');
  assert.match(renderer, /MineradioSearchLogic\.mergeSongSearchResults/);
  assert.match(renderer, /MineradioSearchLogic\.rememberSearchQuery/);
  assert.doesNotMatch(renderer, /function scoreSongSearchResult\s*\(song, q, sourceIndex\)\s*\{[\s\S]*?var qAsksDerivative/);
});

test('renderer core scripts expose required browser globals before app boot', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const requiredCoreGlobals = [
    'MineradioApiClient',
    'MineradioPreferences',
    'MineradioUpdateState',
    'MineradioLyricsParser',
    'MineradioSearchLogic',
    'MineradioPlayerQueue',
    'MineradioMiniQueue',
  ];
  const browserContext = {
    window: {},
    console: { warn() {}, error() {}, log() {} },
    setTimeout() { return 0; },
    clearTimeout() {},
  };

  assert.ok(rendererIndex > -1, 'renderer/app.js must be loaded');
  for (const script of scripts.slice(0, rendererIndex)) {
    if (!script.startsWith('renderer/core/')) continue;
    const filePath = path.join(root, 'public', script);
    vm.runInNewContext(readProjectFile(filePath), browserContext, { filename: filePath });
  }

  for (const name of requiredCoreGlobals) {
    assert.ok(browserContext.window[name], `${name} must exist before renderer/app.js executes`);
  }

  const renderer = readProjectFile(rendererPath);
  const appNamespaces = [...renderer.matchAll(/window\.(Mineradio[A-Za-z]+)/g)].map(match => match[1]);
  assert.ok(appNamespaces.length >= requiredCoreGlobals.length, 'renderer app should reference core namespaces');
  for (const name of appNamespaces) {
    assert.ok(browserContext.window[name], `${name} is referenced by app.js but is not loaded first`);
  }
});

test('renderer app wires mini queue rendering through the core mini queue module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const miniQueueIndex = scripts.indexOf('renderer/core/mini-queue.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const miniQueue = readProjectFile(rendererMiniQueuePath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(miniQueueIndex > -1, 'renderer/core/mini-queue.js must be loaded');
  assert.ok(miniQueueIndex < rendererIndex, 'core mini queue must load before renderer/app.js');
  vm.runInNewContext(miniQueue, browserContext, { filename: rendererMiniQueuePath });
  assert.equal(typeof browserContext.window.MineradioMiniQueue.renderMiniQueueItemsHtml, 'function');
  assert.match(renderer, /MineradioMiniQueue\.miniQueueCountText/);
  assert.match(renderer, /MineradioMiniQueue\.renderMiniQueueEmptyHtml/);
  assert.match(renderer, /MineradioMiniQueue\.renderMiniQueueItemsHtml/);
});

test('renderer app wires player queue through the core player queue module', () => {
  const refs = orderedTagRefs(readProjectFile(indexHtmlPath));
  const scripts = refs.filter(ref => ref.tag === 'script').map(scriptRefLabel);
  const playerQueueIndex = scripts.indexOf('renderer/core/player-queue.js');
  const rendererIndex = scripts.indexOf('renderer/app.js');
  const playerQueue = readProjectFile(rendererPlayerQueuePath);
  const renderer = readProjectFile(rendererPath);
  const browserContext = { window: {} };

  assert.ok(playerQueueIndex > -1, 'renderer/core/player-queue.js must be loaded');
  assert.ok(playerQueueIndex < rendererIndex, 'core player queue must load before renderer/app.js');
  vm.runInNewContext(playerQueue, browserContext, { filename: rendererPlayerQueuePath });
  assert.equal(typeof browserContext.window.MineradioPlayerQueue.createPlayerQueueHelpers, 'function');
  assert.match(renderer, /MineradioPlayerQueue\.createPlayerQueueHelpers/);
  assert.match(renderer, /playerQueueHelpers\.queueItemKey/);
  assert.match(renderer, /playerQueueHelpers\.queueSongWithResult/);
  assert.match(renderer, /playerQueueHelpers\.moveQueueIndexToTop/);
  assert.match(renderer, /playerQueueHelpers\.playSearchResultInQueueWithResult/);
  assert.match(renderer, /playerQueueHelpers\.playbackRestrictionMessage/);
});

test('inline HTML event handlers call functions defined by the renderer', () => {
  const html = readProjectFile(indexHtmlPath);
  const renderer = readProjectFile(rendererPath);
  const rendererNames = rendererGlobalNames(renderer);
  const browserGlobals = new Set(['document', 'event']);
  const handlers = [
    ...extractInlineHandlerCalls(html, 'public/index.html'),
    ...extractInlineHandlerCalls(renderer, 'public/renderer/app.js'),
  ];
  const indexHandlerCount = handlers.filter(handler => handler.sourceLabel === 'public/index.html').length;
  const rendererHandlerCount = handlers.filter(handler => handler.sourceLabel === 'public/renderer/app.js').length;
  const missing = [];

  assert.ok(indexHandlerCount >= 140, `expected index.html handlers to be scanned, got ${indexHandlerCount}`);
  assert.ok(
    rendererHandlerCount >= 50,
    `expected renderer-generated handlers to be scanned, got ${rendererHandlerCount}`
  );

  for (const handler of handlers) {
    for (const call of handler.calls) {
      if (!browserGlobals.has(call) && !rendererNames.has(call)) {
        missing.push(`${handler.sourceLabel} ${handler.eventName}="${handler.expression}" -> ${call}()`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test('renderer app remains valid classic JavaScript', () => {
  assert.doesNotThrow(() => {
    new vm.Script(readProjectFile(rendererPath), { filename: rendererPath });
  });
});
