import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPopup, menuKeyIndex } from '../src/lib/menuInteraction.ts';
import { createPlaybackDiagnostics } from '../src/lib/playbackDiagnostics.ts';

test('popup clamps both edges including a viewport smaller than the menu', () => {
  assert.deepEqual(clampPopup(990, 790, 200, 50, 1000, 800), { left: 792, top: 742 });
  assert.deepEqual(clampPopup(-20, -10, 200, 50, 100, 40), { left: 8, top: 8 });
});
test('menu navigation wraps and supports Home and End', () => {
  assert.equal(menuKeyIndex('ArrowDown', 2, 3), 0);
  assert.equal(menuKeyIndex('ArrowUp', 0, 3), 2);
  assert.equal(menuKeyIndex('Home', 2, 3), 0);
  assert.equal(menuKeyIndex('End', 0, 3), 2);
  assert.equal(menuKeyIndex('k', 0, 3), null);
});
test('diagnostics bound records and discard all unapproved payload fields and strings', () => {
  const log = createPlaybackDiagnostics();
  for (let i = 0; i < 150; i++) log.record('hls-error', { fatal: true, code: 3, message: 'secret', url: 'https://private/?token=secret', type: 'secret', headers: { Authorization: 'secret' } });
  assert.equal(log.snapshot().length, 100);
  assert.equal(JSON.stringify(log.snapshot()).includes('secret'), false);
  assert.equal(log.snapshot()[0].fatal, true);
  const snapshot = log.snapshot();
  snapshot.length = 0;
  assert.equal(log.snapshot().length, 100);
});
