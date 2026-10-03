import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function loadState(file) {
  try {
    const state = JSON.parse(await readFile(file, 'utf8'));
    if (state.version !== 1 || !state.users || typeof state.users !== 'object' || Array.isArray(state.users)) throw new Error('Invalid key state');
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, users: {} };
    throw new Error('Cannot read key state; refusing to issue replacement codes');
  }
}

export async function saveState(file, state) {
  await mkdir(dirname(file), {recursive: true});
  await writeFile(`${file}.tmp`, JSON.stringify(state), {mode: 0o600});
  await rename(`${file}.tmp`, file);
}

export function backend(base, key, request = fetch) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Metagame must use loopback HTTP');
  async function api(path, body) {
    const response = await request(new URL(`/undaunted/api/${path}`, url), {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: {'x-undaunted-user-api-key': key, 'content-type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error('Metagame request failed');
    return path === 'InviteCodes' ? response.json() : undefined;
  }
  return {
    async find(code) {
      const result = await api('InviteCodes');
      if (!Array.isArray(result.InviteCodes)) throw new Error('Invalid metagame response');
      return result.InviteCodes.find(row => row.inviteCode === code);
    },
    async create(code) { await api('RegisterInviteCode', {NewInviteCode: code, Uses: 1, InfiniteUses: false}); },
  };
}

export class Keys {
  queue = Promise.resolve();
  constructor(state, save, api, generate = () => `DR-${randomBytes(18).toString('base64url')}`) {
    this.state = state; this.save = save; this.api = api; this.generate = generate;
  }
  run(user, claim) {
    const task = this.queue.catch(() => {}).then(() => this.handle(user, claim));
    this.queue = task;
    return task;
  }
  async handle(user, claim) {
    if (!/^\d{17,20}$/.test(user)) throw new Error('Invalid Discord user');
    let entry = this.state.users[user];
    if (!entry) {
      if (!claim) return {status: 'none'};
      entry = this.state.users[user] = {code: this.generate(), pending: true};
      // Save before contacting the backend: retries after a crash reuse this code.
      try { await this.save(this.state); }
      catch (error) { delete this.state.users[user]; throw error; }
    }
    let row = await this.api.find(entry.code);
    if (!row && entry.pending && claim) {
      await this.api.create(entry.code);
      row = await this.api.find(entry.code);
    }
    if (!row) return {status: entry.pending ? 'pending' : 'revoked'};
    if (row.infiniteUses || !Number.isInteger(row.usesRemaining) || row.usesRemaining < 0 || row.usesRemaining > 1) throw new Error('Unexpected code state');
    if (entry.pending) { entry.pending = false; await this.save(this.state); }
    return row.usesRemaining === 0 ? {status: 'redeemed'} : {status: 'ready', code: entry.code};
  }
}
