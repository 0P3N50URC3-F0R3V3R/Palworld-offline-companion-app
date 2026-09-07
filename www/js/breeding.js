(function () {
  let pals = [];
  let palByName = {};
  let combiRankBySlug = {};
  let uniqueCombos = [];
  let parentA = null;
  let parentB = null;
  let targetChild = null;
  let childParentsIndex = new Map();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pairKey(slugX, slugY) {
    return [slugX, slugY].sort().join('|');
  }

  function renderPalList(containerId, searchId, side) {
    const listEl = document.getElementById(containerId);
    const q = (document.getElementById(searchId).value || '').trim().toLowerCase();
    const rows = pals.filter(p => !q || p.name.toLowerCase().includes(q));
    const selected = side === 'A' ? parentA : side === 'B' ? parentB : targetChild;
    let html = '';
    for (const p of rows) {
      const active = selected && selected.slug === p.slug ? ' active' : '';
      html += '<button class="breed-pal-row' + active + '" data-slug="' + esc(p.slug) + '">' +
        '<span class="breed-pal-thumb" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></span>' +
        '<span>' + esc(p.name) + '</span></button>';
    }
    listEl.innerHTML = html;
    listEl.querySelectorAll('.breed-pal-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const pal = palByName[pals.find(p => p.slug === btn.dataset.slug).name.toLowerCase()];
        if (side === 'A') parentA = pal;
        else if (side === 'B') parentB = pal;
        else targetChild = pal;
        listEl.querySelectorAll('.breed-pal-row.active').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        if (side === 'C') renderParentsResult(); else renderResult();
      });
    });
  }

  function buildChildParentsIndex() {
    const idx = new Map();
    const uniqueByPair = new Map();
    for (const c of uniqueCombos) {
      const a = palByName[c.parentA.toLowerCase()];
      const b = palByName[c.parentB.toLowerCase()];
      const child = palByName[c.child.toLowerCase()];
      if (!a || !b || !child) continue;
      uniqueByPair.set(pairKey(a.slug, b.slug), true);
      if (!idx.has(child.slug)) idx.set(child.slug, []);
      idx.get(child.slug).push({ a, b, type: 'unique' });
    }
    for (let i = 0; i < pals.length; i++) {
      const a = pals[i];
      const rankA = combiRankBySlug[a.slug];
      if (rankA == null) continue;
      for (let j = i; j < pals.length; j++) {
        const b = pals[j];
        if (uniqueByPair.has(pairKey(a.slug, b.slug))) continue;
        const rankB = combiRankBySlug[b.slug];
        if (rankB == null) continue;
        const child = computeFormulaChild(rankA, rankB);
        if (!child) continue;
        if (!idx.has(child.slug)) idx.set(child.slug, []);
        idx.get(child.slug).push({ a, b, type: 'formula' });
      }
    }
    return idx;
  }

  function renderParentsResult() {
    const el = document.getElementById('parentsResult');
    if (!targetChild) { el.innerHTML = ''; return; }
    const list = (childParentsIndex.get(targetChild.slug) || []).slice().sort((x, y) => {
      if (x.type !== y.type) return x.type === 'unique' ? -1 : 1;
      return x.a.name.localeCompare(y.a.name) || x.b.name.localeCompare(y.b.name);
    });
    if (!list.length) {
      el.innerHTML = '<div class="empty">No known parent combo produces ' + esc(targetChild.name) + '.</div>';
      return;
    }
    function pairIcon(p) {
      return '<div class="parents-result-icon" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></div>' +
        '<div class="parents-result-name">' + esc(p.name) + '</div>';
    }
    let html = '<div class="section-title">' + list.length + ' parent combo' + (list.length === 1 ? '' : 's') + ' for ' + esc(targetChild.name) + '</div>';
    html += '<div class="parents-result-list">';
    for (const combo of list) {
      html += '<div class="parents-result-row">' +
        '<div class="parents-result-pair">' + pairIcon(combo.a) + '<span class="parents-result-plus">+</span>' + pairIcon(combo.b) + '</div>' +
        '<div class="parents-result-tag' + (combo.type === 'unique' ? ' unique' : '') + '">' + (combo.type === 'unique' ? 'Unique combo' : 'Combi Rank formula') + '</div>' +
        '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function findUniqueCombo(nameA, nameB) {
    return uniqueCombos.find(c =>
      (c.parentA.toLowerCase() === nameA.toLowerCase() && c.parentB.toLowerCase() === nameB.toLowerCase()) ||
      (c.parentA.toLowerCase() === nameB.toLowerCase() && c.parentB.toLowerCase() === nameA.toLowerCase())
    );
  }

  // Palworld's real rule: target = floor((rankA + rankB + 1) / 2) (round-half-up), then
  // child = the pal whose Combi Rank is closest to target; ties broken toward the HIGHER rank.
  // Unique Combos above override this.
  function computeFormulaChild(rankA, rankB) {
    const target = Math.floor((rankA + rankB + 1) / 2);
    let best = null, bestDiff = Infinity;
    for (const p of pals) {
      const rank = combiRankBySlug[p.slug];
      if (rank == null) continue;
      const diff = Math.abs(rank - target);
      if (diff < bestDiff || (diff === bestDiff && rank > combiRankBySlug[best.slug])) {
        best = p; bestDiff = diff;
      }
    }
    return best;
  }

  function renderResult() {
    const el = document.getElementById('breedResult');
    if (!parentA || !parentB) { el.innerHTML = '<div class="empty">Pick two pals to see their offspring.</div>'; return; }

    const unique = findUniqueCombo(parentA.name, parentB.name);
    let child, note;
    if (unique) {
      child = palByName[unique.child.toLowerCase()] || null;
      note = 'Unique breeding combo (overrides the standard Combi Rank formula).';
    } else {
      const rankA = combiRankBySlug[parentA.slug];
      const rankB = combiRankBySlug[parentB.slug];
      if (rankA == null || rankB == null) {
        el.innerHTML = '<div class="empty">Missing Combi Rank data for one of these pals.</div>';
        return;
      }
      child = computeFormulaChild(rankA, rankB);
      note = 'Computed from average Combi Rank (parents: ' + rankA + ' + ' + rankB + ').';
    }

    if (!child) { el.innerHTML = '<div class="empty">Could not determine offspring.</div>'; return; }

    function palBlock(p, cls) {
      return '<div class="breed-result-pal' + (cls ? ' ' + cls : '') + '">' +
        '<div class="breed-result-icon" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></div>' +
        '<div class="breed-result-name">' + esc(p.name) + '</div></div>';
    }

    let html = '<div class="breed-result-row">';
    html += palBlock(parentA);
    html += '<div class="breed-result-op">+</div>';
    html += palBlock(parentB);
    html += '<div class="breed-result-op">=</div>';
    html += palBlock(child, 'breed-result-child');
    html += '</div>';
    html += '<div class="breed-result-note">' + esc(note) + '</div>';
    el.innerHTML = html;
  }

  Promise.all([
    fetch('data/pals.json').then(r => r.json()),
    fetch('data/pals-detail.json').then(r => r.json()),
    fetch('data/breeding-unique-combos.json').then(r => r.json()),
  ]).then(([p, detail, combos]) => {
    pals = p.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const pal of pals) palByName[pal.name.toLowerCase()] = pal;
    for (const slug of Object.keys(detail)) {
      const rank = Number(detail[slug].stats && detail[slug].stats['Combi rank']);
      if (!isNaN(rank)) combiRankBySlug[slug] = rank;
    }
    uniqueCombos = combos;
    childParentsIndex = buildChildParentsIndex();

    renderPalList('parentAList', 'parentASearch', 'A');
    renderPalList('parentBList', 'parentBSearch', 'B');
    renderPalList('childList', 'childSearch', 'C');
    document.getElementById('parentASearch').addEventListener('input', () => renderPalList('parentAList', 'parentASearch', 'A'));
    document.getElementById('parentBSearch').addEventListener('input', () => renderPalList('parentBList', 'parentBSearch', 'B'));
    document.getElementById('childSearch').addEventListener('input', () => renderPalList('childList', 'childSearch', 'C'));
  }).catch(err => {
    document.getElementById('breedResult').innerHTML = '<div class="empty">Failed to load breeding data.</div>';
    console.error(err);
  });
})();
