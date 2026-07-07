const test = require('node:test');
const assert = require('node:assert/strict');

const {
  queueItemKey,
  cloneSong,
  queueSong,
  queueSongNext,
  queueSongWithResult,
  queueSongNextWithResult,
  createPlayerQueueHelpers,
  moveQueueIndexToTop,
  playSearchResultInQueue,
  playSearchResultInQueueWithResult,
  playbackProviderLabel,
  playbackLoginProvider,
  playbackRestrictionMessage,
} = require('../public/renderer/core/player-queue');

test('queueItemKey preserves provider-specific identity rules', () => {
  assert.equal(queueItemKey({ provider: 'qq', mid: 'abc', name: 'n' }), 'qq:abc');
  assert.equal(queueItemKey({ type: 'podcast', programId: 'p1' }), 'podcast:p1');
  assert.equal(queueItemKey({ localKey: 'local-file' }), 'local:local-file');
  assert.equal(queueItemKey({ id: 42 }), 'song:42');
  assert.equal(queueItemKey({ name: 'Song', artist: 'Artist' }), 'Song|Artist');
});

test('queueSong appends, inserts next, and reuses existing queued items', () => {
  const state = { playQueue: [{ id: 1, name: 'Current' }, { id: 2, name: 'Later' }], currentIdx: 0 };

  assert.equal(queueSong(state, { id: 3, name: 'Append' }), 2);
  assert.equal(queueSongNext(state, { id: 2, name: 'Later' }), 1);
  assert.deepEqual(state.playQueue.map(song => song.id), [1, 2, 3]);

  assert.equal(queueSongNext(state, { id: 4, name: 'Next' }), 1);
  assert.deepEqual(state.playQueue.map(song => song.id), [1, 4, 2, 3]);
});

test('queueSong result metadata distinguishes queue mutations from current-song noops', () => {
  const state = { playQueue: [{ id: 1, name: 'Current' }, { id: 2, name: 'Later' }], currentIdx: 0 };

  assert.deepEqual(queueSongWithResult(state, { id: 3, name: 'Append' }), {
    insertAt: 2,
    currentIdx: 0,
    changed: true,
  });
  assert.deepEqual(queueSongNextWithResult(state, { id: 1, name: 'Current' }), {
    insertAt: 0,
    currentIdx: 0,
    changed: false,
  });
  assert.deepEqual(queueSongWithResult(state, null), {
    insertAt: -1,
    currentIdx: 0,
    changed: false,
  });
});

test('moveQueueIndexToTop and playSearchResultInQueue preserve current index behavior', () => {
  const state = { playQueue: [{ id: 1 }, { id: 2 }, { id: 3 }], currentIdx: 1 };

  assert.equal(moveQueueIndexToTop(state, 2), 0);
  assert.deepEqual(state.playQueue.map(song => song.id), [3, 1, 2]);
  assert.equal(state.currentIdx, 2);

  const playState = { playQueue: [{ id: 9, name: 'Old' }], currentIdx: 0 };
  const source = { id: 10, name: 'New' };
  const selected = playSearchResultInQueue(playState, [source], 0);
  assert.equal(selected, 0);
  assert.equal(playState.currentIdx, 0);
  assert.equal(playState.playQueue[0].id, 10);
  assert.notEqual(playState.playQueue[0], source);

  const emptyState = { playQueue: [], currentIdx: -1 };
  assert.equal(playSearchResultInQueue(emptyState, [{ id: 11, name: 'First' }], 0), 0);
  assert.deepEqual(emptyState.playQueue, [{ id: 11, name: 'First' }]);
  assert.equal(playSearchResultInQueue(emptyState, [], 0), -1);
});

test('playSearchResultInQueue result metadata preserves selection and mutation details', () => {
  const existingState = { playQueue: [{ id: 1 }, { id: 2 }, { id: 3 }], currentIdx: 1 };
  assert.deepEqual(playSearchResultInQueueWithResult(existingState, [{ id: 3 }], 0), {
    index: 0,
    currentIdx: 0,
    changed: true,
    matchedExisting: true,
  });
  assert.deepEqual(existingState.playQueue.map(song => song.id), [3, 1, 2]);

  const newState = { playQueue: [{ id: 1 }], currentIdx: 0 };
  const selected = { id: 4, name: 'New' };
  assert.deepEqual(playSearchResultInQueueWithResult(newState, [selected], 0), {
    index: 0,
    currentIdx: 0,
    changed: true,
    matchedExisting: false,
  });
  assert.equal(newState.playQueue[0].id, 4);
  assert.notEqual(newState.playQueue[0], selected);

  assert.deepEqual(playSearchResultInQueueWithResult(newState, [], 0), {
    index: -1,
    currentIdx: 0,
    changed: false,
    matchedExisting: false,
  });
});

test('playback labels and restriction messages preserve provider-specific copy', () => {
  assert.equal(playbackProviderLabel({ provider: 'qq' }), 'QQ 音乐');
  assert.equal(playbackLoginProvider({ provider: 'qq' }), 'qq');
  assert.equal(playbackLoginProvider({ id: 1 }), 'netease');
  assert.equal(playbackRestrictionMessage({ provider: 'qq' }, { reason: 'login_required' }), 'QQ 音乐需要登录后再尝试播放 · 正在打开登录');
  assert.equal(playbackRestrictionMessage({ id: 1 }, { restriction: { category: 'copyright_unavailable' } }), '网易云版权暂不可播 · 可以试试另一个平台版本');
  assert.equal(playbackRestrictionMessage({ id: 1 }, { reason: 'url_unavailable' }), '网易云没有返回可播放地址 · 可以试试另一个平台版本');
  assert.equal(playbackRestrictionMessage({ id: 1 }, { message: '自定义错误' }), '自定义错误');
});

test('cloneSong makes a shallow data copy before queue mutation', () => {
  const song = { id: 1, name: 'A' };
  const cloned = cloneSong(song);
  assert.deepEqual(cloned, song);
  assert.notEqual(cloned, song);
});

test('queue helpers can inject cloneSong to preserve renderer cover hydration', () => {
  const source = { id: 1, name: 'A', customCover: 'cover://a' };
  const state = { playQueue: [], currentIdx: -1 };
  const helpers = createPlayerQueueHelpers({
    cloneSong(song) {
      return Object.assign({}, song || {}, { cover: song && song.customCover });
    },
  });

  assert.equal(helpers.queueSong(state, source), 0);
  assert.deepEqual(state.playQueue[0], { id: 1, name: 'A', customCover: 'cover://a', cover: 'cover://a' });
  assert.notEqual(state.playQueue[0], source);
});
