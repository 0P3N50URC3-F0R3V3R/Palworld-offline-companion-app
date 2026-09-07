(function () {
  let roster = [];
  let detailBySlug = {};
  let selectedSlug = null;

  let itemIconByName = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function localItemIconUrl(name) {
    const slug = itemIconByName[(name || '').toLowerCase()];
    return slug ? 'img/items/' + slug + '.png' : null;
  }

  function topCategory(category) {
    if (!category) return 'Misc';
    return category.split('>')[0].trim();
  }

  function renderList(filter, categoryFilter) {
    const listEl = document.getElementById('structuresList');
    const q = (filter || '').trim().toLowerCase();
    const c = categoryFilter || '';
    const rows = roster.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!c || topCategory(r.category) === c));

    const categories = [...new Set(roster.map(r => topCategory(r.category)))].sort();
    let html = '<input id="structuresSearch" class="search-input" type="text" placeholder="Search structures..." value="' + esc(filter || '') + '">';
    html += '<select id="structuresCategoryFilter" class="search-input">';
    html += '<option value="">All categories (' + roster.length + ')</option>';
    for (const cat of categories) html += '<option value="' + esc(cat) + '"' + (cat === c ? ' selected' : '') + '>' + esc(cat) + '</option>';
    html += '</select>';
    html += '<div class="list">';
    for (const r of rows) {
      const active = r.slug === selectedSlug ? ' active' : '';
      html += '<button class="list-row structure-row' + active + '" data-slug="' + esc(r.slug) + '">' +
        '<span class="structure-thumb" style="background-image:url(\'img/structures/' + esc(r.slug) + '.png\')"></span>' +
        '<span class="structure-label">' + esc(r.name) + '<span class="structure-category">' + esc(r.category || '') + '</span></span>' +
        '</button>';
    }
    html += '</div>';
    listEl.innerHTML = html;

    const searchInput = document.getElementById('structuresSearch');
    searchInput.addEventListener('input', (e) => renderList(e.target.value, document.getElementById('structuresCategoryFilter').value));
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    document.getElementById('structuresCategoryFilter').addEventListener('change', (e) => renderList(document.getElementById('structuresSearch').value, e.target.value));

    listEl.querySelectorAll('.structure-row').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSlug = btn.dataset.slug;
        renderDetail(selectedSlug);
        listEl.querySelectorAll('.structure-row.active').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function statRow(label, value) {
    return '<div class="stat-row"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span></div>';
  }

  function renderDetail(slug) {
    const detailEl = document.getElementById('structuresDetail');
    const r = roster.find(x => x.slug === slug);
    const detail = detailBySlug[slug];
    if (!r) { detailEl.innerHTML = '<div class="empty">No data for this structure yet.</div>'; return; }

    let html = '<div class="structure-detail-header">';
    html += '<img class="structure-detail-icon" src="img/structures/' + esc(slug) + '.png" alt="">';
    html += '<div><h2>' + esc(r.name) + '</h2><div class="structure-detail-sub">' + esc(r.category || '') + '</div></div>';
    html += '</div>';

    const description = (detail && detail.description) || r.desc || '';
    if (description) html += '<p class="structure-desc">' + esc(description) + '</p>';

    const generalKeys = Object.keys((detail && detail.general) || {});
    if (generalKeys.length) {
      html += '<div class="section-title">General</div><div class="stat-grid">';
      for (const k of generalKeys) html += statRow(k, detail.general[k]);
      html += '</div>';
    } else if (r.stats && Object.keys(r.stats).length) {
      html += '<div class="section-title">General</div><div class="stat-grid">';
      for (const k of Object.keys(r.stats)) html += statRow(k, r.stats[k]);
      html += '</div>';
    }

    if (detail && detail.recipe && detail.recipe.length) {
      html += '<div class="section-title">Recipe</div><ul class="recipe-list">';
      for (const item of detail.recipe) {
        const icon = localItemIconUrl(item.name);
        html += '<li>' + (icon ? '<img class="recipe-icon" src="' + esc(icon) + '" alt="">' : '') +
          '<span>' + esc(item.name) + '</span><span class="recipe-qty">x' + esc(item.qty) + '</span></li>';
      }
      html += '</ul>';
    }

    detailEl.innerHTML = html;
  }

  Promise.all([
    fetch('data/structures.json').then(r => r.json()),
    fetch('data/structures-detail.json').then(r => r.json()).catch(() => ({})),
    fetch('data/items.json').then(r => r.json()).catch(() => []),
  ]).then(([r, d, items]) => {
    roster = r.slice().sort((a, b) => {
      const ca = topCategory(a.category), cb = topCategory(b.category);
      return ca !== cb ? ca.localeCompare(cb) : a.name.localeCompare(b.name);
    });
    detailBySlug = d;
    for (const it of items) itemIconByName[it.name.toLowerCase()] = it.slug;
    renderList('', '');
  }).catch(err => {
    document.getElementById('structuresList').innerHTML = '<div class="empty">Failed to load structure data.</div>';
    console.error(err);
  });
})();
