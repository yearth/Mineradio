const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const indexHtmlPath = path.join(root, 'public', 'index.html');
const rendererPath = path.join(root, 'public', 'renderer', 'app.js');
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
