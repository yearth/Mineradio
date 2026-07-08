const test = require('node:test');
const assert = require('node:assert/strict');

const { createRendererDomHarness } = require('./helpers/renderer-dom-harness');

test('renderer DOM harness supports id lookup, classList, values, and query selectors', () => {
  const env = createRendererDomHarness({
    html: [
      '<section id="search-area" class="shell">',
      '<input id="search-input" class="field" value="old">',
      '<div id="search-results" class="results show"></div>',
      '</section>',
    ].join(''),
  });

  const input = env.document.getElementById('search-input');
  const results = env.document.querySelector('#search-results');

  assert.equal(input.value, 'old');
  input.value = '周杰伦';
  assert.equal(env.document.getElementById('search-input').value, '周杰伦');
  assert.equal(results.classList.contains('show'), true);
  results.classList.remove('show');
  results.classList.add('empty');
  assert.equal(results.className, 'results empty');
  assert.equal(env.document.querySelectorAll('.empty').length, 1);
});

test('renderer DOM harness dispatches DOM-style events with closest and contains support', () => {
  const env = createRendererDomHarness({
    html: '<div id="panel"><button id="clear" class="action" data-clear-history="1">清空</button></div>',
  });
  const panel = env.document.getElementById('panel');
  const button = env.document.getElementById('clear');
  const events = [];

  panel.addEventListener('click', event => {
    events.push({
      targetId: event.target.id,
      matched: event.target.closest('[data-clear-history]').id,
      contains: panel.contains(event.target),
    });
  });

  button.dispatchEvent(new env.window.Event('click', { bubbles: true }));

  assert.deepEqual(events, [
    { targetId: 'clear', matched: 'clear', contains: true },
  ]);
});

test('renderer DOM harness supports renderer-style compound, descendant, and comma selectors', () => {
  const env = createRendererDomHarness({
    html: [
      '<div id="top-right">',
      '<button class="top-account-pill active" data-provider="qq">QQ</button>',
      '</div>',
      '<input id="fx" type="range">',
      '<section class="preset-card" data-preset="rain"></section>',
    ].join(''),
  });

  assert.equal(env.document.querySelector('#top-right .top-account-pill').textContent, 'QQ');
  assert.equal(env.document.querySelector('button,.fx-mini-btn,input[type="range"]').tagName, 'BUTTON');
  assert.equal(env.document.querySelector('.preset-card[data-preset="rain"]').tagName, 'SECTION');
  assert.equal(env.document.querySelectorAll('#top-right .top-account-pill, input[type="range"]').length, 2);
});

test('renderer DOM harness parses nested text without leaking closing tags', () => {
  const env = createRendererDomHarness({
    html: '<div id="outer"><button id="inner">QQ</button></div>',
  });

  assert.equal(env.document.body.textContent, 'QQ');
  assert.equal(env.document.getElementById('outer').textContent, 'QQ');
  assert.equal(env.document.getElementById('inner').textContent, 'QQ');
});

test('renderer DOM harness events support preventDefault and propagation controls', () => {
  const env = createRendererDomHarness({
    html: '<div id="outer"><button id="inner">点</button></div>',
  });
  const outer = env.document.getElementById('outer');
  const inner = env.document.getElementById('inner');
  const calls = [];

  outer.addEventListener('click', () => calls.push('outer'));
  inner.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    calls.push('inner-first');
  });
  inner.addEventListener('click', () => calls.push('inner-second'));

  const event = new env.window.Event('click', { bubbles: true, cancelable: true });
  const result = inner.dispatchEvent(event);

  assert.equal(result, false);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, ['inner-first']);
});

test('renderer DOM harness events follow browser defaults for bubbling and canceling', () => {
  const env = createRendererDomHarness({
    html: '<div id="outer"><button id="inner">点</button></div>',
  });
  const outer = env.document.getElementById('outer');
  const inner = env.document.getElementById('inner');
  const calls = [];

  outer.addEventListener('click', () => calls.push('outer'));

  const defaultEvent = new env.window.Event('click');
  assert.equal(defaultEvent.bubbles, false);
  assert.equal(defaultEvent.cancelable, false);
  inner.dispatchEvent(defaultEvent);
  defaultEvent.preventDefault();

  assert.equal(defaultEvent.defaultPrevented, false);
  assert.deepEqual(calls, []);
});

test('renderer DOM harness provides storage and deterministic animation frame flushing', () => {
  const env = createRendererDomHarness();
  const calls = [];

  env.window.localStorage.setItem('q', '雨天');
  const frameId = env.window.requestAnimationFrame(() => calls.push(env.window.localStorage.getItem('q')));
  env.window.requestAnimationFrame(() => calls.push('second'));

  assert.equal(typeof frameId, 'number');
  assert.deepEqual(calls, []);
  env.flushAnimationFrames();
  assert.deepEqual(calls, ['雨天', 'second']);
  env.window.localStorage.removeItem('q');
  assert.equal(env.window.localStorage.getItem('q'), null);
});
