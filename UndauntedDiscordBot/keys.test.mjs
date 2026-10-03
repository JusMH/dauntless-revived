import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Keys, backend } from './keys.mjs';
const user = '123456789012345678';
function setup() {
  const state = {version: 1, users: {}};
  const rows = new Map();
  let creates = 0;
  const api = {find: async code => rows.get(code), create: async code => {
    creates++; rows.set(code, {inviteCode: code, usesRemaining: 1, infiniteUses: false});
  }};
  return {state, rows, api, count: () => creates, service: new Keys(state, async () => {}, api, () => 'DR-test')};
}
test('concurrent claims and DM retries reuse one single-use code', async () => {
  const f = setup();
  const results = await Promise.all(Array.from({length: 20}, () => f.service.run(user, true)));
  assert.equal(f.count(), 1);
  assert.ok(results.every(r => r.code === 'DR-test' && r.status === 'ready'));
});
test('status distinguishes unclaimed, issued, redeemed and revoked without minting replacements', async () => {
  const f = setup();
  assert.equal((await f.service.run(user, false)).status, 'none');
  assert.equal(f.count(), 0);
  await f.service.run(user, true);
  f.rows.get('DR-test').usesRemaining = 0;
  assert.deepEqual(await f.service.run(user, false), {status: 'redeemed'});
  assert.deepEqual(await f.service.run(user, true), {status: 'redeemed'});
  f.rows.clear();
  assert.deepEqual(await f.service.run(user, true), {status: 'revoked'});
  assert.equal(f.count(), 1);
});
test('an uncertain backend response is recovered without issuing another code', async () => {
  const f = setup(); const create = f.api.create;
  f.api.create = async code => { await create(code); throw new Error('timeout after write'); };
  await assert.rejects(f.service.run(user, true));
  assert.equal((await f.service.run(user, true)).code, 'DR-test');
  assert.equal(f.count(), 1);
});
test('a failed state write never permits issuance on a subsequent request', async () => {
  const f = setup(); f.service.save = async () => { throw new Error('disk full'); };
  await assert.rejects(f.service.run(user, true));
  await assert.rejects(f.service.run(user, true));
  assert.equal(f.count(), 0);
  assert.deepEqual(f.state.users, {});
});
test('backend credentials cannot be sent to remote URLs or redirects', async () => {
  for (const url of ['https://example.com', 'http://example.com', 'http://127.0.0.1@evil.test', 'http://127.0.0.1/path'])
    assert.throws(() => backend(url, 'secret'));
  let request;
  const api = backend('http://127.0.0.1:61000', 'secret', async (url, options) => {
    request = {url: String(url), ...options}; return new Response('{"InviteCodes":[]}', {status: 200});
  });
  assert.equal(await api.find('DR-test'), undefined);
  assert.equal(request.redirect, 'error');
  assert.equal(request.headers['x-undaunted-user-api-key'], 'secret');
});
