import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpstreamUrl } from '../api/introdb.ts';

test('introdb proxy builds TV and movie upstream URLs', () => {
  assert.equal(buildUpstreamUrl({ imdb_id: 'tt14976292', season: '1', episode: '2' }),
    'https://api.introdb.app/segments?imdb_id=tt14976292&season=1&episode=2');
  assert.equal(buildUpstreamUrl({ imdb_id: 'tt1375666', is_movie: 'true' }),
    'https://api.introdb.app/segments?imdb_id=tt1375666&is_movie=true');
});

test('introdb proxy rejects anything outside the allowlist', () => {
  assert.equal(buildUpstreamUrl({ imdb_id: 'https://evil.example', is_movie: 'true' }), null);
  assert.equal(buildUpstreamUrl({ imdb_id: 'tt1', season: '1' }), null);
  assert.equal(buildUpstreamUrl({ imdb_id: 'tt1', season: '1&x=2', episode: '1' }), null);
});
