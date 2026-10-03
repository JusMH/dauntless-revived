import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Keys, backend } from './keys.mjs';
const user = '123456789012345678';
function setup() {
  const state = {version: 1, users: {}};
  const rows = new Map();
  const links = new Map();
  let creates = 0;
  const api = {linkedAccount: async id => links.get(id), linkAccount: async (id, uid) => {
    if (links.has(id) && links.get(id).userId !== uid) return {status:'discord_already_linked'};
    if ([...links].some(([other, value]) => other !== id && value.userId === uid)) return {status:'account_already_linked'};
    links.set(id,{userId:uid}); return {status:'linked'};
  }, find: async code => rows.get(code), create: async code => {
    creates++; rows.set(code, {inviteCode: code, usesRemaining: 1, infiniteUses: false});
  }};
  return {state, rows, links, api, count: () => creates, service: new Keys(state, async () => {}, api, () => 'DR-test')};
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

test('linking verifies account ownership, persists identity only and prevents conflicting links', async () => {
  const f = setup(); const secret = 'UUK_test-private-launcher-key'; let saved;
  f.api.identity = async key => key === secret ? {userId:'UID-account',username:'Slayer'} : null;
  f.service.save = async value => { saved = JSON.stringify(value); };
  assert.deepEqual(await f.service.link(user, 'invalid-private-key'), {status:'invalid_key'});
  assert.deepEqual(await f.service.link(user, secret), {status:'linked'});
  assert.equal(saved, undefined);
  assert.equal(f.links.get(user).userId, 'UID-account');
  assert.ok(!JSON.stringify(f.service.state).includes(secret));
  assert.deepEqual(await f.service.run(user, false), {status:'linked'});
  assert.deepEqual(await f.service.run(user, true), {status:'linked'});
  assert.equal(f.count(), 0);
  assert.deepEqual(await f.service.link('223456789012345678', secret), {status:'account_already_linked'});
  f.api.identity = async () => ({userId:'UID-other',username:'Other'});
  assert.deepEqual(await f.service.link(user, secret), {status:'discord_already_linked'});
});
test('failed link persistence leaves the account unlinked and retryable', async () => {
  const f = setup(); f.api.identity = async () => ({userId:'UID-account',username:'Slayer'});
  f.api.linkAccount = async () => { throw new Error('disk full'); };
  await assert.rejects(f.service.link(user, 'private-key-for-testing'), /disk full/);
  assert.equal(f.service.state.links, undefined);
});
test('legacy verified links migrate idempotently without issuing or changing keys', async () => {
  const f = setup();
  f.state.links = {[user]:{userId:'UID-account',username:'Slayer'}};
  await f.service.migrateLinks(); await f.service.migrateLinks();
  assert.equal(f.links.size,1);
  assert.equal(f.count(),0);
  assert.equal((await f.service.run(user,true)).status,'linked');
});
test('identity verification sends the supplied key only to loopback and rejects invalid keys', async () => {
  let sent; let status=200;
  const api = backend('http://127.0.0.1:61000','admin-secret',async (url, options) => {
    sent={url:String(url),...options}; return new Response(JSON.stringify({UserId:'UID-account',Username:'Slayer'}),{status});
  });
  assert.deepEqual(await api.identity('player-key'),{userId:'UID-account',username:'Slayer'});
  assert.equal(sent.url,'http://127.0.0.1:61000/undaunted/api/GetUserInfo');
  assert.equal(sent.headers['x-undaunted-user-api-key'],'player-key');
  assert.equal(sent.redirect,'error');
  status=401; assert.equal(await api.identity('bad-key'),null);
});
