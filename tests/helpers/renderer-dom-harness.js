'use strict';

function parseAttributes(raw) {
  var attrs = {};
  var pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:=(["'])(.*?)\2|=([^\s"'=<>`]+))?/g;
  var match;
  while ((match = pattern.exec(raw || ''))) {
    attrs[match[1]] = match[3] != null ? match[3] : (match[4] != null ? match[4] : '');
  }
  return attrs;
}

function createClassList(element) {
  function names() {
    return element.className ? element.className.split(/\s+/).filter(Boolean) : [];
  }
  function write(next) {
    element.className = next.join(' ');
    if (element.className) element.attributes.class = element.className;
    else delete element.attributes.class;
  }
  return {
    add: function() {
      var set = new Set(names());
      for (var i = 0; i < arguments.length; i++) set.add(String(arguments[i]));
      write(Array.from(set));
    },
    remove: function() {
      var removeSet = new Set(Array.prototype.map.call(arguments, String));
      write(names().filter(function(name) { return !removeSet.has(name); }));
    },
    contains: function(name) {
      return names().indexOf(String(name)) >= 0;
    },
    toggle: function(name, force) {
      var has = this.contains(name);
      var shouldAdd = force == null ? !has : !!force;
      if (shouldAdd) this.add(name);
      else this.remove(name);
      return shouldAdd;
    },
    toString: function() {
      return element.className;
    },
  };
}

function matchesSelector(element, selector) {
  selector = String(selector || '').trim();
  if (!selector || !element) return false;
  var tag = /^[A-Za-z][A-Za-z0-9-]*/.exec(selector);
  if (tag && element.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
  var id = /#([A-Za-z_][-A-Za-z0-9_]*)/.exec(selector);
  if (id && element.id !== id[1]) return false;
  var classPattern = /\.([A-Za-z_][-A-Za-z0-9_]*)/g;
  var classMatch;
  while ((classMatch = classPattern.exec(selector))) {
    if (!element.classList.contains(classMatch[1])) return false;
  }
  var attrPattern = /\[([^\]=\s]+)(?:=(["']?)(.*?)\2)?\]/g;
  var attrMatch;
  while ((attrMatch = attrPattern.exec(selector))) {
    var attrName = attrMatch[1];
    if (!element.hasAttribute(attrName)) return false;
    if (attrMatch[3] != null && element.getAttribute(attrName) !== attrMatch[3]) return false;
  }
  return !!(tag || id || selector.indexOf('.') >= 0 || selector.indexOf('[') >= 0);
}

function createEventClass() {
  return function Event(type, opts) {
    opts = opts || {};
    this.type = String(type || '');
    this.bubbles = !!opts.bubbles;
    this.defaultPrevented = false;
    this.cancelBubble = false;
    this.cancelable = !!opts.cancelable;
    this._immediateStopped = false;
    this.target = null;
    this.currentTarget = null;
    this.preventDefault = function() {
      if (this.cancelable) this.defaultPrevented = true;
    };
    this.stopPropagation = function() {
      this.cancelBubble = true;
    };
    this.stopImmediatePropagation = function() {
      this.cancelBubble = true;
      this._immediateStopped = true;
    };
  };
}

function createElement(document, tagName, attrs) {
  attrs = attrs || {};
  var listeners = {};
  var element = {
    ownerDocument: document,
    tagName: String(tagName || 'div').toUpperCase(),
    parentNode: null,
    children: [],
    attributes: Object.assign({}, attrs),
    id: attrs.id || '',
    className: attrs.class || '',
    value: attrs.value || '',
    _textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    appendChild: function(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    addEventListener: function(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener: function(type, fn) {
      listeners[type] = (listeners[type] || []).filter(function(item) { return item !== fn; });
    },
    dispatchEvent: function(event) {
      if (!event.target) event.target = element;
      event.currentTarget = element;
      var handlers = (listeners[event.type] || []).slice();
      for (var i = 0; i < handlers.length; i++) {
        handlers[i].call(element, event);
        if (event._immediateStopped) break;
      }
      if (event.bubbles && !event.cancelBubble && element.parentNode) element.parentNode.dispatchEvent(event);
      return !event.defaultPrevented;
    },
    setAttribute: function(name, value) {
      value = String(value);
      element.attributes[name] = value;
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name === 'value') element.value = value;
      if (name.indexOf('data-') === 0) element.dataset[dataName(name)] = value;
    },
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name) ? element.attributes[name] : null;
    },
    hasAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name);
    },
    contains: function(target) {
      for (var node = target; node; node = node.parentNode) {
        if (node === element) return true;
      }
      return false;
    },
    closest: function(selector) {
      for (var node = element; node; node = node.parentNode) {
        if (matchesSelector(node, selector)) return node;
      }
      return null;
    },
    querySelector: function(selector) {
      return queryAll(element, selector)[0] || null;
    },
    querySelectorAll: function(selector) {
      return queryAll(element, selector);
    },
  };
  Object.defineProperty(element, 'textContent', {
    get: function() {
      return element._textContent + element.children.map(function(child) { return child.textContent; }).join('');
    },
    set: function(value) {
      element._textContent = String(value == null ? '' : value);
      element.children = [];
      element.innerHTML = element._textContent;
    },
  });
  element.classList = createClassList(element);
  Object.keys(attrs).forEach(function(name) {
    if (name.indexOf('data-') === 0) element.dataset[dataName(name)] = attrs[name];
  });
  return element;
}

function dataName(attrName) {
  return attrName.slice(5).replace(/-([a-z])/g, function(_, ch) { return ch.toUpperCase(); });
}

function queryAll(root, selector) {
  var selectors = String(selector || '').split(',').map(function(part) { return part.trim(); }).filter(Boolean);
  var found = [];
  function visit(node) {
    node.children.forEach(function(child) {
      if (selectors.some(function(item) { return matchesSelectorChain(child, item); })) found.push(child);
      visit(child);
    });
  }
  visit(root);
  return found;
}

function matchesSelectorChain(element, selector) {
  var parts = selector.split(/\s+/).filter(Boolean);
  var node = element;
  for (var i = parts.length - 1; i >= 0; i--) {
    while (node && !matchesSelector(node, parts[i])) node = node.parentNode;
    if (!node) return false;
    node = node.parentNode;
  }
  return true;
}

function createMemoryStorage() {
  var data = new Map();
  return {
    getItem: function(key) {
      key = String(key);
      return data.has(key) ? data.get(key) : null;
    },
    setItem: function(key, value) {
      data.set(String(key), String(value));
    },
    removeItem: function(key) {
      data.delete(String(key));
    },
    clear: function() {
      data.clear();
    },
  };
}

function createDocument(html) {
  var document = {};
  var root = createElement(document, 'document', {});
  document.body = createElement(document, 'body', {});
  root.appendChild(document.body);
  document.createElement = function(tagName) {
    return createElement(document, tagName, {});
  };
  document.getElementById = function(id) {
    return queryAll(root, '#' + id)[0] || null;
  };
  document.querySelector = function(selector) {
    return root.querySelector(selector);
  };
  document.querySelectorAll = function(selector) {
    return root.querySelectorAll(selector);
  };
  parseHtmlInto(document.body, html || '', document);
  return document;
}

function parseHtmlInto(parent, html, document) {
  var stack = [parent];
  var tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g;
  var match;
  var lastIndex = 0;
  while ((match = tagPattern.exec(html))) {
    appendText(stack[stack.length - 1], html.slice(lastIndex, match.index));
    var full = match[0];
    var tag = match[1];
    var attrText = match[2] || '';
    if (full[1] === '/') {
      if (stack.length > 1) stack.pop();
      lastIndex = tagPattern.lastIndex;
      continue;
    }
    var element = createElement(document, tag, parseAttributes(attrText));
    stack[stack.length - 1].appendChild(element);
    if (!/\/\s*>$/.test(full) && !/^(input|img|br|hr|meta|link)$/i.test(tag)) stack.push(element);
    lastIndex = tagPattern.lastIndex;
  }
  appendText(stack[stack.length - 1], html.slice(lastIndex));
}

function appendText(element, text) {
  text = String(text || '');
  if (!text.trim()) return;
  element._textContent += text;
  element.innerHTML += text;
}

function createRendererDomHarness(opts) {
  opts = opts || {};
  var frames = [];
  var nextFrameId = 1;
  var Event = createEventClass();
  var document = createDocument(opts.html || '');
  var window = {
    Event: Event,
    document: document,
    localStorage: createMemoryStorage(),
    requestAnimationFrame: function(fn) {
      var id = nextFrameId++;
      frames.push({ id: id, fn: fn });
      return id;
    },
    cancelAnimationFrame: function(id) {
      frames = frames.filter(function(frame) { return frame.id !== id; });
    },
  };
  document.defaultView = window;
  return {
    window: window,
    document: document,
    flushAnimationFrames: function() {
      var pending = frames.slice();
      frames = [];
      pending.forEach(function(frame) { frame.fn(Date.now()); });
    },
  };
}

module.exports = {
  createRendererDomHarness: createRendererDomHarness,
};
