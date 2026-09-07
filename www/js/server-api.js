(function () {
  function buildUrl(server, path) {
    const proto = server.https ? 'https' : 'http';
    return proto + '://' + server.host + ':' + server.port + path;
  }

  function authHeader(server) {
    const cred = btoa((server.username || 'admin') + ':' + (server.password || ''));
    return 'Basic ' + cred;
  }

  async function request(server, path, options, timeoutMs) {
    options = options || {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 5000);
    try {
      const headers = { Authorization: authHeader(server) };
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(buildUrl(server, path), {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch (e) {}
        throw new Error('HTTP ' + res.status + (detail ? ': ' + detail : ''));
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function getInfo(server) { return request(server, '/v1/api/info'); }
  function getPlayers(server) { return request(server, '/v1/api/players'); }
  function getMetrics(server) { return request(server, '/v1/api/metrics'); }
  function getGameData(server) { return request(server, '/v1/api/game-data', {}, 20000); }
  function getSettings(server) { return request(server, '/v1/api/settings'); }

  function announce(server, message) {
    return request(server, '/v1/api/announce', { method: 'POST', body: { message } });
  }
  function kick(server, userid, message) {
    return request(server, '/v1/api/kick', { method: 'POST', body: { userid, message: message || '' } });
  }
  function ban(server, userid, message) {
    return request(server, '/v1/api/ban', { method: 'POST', body: { userid, message: message || '' } });
  }
  function unban(server, userid) {
    return request(server, '/v1/api/unban', { method: 'POST', body: { userid } });
  }
  function save(server) {
    return request(server, '/v1/api/save', { method: 'POST' }, 15000);
  }
  function shutdown(server, waittime, message) {
    return request(server, '/v1/api/shutdown', { method: 'POST', body: { waittime, message: message || '' } });
  }
  function forceStop(server) {
    return request(server, '/v1/api/stop', { method: 'POST' });
  }

  const pollers = new Map();

  function startPolling(server, intervalMs, onUpdate) {
    stopPolling(server.id);
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const data = await getPlayers(server);
        const metrics = await getMetrics(server).catch(() => null);
        onUpdate(server.id, { online: true, players: data.players || [], metrics, error: null, lastUpdate: Date.now() });
      } catch (e) {
        onUpdate(server.id, { online: false, players: [], metrics: null, error: e.message, lastUpdate: Date.now() });
      }
    }
    tick();
    const handle = setInterval(tick, intervalMs);
    pollers.set(server.id, { handle, stop: () => { stopped = true; } });
  }

  function stopPolling(serverId) {
    const p = pollers.get(serverId);
    if (p) { clearInterval(p.handle); p.stop(); pollers.delete(serverId); }
  }

  window.PalServerAPI = {
    getInfo, getPlayers, getMetrics, getGameData, getSettings,
    announce, kick, ban, unban, save, shutdown, forceStop,
    startPolling, stopPolling,
  };
})();
