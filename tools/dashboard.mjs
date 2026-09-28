import http from 'node:http';
import os from 'node:os';
import { readFile, open, lstat } from 'node:fs/promises';
import { timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function scrubLog(text) {
  return text.split(/\r?\n/).slice(-150).map(line => {
    // Omit whole credential-bearing lines, including structured request captures.
    if (/token|password|secret|authorization|api.?key|exchange_code|UUK_|eyJ|cookie/i.test(line)) return '[credential-bearing line omitted]';
    return line.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 2000);
  }).join('\n');
}

export async function tailLog(path) {
  if ((await lstat(path)).isSymbolicLink()) throw new Error('Log links are not supported');
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('Not a log file');
    const size = Math.min(stat.size, 32768);
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await file.read(buffer, 0, size, stat.size - size);
    let text = buffer.subarray(0, bytesRead).toString('utf8');
    if (stat.size > size) text = text.slice(text.indexOf('\n') + 1);
    return scrubLog(text);
  } finally { await file.close(); }
}

const digest = value => createHash('sha256').update(value).digest();
const cpuTimes = () => os.cpus().reduce((sum, cpu) => {
  sum.idle += cpu.times.idle;
  sum.total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  return sum;
}, {idle: 0, total: 0});

export async function startDashboard({key, backend, port = 61110, logs = {}, fetcher = fetch}) {
  if (typeof key !== 'string' || key.length < 16) throw new Error('An owner key of at least 16 characters is required');
  const target = new URL(backend);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.username || target.password) throw new Error('Backend must be loopback HTTP');
  const page = await readFile(new URL('./dashboard.html', import.meta.url));
  let previous = cpuTimes(), known = null, added = 0, sample = null, failure = null, polling = false;
  const history = [];
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const started = performance.now();
      const get = async route => {
        const response = await fetcher(new URL(route, target), {headers: {'x-undaunted-user-api-key': key}, signal: AbortSignal.timeout(3000), redirect: 'error'});
        if (!response.ok) throw new Error('Backend unavailable or owner key rejected');
        return response.json();
      };
      const [accounts, status] = await Promise.all([get('/undaunted/api/GetAllUsers'), get('/undaunted/api/ServerStatus')]);
      let health = null;
      try { health = await get('/undaunted/api/BackendHealth'); } catch { /* Older/disabled backends still show host readings. */ }
      if (!Array.isArray(accounts.Users) || !Array.isArray(status.players) || !Array.isArray(status.instances)) throw new Error('Unexpected backend response');
      const ids = new Set(accounts.Users.map(user => user.UserId));
      if (known) for (const id of ids) if (!known.has(id)) added++;
      known = ids;
      const current = cpuTimes(), elapsed = current.total - previous.total;
      const cpu = elapsed > 0 ? 100 * (1 - (current.idle - previous.idle) / elapsed) : null;
      previous = current;
      const locations = {city: 0, hunt: 0, dojo: 0, tutorial: 0, menu: 0, unknown: 0};
      for (const player of status.players) locations[Object.hasOwn(locations, player.where) ? player.where : 'unknown']++;
      const point = {at: new Date().toISOString(), cpu, ramUsedMB: (os.totalmem() - os.freemem()) / 1048576, ramTotalMB: os.totalmem() / 1048576, players: status.playersOnline, accounts: ids.size, newAccountsObserved: added, backendMs: performance.now() - started,
        requestsPerSecond: health?.requests?.requestsPerSecond ?? null, errorPercent: health?.requests?.serverErrorPercent ?? null, eventLoopP95Ms: health?.eventLoop?.p95Ms ?? null};
      history.push(point);
      if (history.length > 720) history.shift();
      sample = { ...point, players: status.players, instances: status.instances, history, uptimeSeconds: status.uptimeSeconds, hostUptimeSeconds: os.uptime(), dashboardUptimeSeconds: process.uptime(), locations, health, name: status.name };
      failure = null;
    } catch { failure = 'Backend unavailable or owner key rejected; last readings are stale.'; }
    finally { polling = false; }
  }
  await poll();
  const timer = setInterval(poll, 5000);
  timer.unref();
  let requests = 0, windowStart = Date.now(), readingLog = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(req.headers.host ?? '') || req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (Date.now() - windowStart > 60000) { requests = 0; windowStart = Date.now(); }
    if (++requests > 300) { res.writeHead(429).end(); return; }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page); return; }
    if (req.url === '/dashboard.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(await readFile(new URL('./dashboard-client.js', import.meta.url))); return; }
    const supplied = req.headers['x-dashboard-key'];
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(supplied), digest(key))) { res.writeHead(401).end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/status') { res.end(JSON.stringify({sample, error: failure, logNames: Object.keys(logs)})); return; }
    if (req.url?.startsWith('/api/log?')) {
      const name = new URL(req.url, 'http://localhost').searchParams.get('name');
      if (!name || !Object.hasOwn(logs, name)) { res.writeHead(404).end(); return; }
      if (readingLog) { res.writeHead(429).end(); return; }
      readingLog = true;
      try { res.end(JSON.stringify({text: await tailLog(logs[name])})); }
      catch { res.writeHead(503).end(JSON.stringify({error: 'Log unavailable'})); }
      finally { readingLog = false; }
      return;
    }
    res.writeHead(404).end();
  });
  server.on('close', () => clearInterval(timer));
  try { await new Promise((yes, no) => { server.once('error', no); server.listen(port, '127.0.0.1', yes); }); }
  catch (error) { clearInterval(timer); throw error; }
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const key = (await readFile(process.env.DASHBOARD_OWNER_KEY_FILE, 'utf8')).trim();
    const logs = JSON.parse(process.env.DASHBOARD_LOG_FILES || '{}');
    if (!logs || Array.isArray(logs) || typeof logs !== 'object' || Object.values(logs).some(path => typeof path !== 'string')) throw new Error('DASHBOARD_LOG_FILES must map labels to file paths');
    const port = Number(process.env.DASHBOARD_PORT || 61110);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid dashboard port');
    await startDashboard({key, backend: process.env.DASHBOARD_BACKEND || 'http://127.0.0.1:61000', port, logs});
    console.log(`Owner dashboard: http://127.0.0.1:${port} (use an SSH tunnel remotely)`);
  })().catch(() => { console.error('Dashboard startup failed. Check owner key file, settings and port.'); process.exitCode = 1; });
}
