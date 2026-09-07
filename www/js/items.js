(function () {
  let roster = [];
  let detailBySlug = {};
  let selectedSlug = null;
  let iconByName = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function topType(type) {
    if (!type) return 'Misc';
    return type.split('>')[0].trim();
  }

  function renderList(filter, typeFilter) {
    const listEl = document.getElementById('itemsList');
    const q = (filter || '').trim().toLowerCase();
    const t = typeFilter || '';
    const rows = roster.filter(it => (!q || it.name.toLowerCase().includes(q)) && (!t || topType(it.type) === t));

    const types = [...new Set(roster.map(it => topType(it.type)))].sort();
    let html = '<input id="itemsSearch" class="search-input" type="text" placeholder="Search items..." value="' + esc(filter || '') + '">';
    html += '<select id="itemsTypeFilter" class="search-input">';
    html += '<option value="">All types (' + roster.length + ')</option>';
    for (const type of types) html += '<option value="' + esc(type) + '"' + (type === t ? ' selected' : '') + '>' + esc(type) + '</option>';
    html += '</select>';
    html += '<div class="list">';
    for (const it of rows) {
      const active = it.slug === selectedSlug ? ' active' : '';
      html += '<button class="list-row item-row' + active + '" data-slug="' + esc(it.slug) + '">' +
        '<span class="item-thumb" style="background-image:url(\'img/items/' + esc(it.slug) + '.png\')"></span>' +
        '<span class="item-label">' + esc(it.name) + '<span class="item-type">' + esc(it.type || '') + '</span></span>' +
        '<span class="count rarity-' + esc(it.rarity || '') + '">' + esc(it.rarity || '') + '</span>' +
        '</button>';
    }
    html += '</div>';
    listEl.innerHTML = html;

    const searchInput = document.getElementById('itemsSearch');
    searchInput.addEventListener('input', (e) => renderList(e.target.value, document.getElementById('itemsTypeFilter').value));
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    document.getElementById('itemsTypeFilter').addEventListener('change', (e) => renderList(document.getElementById('itemsSearch').value, e.target.value));

    listEl.querySelectorAll('.item-row').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSlug = btn.dataset.slug;
        renderDetail(selectedSlug);
        listEl.querySelectorAll('.item-row.active').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function statRow(label, value) {
    return '<div class="stat-row"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span></div>';
  }

  function localIconUrl(name) {
    const slug = iconByName[(name || '').toLowerCase()];
    return slug ? 'img/items/' + slug + '.png' : null;
  }

  function linkRowsHtml(rows) {
    let html = '<ul class="link-list">';
    for (const r of rows) {
      html += '<li>' + esc(r.name) + (r.note ? ' <span class="link-note">' + esc(r.note) + '</span>' : '') + '</li>';
    }
    html += '</ul>';
    return html;
  }

  function renderDetail(slug) {
    const detailEl = document.getElementById('itemsDetail');
    const it = roster.find(r => r.slug === slug);
    const detail = detailBySlug[slug];
    if (!it || !detail) { detailEl.innerHTML = '<div class="empty">No data for this item yet.</div>'; return; }

    let html = '<div class="item-detail-header">';
    html += '<img class="item-detail-icon" src="img/items/' + esc(slug) + '.png" alt="">';
    html += '<div><h2>' + esc(it.name) + '</h2><div class="item-detail-sub">' + esc(detail.breadcrumb || it.type || '') +
      (it.rarity ? ' &middot; <span class="rarity-' + esc(it.rarity) + '">' + esc(it.rarity) + '</span>' : '') + '</div></div>';
    html += '</div>';

    if (detail.description) html += '<p class="item-desc">' + esc(detail.description) + '</p>';
    if (detail.unlockedBy) html += '<p class="item-unlock">Unlocked by ' + esc(detail.unlockedBy) + '</p>';

    const generalKeys = Object.keys(detail.general || {});
    if (generalKeys.length) {
      html += '<div class="section-title">General</div><div class="stat-grid">';
      for (const k of generalKeys) html += statRow(k, detail.general[k]);
      html += '</div>';
    }

    const combatKeys = Object.keys(detail.combatStats || {});
    if (combatKeys.length) {
      html += '<div class="section-title">Combat Stats</div><div class="stat-grid">';
      for (const k of combatKeys) html += statRow(k, detail.combatStats[k]);
      html += '</div>';
    }

    if (detail.recipe && detail.recipe.length) {
      html += '<div class="section-title">Recipe</div><ul class="recipe-list">';
      for (const r of detail.recipe) {
        const icon = localIconUrl(r.item);
        html += '<li>' + (icon ? '<img class="recipe-icon" src="' + esc(icon) + '" alt="">' : '') +
          '<span>' + esc(r.item) + '</span><span class="recipe-qty">x' + esc(r.qty) + '</span></li>';
      }
      html += '</ul>';
    }

    if (detail.craftedAt && detail.craftedAt.length) {
      html += '<div class="section-title">Where to craft</div>' + linkRowsHtml(detail.craftedAt);
    }

    if (detail.source && detail.source.length) {
      html += '<div class="section-title">Source</div>' + linkRowsHtml(detail.source);
    }

    if (detail.passiveSkills && detail.passiveSkills.length) {
      html += '<div class="section-title">Passive Skills</div><ul class="skill-list">';
      for (const s of detail.passiveSkills) {
        const stats = (s.stats || []).map(st => esc(st.stat) + ' ' + esc(st.value)).join(', ');
        html += '<li><b>' + esc(s.name) + '</b>' + (s.category ? ' <span class="tag">' + esc(s.category) + '</span>' : '') +
          (stats ? ' &mdash; ' + stats : '') + '</li>';
      }
      html += '</ul>';
    }

    if (detail.related && detail.related.length) {
      html += '<div class="section-title">Related</div><ul class="drop-list">';
      for (const r of detail.related) html += '<li>' + esc(r.name) + '</li>';
      html += '</ul>';
    }

    detailEl.innerHTML = html;
  }

  Promise.all([
    fetch('data/items.json').then(r => r.json()),
    fetch('data/items-detail.json').then(r => r.json()),
  ]).then(([r, d]) => {
    roster = r.slice().sort((a, b) => {
      const ta = topType(a.type), tb = topType(b.type);
      return ta !== tb ? ta.localeCompare(tb) : a.name.localeCompare(b.name);
    });
    detailBySlug = d;
    for (const it of roster) iconByName[it.name.toLowerCase()] = it.slug;
    renderList('', '');
  }).catch(err => {
    document.getElementById('itemsList').innerHTML = '<div class="empty">Failed to load item data.</div>';
    console.error(err);
  });
})();
