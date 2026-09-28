(() => {
  let key = '', busy = false;
  const el = id => document.getElementById(id);
  async function get(path) {
    const response = await fetch(path, {headers: {'x-dashboard-key': key}, signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error(response.status === 401 ? 'Owner key rejected.' : 'Dashboard request failed.');
    return response.json();
  }
  function graph(id, history) {
    const canvas = el(id), ctx = canvas.getContext('2d');
    canvas.width = Math.max(200, canvas.clientWidth * devicePixelRatio); canvas.height = 140 * devicePixelRatio;
    const values = history.map(row => row[id]);
    const max = Math.max(1, ...values.filter(value => value !== null));
    ctx.strokeStyle = '#49d4d0'; ctx.lineWidth = 2 * devicePixelRatio; ctx.beginPath();
    let gap = true;
    values.forEach((value, i) => { if (value === null) { gap = true; return; } const x = i * canvas.width / Math.max(1, values.length - 1), y = canvas.height - 20 - value / max * (canvas.height - 40); if (gap) ctx.moveTo(x, y); else ctx.lineTo(x, y); gap = false; });
    ctx.stroke(); ctx.fillStyle = '#e4eef5'; ctx.font = `${12 * devicePixelRatio}px system-ui`; ctx.fillText(`Current: ${values.at(-1) == null ? 'unavailable' : Number(values.at(-1)).toFixed(1)} · peak: ${values.some(v => v != null) ? max.toFixed(1) : 'unavailable'}`, 4, 16 * devicePixelRatio);
  }
  function list(id, values) { el(id).replaceChildren(...values.map(text => { const item = document.createElement('li'); item.textContent = text; return item; })); }
  async function refresh() {
    if (!key || busy || document.hidden) return;
    busy = true;
    try {
      const result = await get('/api/status');
      el('error').textContent = result.error || '';
      el('login').hidden = true; el('data').hidden = false;
      const s = result.sample;
      if (s) {
        el('summary').textContent = `${s.name} · ${s.accounts} accounts · ${s.newAccountsObserved} newly observed · ${s.players.length} online · RAM ${Math.round(s.ramUsedMB)} / ${Math.round(s.ramTotalMB)} MB · uptime ${Math.floor(s.uptimeSeconds / 60)} min`;
        el('freshness').textContent = `Last successful sample: ${s.at}`;
        for (const id of ['cpu', 'ramUsedMB', 'players', 'backendMs', 'requestsPerSecond', 'errorPercent', 'eventLoopP95Ms']) graph(id, s.history);
        const r = s.health?.requests;
        el('health').textContent = r ? `Last 60 seconds: ${r.completed} responses · ${r.clientErrors} client errors · ${r.serverErrors} server errors · ${r.aborted} aborted · latency upper bounds p50 ${r.latencyP50UpperMs ?? 'n/a'} ms / p95 ${r.latencyP95UpperMs ?? 'n/a'} ms · backend RAM ${Math.round(s.health.memoryMB.rss)} MB · Bans: not implemented` : 'Backend health unavailable. Enable BACKEND_HEALTH=1 on a supported backend. Bans: not implemented.';
        el('locations').textContent = `Ramsgate: ${s.locations.city} · Hunts: ${s.locations.hunt} · Dojo: ${s.locations.dojo} · Tutorial: ${s.locations.tutorial} · Menu: ${s.locations.menu} · Unknown: ${s.locations.unknown}`;
        const duration = seconds => `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h ${Math.floor(seconds / 60) % 60}m`;
        el('uptimes').textContent = `VPS uptime: ${duration(s.hostUptimeSeconds)} · Backend: ${duration(s.uptimeSeconds)} · Dashboard: ${duration(s.dashboardUptimeSeconds)}`;
        list('playerList', s.players.map(player => `${player.name} — ${player.where}`));
        list('worldList', s.instances.map(world => `${world.title}: ${world.players}/${world.maxPlayers}`));
      }
      if (el('logs').options.length === 0) for (const name of result.logNames) { const option = document.createElement('option'); option.textContent = name; option.value = name; el('logs').append(option); }
    } catch (error) { el('error').textContent = `${error.message} Displayed readings may be stale.`; }
    finally { busy = false; }
  }
  el('connect').onclick = () => { key = el('key').value.trim(); el('key').value = ''; refresh(); };
  el('logout').onclick = () => { key = ''; location.reload(); };
  el('refreshLog').onclick = async () => { if (!key || !el('logs').value) return; try { el('logText').textContent = (await get(`/api/log?name=${encodeURIComponent(el('logs').value)}`)).text; } catch (error) { el('logText').textContent = error.message; } };
  setInterval(refresh, 5000);
})();
