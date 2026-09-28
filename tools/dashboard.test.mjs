import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard, scrubLog, tailLog } from './dashboard.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('dashboard isolates owner data and only polls read routes', async () => {
  const routes = [];
  const key = 'test-owner-key-not-a-real-secret';
  const server = await startDashboard({key, port: 0, backend: 'http://127.0.0.1:61000', fetcher: async url => {
    routes.push(url.pathname);
    return {ok: true, json: async () => url.pathname.endsWith('GetAllUsers') ? {Users: [{UserId: 'fixture', Username: 'Tester'}]} : {players: [{name: 'Tester', where: 'city'}], instances: [], playersOnline: 1, uptimeSeconds: 60, name: 'Test'} };
  }});
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base + '/api/status')).status, 401);
    assert.equal((await fetch(base + '/api/status', {headers: {'x-dashboard-key': key, origin: 'https://untrusted.example'}})).status, 403);
    const response = await fetch(base + '/api/status', {headers: {'x-dashboard-key': key}});
    const data = await response.json();
    assert.equal(data.sample.accounts, 1);
    assert.equal(data.sample.newAccountsObserved, 0);
    assert.equal(data.sample.players[0].name, 'Tester');
    assert.equal(JSON.stringify(data).includes(key), false);
    assert.equal((await fetch(base + '/api/log?name=../../secrets', {headers: {'x-dashboard-key': key}})).status, 404);
    assert.equal(data.sample.locations.city, 1);
    assert.equal(data.sample.locations.hunt, 0);
    assert.deepEqual(routes.sort(), ['/undaunted/api/BackendHealth', '/undaunted/api/GetAllUsers', '/undaunted/api/ServerStatus']);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('redacts credential lines and caps log line count', () => {
  assert.equal(scrubLog('ready\nAuthorization: Bearer secret\nUUK_test\npassword=hello').includes('hello'), false);
  assert.equal(scrubLog(Array(200).fill('ready').join('\n')).split('\n').length, 150);
});
test('refuses an external backend', async () => {
  await assert.rejects(startDashboard({key: 'test-owner-key-long', backend: 'http://example.com'}), /loopback/);
});
test('log reader bounds large files and includes the latest complete line', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dr-dashboard-test-'));
  try {
    const path = join(dir, 'sample.log');
    await writeFile(path, 'old line\n'.repeat(10000) + 'latest line\n');
    const text = await tailLog(path);
    assert.ok(text.includes('latest line'));
    assert.ok(text.length < 32768);
    assert.ok(text.split('\n').length <= 150);
  } finally { await rm(dir, {recursive: true}); }
});
test('backend failure returns an explicit unavailable state without fabricated readings', async () => {
  const key = 'test-owner-key-not-a-real-secret';
  const server = await startDashboard({key, port: 0, backend: 'http://127.0.0.1:61000', fetcher: async () => { throw new Error('offline'); }});
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status`, {headers: {'x-dashboard-key': key}});
    const data = await response.json();
    assert.equal(data.sample, null);
    assert.match(data.error, /unavailable/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
