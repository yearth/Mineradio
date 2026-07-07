'use strict';

function createAbortControllerStub() {
  function StubAbortController() {
    this.signal = { aborted: false };
  }
  StubAbortController.prototype.abort = function() {
    this.signal.aborted = true;
  };
  return StubAbortController;
}

function createApiJson(deps) {
  deps = deps || {};
  var fetchImpl = deps.fetch;
  var AbortControllerImpl = deps.AbortController;
  var setTimeoutImpl = deps.setTimeout || setTimeout;
  var clearTimeoutImpl = deps.clearTimeout || clearTimeout;

  return async function apiJson(url, opts) {
    opts = opts || {};
    var timeoutMs = Number(opts.timeoutMs) || 0;
    var fetchOpts = Object.assign({}, opts);
    delete fetchOpts.timeoutMs;
    var timer = null;
    if (timeoutMs && AbortControllerImpl && !fetchOpts.signal) {
      var controller = new AbortControllerImpl();
      fetchOpts.signal = controller.signal;
      timer = setTimeoutImpl(function(){ controller.abort(); }, timeoutMs);
    }
    try {
      var res = await fetchImpl(url, fetchOpts);
      return res.json();
    } finally {
      if (timer) clearTimeoutImpl(timer);
    }
  };
}

module.exports = {
  createApiJson: createApiJson,
  createAbortControllerStub: createAbortControllerStub,
};
