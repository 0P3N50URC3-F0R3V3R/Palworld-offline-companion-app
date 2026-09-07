(function () {
  const COLUMNS = [
    { key: 'Hp', label: 'HP' },
    { key: 'Base attack', label: 'ATK' },
    { key: 'Defense', label: 'DEF' },
    { key: 'Support', label: 'Support' },
    { key: 'Craft speed', label: 'Craft Spd' },
    { key: 'Rarity', label: 'Rarity' },
    { key: 'Combi rank', label: 'Combi Rank' },
  ];

  let pals = [];
  let detailBySlug = {};
  let sortKey = 'Hp';
  let sortDir = -1;
  const traySlugs = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function statValue(slug, key) {
    const d = detailBySlug[slug];
    const v = d && d.stats && d.stats[key];
    return v == null || v === '' ? null : Number(v);
  }

  function renderTable(filter) {
    const q = (filter || '').trim().toLowerCase();
    const rows = pals.filter(p => !q || p.name.toLowerCase().includes(q));
    rows.sort((a, b) => {
      const av = statValue(a.slug, sortKey), bv = statValue(b.slug, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * sortDir;
    });

    let html = '<thead><tr><th class="ct-name-col">Pal</th>';
    for (const col of COLUMNS) {
      const active = col.key === sortKey ? (sortDir === 1 ? ' asc' : ' desc') : '';
      html += '<th class="ct-sortable' + active + '" data-key="' + esc(col.key) + '">' + col.label + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (const p of rows) {
      const inTray = traySlugs.includes(p.slug) ? ' in-tray' : '';
      html += '<tr class="ct-row' + inTray + '" data-slug="' + esc(p.slug) + '">';
      html += '<td class="ct-name-col"><span class="ct-thumb" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></span>' + esc(p.name) + '</td>';
      for (const col of COLUMNS) {
        const v = statValue(p.slug, col.key);
        html += '<td>' + (v == null ? '&mdash;' : v) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody>';
    document.getElementById('compareTable').innerHTML = html;

    document.querySelectorAll('#compareTable th.ct-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (key === sortKey) sortDir *= -1; else { sortKey = key; sortDir = -1; }
        renderTable(document.getElementById('compareSearch').value);
      });
    });
    document.querySelectorAll('#compareTable tr.ct-row').forEach(tr => {
      tr.addEventListener('click', () => toggleTray(tr.dataset.slug, filter));
    });
  }

  function toggleTray(slug, filter) {
    const idx = traySlugs.indexOf(slug);
    if (idx !== -1) { traySlugs.splice(idx, 1); }
    else { if (traySlugs.length >= 4) traySlugs.shift(); traySlugs.push(slug); }
    renderTray();
    renderTable(filter);
  }

  function renderTray() {
    const el = document.getElementById('compareTray');
    if (!traySlugs.length) { el.innerHTML = '<div class="empty">Click up to 4 Pals below to compare them side by side.</div>'; return; }
    const trayPals = traySlugs.map(s => pals.find(p => p.slug === s)).filter(Boolean);
    let best = {};
    for (const col of COLUMNS) {
      let max = -Infinity;
      for (const p of trayPals) { const v = statValue(p.slug, col.key); if (v != null && v > max) max = v; }
      best[col.key] = max;
    }
    let html = '<div class="ct-cards">';
    for (const p of trayPals) {
      html += '<div class="ct-card">';
      html += '<div class="ct-card-head"><span class="ct-thumb lg" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></span><b>' + esc(p.name) + '</b></div>';
      for (const col of COLUMNS) {
        const v = statValue(p.slug, col.key);
        const isBest = v != null && v === best[col.key] && trayPals.length > 1;
        html += '<div class="ct-card-stat' + (isBest ? ' best' : '') + '"><span>' + col.label + '</span><span>' + (v == null ? '&mdash;' : v) + '</span></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  Promise.all([
    fetch('data/pals.json').then(r => r.json()),
    fetch('data/pals-detail.json').then(r => r.json()),
  ]).then(([p, detail]) => {
    pals = p.slice();
    detailBySlug = detail;
    renderTray();
    renderTable('');
    document.getElementById('compareSearch').addEventListener('input', e => renderTable(e.target.value));
  }).catch(err => {
    document.getElementById('compareTable').innerHTML = '<tbody><tr><td class="empty">Failed to load Pal data.</td></tr></tbody>';
    console.error(err);
  });
})();
