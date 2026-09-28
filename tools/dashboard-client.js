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
    ctx.stroke(); ctx.fillStyle = '#e4eef5'; ctx.font = `${12 * devicePixelRatio}px system-ui`; ctx.fillText(`Current: ${Number(values.at(-1) ?? 0).toFixed(1)} · peak: ${max.toFixed(1)}`, 4, 16 * devicePixelRatio);
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
        for (const id of ['cpu', 'ramUsedMB', 'players', 'backendMs']) graph(id, s.history);
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
