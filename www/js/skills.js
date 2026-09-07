(function () {
  const CATEGORIES = ['Active', 'Passive', 'Partner', 'Surgery'];
  let skills = [];
  let palIconByName = {};
  let currentTab = 'Active';
  let selectedSlug = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function basename(url) {
    if (!url) return null;
    return url.split('/').pop();
  }

  function thumbUrl(s) {
    if (s.category === 'Partner' && s.pal) {
      const slug = palIconByName[s.pal.name.toLowerCase()];
      return slug ? 'img/pals/' + slug + '.png' : null;
    }
    return s.iconUrl ? 'img/skills/' + basename(s.iconUrl) : null;
  }

  function renderTabs() {
    const el = document.getElementById('skillsTabs');
    el.innerHTML = CATEGORIES.map(c => {
      const count = skills.filter(s => s.category === c).length;
      return '<button class="skills-tab' + (c === currentTab ? ' active' : '') + '" data-cat="' + c + '">' + c + ' (' + count + ')</button>';
    }).join('');
    el.querySelectorAll('.skills-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.cat;
        selectedSlug = null;
        renderTabs();
        renderList('');
        document.getElementById('skillsDetail').innerHTML = '<div class="empty">Select a skill to see details.</div>';
      });
    });
  }

  function renderList(filter) {
    const listEl = document.getElementById('skillsList');
    const q = (filter || '').trim().toLowerCase();
    const rows = skills.filter(s => s.category === currentTab && (!q || s.name.toLowerCase().includes(q)));

    let html = '<input id="skillsSearch" class="search-input" type="text" placeholder="Search ' + currentTab.toLowerCase() + ' skills..." value="' + esc(filter || '') + '">';
    html += '<div class="list">';
    for (const s of rows) {
      const thumb = thumbUrl(s);
      const active = s.slug === selectedSlug ? ' active' : '';
      const sub = s.category === 'Partner' && s.pal ? s.pal.name : (s.tags && s.tags[0] || '');
      html += '<button class="list-row skill-row' + active + '" data-slug="' + esc(s.slug) + '">' +
        (thumb ? '<span class="skill-thumb" style="background-image:url(\'' + esc(thumb) + '\')"></span>' : '<span class="skill-thumb"></span>') +
        '<span class="skill-label">' + esc(s.name) + '<span class="skill-sub">' + esc(sub) + '</span></span>' +
        '</button>';
    }
    html += '</div>';
    listEl.innerHTML = html;

    const searchInput = document.getElementById('skillsSearch');
    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);

    listEl.querySelectorAll('.skill-row').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSlug = btn.dataset.slug;
        renderDetail(selectedSlug);
        listEl.querySelectorAll('.skill-row.active').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function statRow(label, value) {
    return '<div class="stat-row"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span></div>';
  }

  function renderDetail(slug) {
    const el = document.getElementById('skillsDetail');
    const s = skills.find(x => x.slug === slug);
    if (!s) { el.innerHTML = '<div class="empty">No data for this skill.</div>'; return; }

    const thumb = thumbUrl(s);
    let html = '<div class="skill-detail-header">';
    html += thumb ? '<img class="skill-detail-icon" src="' + esc(thumb) + '" alt="">' : '';
    html += '<div><h2>' + esc(s.name) + '</h2><div class="skill-detail-sub">' + esc(s.category) +
      (s.category === 'Partner' && s.pal ? ' &middot; ' + esc(s.pal.name) : '') + '</div></div>';
    html += '</div>';

    if (s.tags && s.tags.length) {
      html += '<div class="tag-row">' + s.tags.map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>';
    }

    if (s.description) html += '<p class="skill-desc">' + esc(s.description) + '</p>';

    const statKeys = Object.keys(s.stats || {});
    if (statKeys.length) {
      html += '<div class="stat-grid">';
      for (const k of statKeys) html += statRow(k, s.stats[k]);
      html += '</div>';
    }

    if (s.inflicts) html += '<p class="skill-inflicts">' + esc(s.inflicts) + '</p>';
    if (s.rating != null) html += '<p class="skill-rating">Rating ' + esc(s.rating) + '</p>';

    el.innerHTML = html;
  }

  Promise.all([
    fetch('data/skills.json').then(r => r.json()),
    fetch('data/pals.json').then(r => r.json()).catch(() => []),
  ]).then(([sk, pals]) => {
    skills = sk;
    for (const p of pals) palIconByName[p.name.toLowerCase()] = p.slug;
    renderTabs();
    renderList('');
  }).catch(err => {
    document.getElementById('skillsList').innerHTML = '<div class="empty">Failed to load skills data.</div>';
    console.error(err);
  });
})();
