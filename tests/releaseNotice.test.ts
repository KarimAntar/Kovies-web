import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotice } from '../src/lib/releaseNotice.ts';

test('in cinemas with a digital date', () => {
  assert.deepEqual(releaseNotice({ status: 'in_theaters', theatricalDate: '2026-10-13', digitalDate: '2026-12-01' }, 'Street Fighter'), {
    title: 'In cinemas now',
    body: 'Street Fighter is only showing in cinemas. It should be available to stream from Dec 1, 2026.',
  });
});

test('in cinemas without a digital date', () => {
  assert.equal(
    releaseNotice({ status: 'in_theaters', theatricalDate: '2026-10-19', digitalDate: null }, 'Clayface')?.body,
    'Clayface is only showing in cinemas. It will be available here once it is released online.'
  );
});

test('upcoming', () => {
  assert.deepEqual(releaseNotice({ status: 'upcoming', theatricalDate: '2026-11-20', digitalDate: null }, 'Some Film'), {
    title: 'Coming soon',
    body: 'Some Film opens in cinemas on Nov 20, 2026.',
  });
});

test('no notice when streaming or missing', () => {
  assert.equal(releaseNotice({ status: 'streaming', theatricalDate: null, digitalDate: '2026-07-28' }, 'X'), null);
  assert.equal(releaseNotice(undefined, 'X'), null);
});
