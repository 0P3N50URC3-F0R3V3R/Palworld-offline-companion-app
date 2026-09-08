(function () {
  let roster = [];
  let detailBySlug = {};
  let selectedSlug = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function dexSortKey(dexId) {
    if (!dexId) return [Infinity, ''];
    const m = /^(\d+)(.*)$/.exec(dexId);
    return m ? [Number(m[1]), m[2]] : [Infinity, dexId];
  }

  function renderList(filter) {
    const listEl = document.getElementById('palsList');
    const q = (filter || '').trim().toLowerCase();
    const rows = roster.filter(p => !q || p.name.toLowerCase().includes(q));
    let html = '<input id="palsSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('encyc.search_pals_placeholder')) + '" value="' + esc(filter || '') + '">';
    html += '<div class="list">';
    for (const p of rows) {
      const active = p.slug === selectedSlug ? ' active' : '';
      html += '<button class="list-row pal-row' + active + '" data-slug="' + esc(p.slug) + '">' +
        '<span class="pal-thumb" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></span>' +
        '<span class="pal-label">' + esc(p.name) + '</span>' +
        '<span class="count">' + (p.dexId ? '#' + esc(p.dexId) : '') + '</span>' +
        '</button>';
    }
    html += '</div>';
    listEl.innerHTML = html;
    const searchInput = document.getElementById('palsSearch');
    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    listEl.querySelectorAll('.pal-row').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSlug = btn.dataset.slug;
        renderDetail(selectedSlug);
        listEl.querySelectorAll('.pal-row.active').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function statRow(label, value) {
    return '<div class="stat-row"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span></div>';
  }

  function renderDetail(slug) {
    const detailEl = document.getElementById('palsDetail');
    const pal = roster.find(p => p.slug === slug);
    const detail = detailBySlug[slug];
    if (!pal || !detail) { detailEl.innerHTML = '<div class="empty">' + I18N.t('encyc.no_pal_data') + '</div>'; return; }

    let html = '<div class="pal-detail-header">';
    html += '<img class="pal-detail-icon" src="img/pals/' + esc(slug) + '.png" alt="">';
    html += '<div><h2>' + esc(pal.name) + '</h2><div class="pal-detail-sub">' + (pal.dexId ? '#' + esc(pal.dexId) + ' &middot; ' : '') + pal.elements.map(esc).join(' / ') + '</div></div>';
    html += '</div>';

    if (detail.description) html += '<p class="pal-desc">' + esc(detail.description) + '</p>';

    html += '<div class="section-title">' + I18N.t('encyc.stats_title') + '</div><div class="stat-grid">';
    for (const k of Object.keys(detail.stats)) html += statRow(k, detail.stats[k]);
    html += '</div>';

    if (Object.keys(detail.movement).length) {
      html += '<div class="section-title">' + I18N.t('encyc.movement_title') + '</div><div class="stat-grid">';
      for (const k of Object.keys(detail.movement)) html += statRow(k, detail.movement[k]);
      html += '</div>';
    }

    if (Object.keys(pal.work).length) {
      html += '<div class="section-title">' + I18N.t('encyc.work_suitability_title') + '</div><div class="work-row">';
      for (const k of Object.keys(pal.work)) {
        html += '<div class="work-item"><img src="img/pals/work/' + esc(k) + '.png" alt="' + esc(k) + '"><span>' + esc(pal.work[k]) + '</span></div>';
      }
      html += '</div>';
    }

    if (detail.drops && detail.drops.length) {
      html += '<div class="section-title">' + I18N.t('encyc.drops_title') + '</div><ul class="drop-list">';
      for (const d of detail.drops) html += '<li>' + esc(d.item) + ' <span class="drop-detail">' + d.detail.map(esc).join(' ') + '</span></li>';
      html += '</ul>';
    }

    if (detail.partnerSkill) {
      html += '<div class="section-title">' + I18N.t('encyc.partner_skill_prefix') + esc(detail.partnerSkill.name) + '</div>';
      html += '<p class="pal-desc">' + esc(detail.partnerSkill.description) + '</p>';
    }

    if (detail.passiveSkills && detail.passiveSkills.length) {
      html += '<div class="section-title">' + I18N.t('encyc.passive_skills_title') + '</div><ul class="skill-list">';
      for (const s of detail.passiveSkills) html += '<li><b>' + esc(s.name) + '</b> &mdash; ' + esc(s.description) + '</li>';
      html += '</ul>';
    }

    if (detail.activeSkills && detail.activeSkills.length) {
      html += '<div class="section-title">' + I18N.t('encyc.active_skills_title') + '</div><div class="active-skill-list">';
      for (const s of detail.activeSkills) {
        html += '<div class="active-skill">';
        html += '<div class="active-skill-head"><span class="lv">' + I18N.t('encyc.skill_level_prefix') + esc(s.level) + '</span><b>' + esc(s.name) + '</b>' + s.tags.map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>';
        html += '<div class="active-skill-stats">' + I18N.t('encyc.pwr_label') + ' ' + esc(s.pwr) + ' &middot; ' + I18N.t('encyc.rng_label') + ' ' + esc(s.rng) + ' &middot; ' + I18N.t('encyc.cld_label') + ' ' + esc(s.cld) + '</div>';
        if (s.inflicts) html += '<div class="active-skill-inflicts">' + esc(s.inflicts) + '</div>';
        html += '<div class="active-skill-desc">' + esc(s.description) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (detail.relatedPals && detail.relatedPals.length) {
      html += '<div class="section-title">' + I18N.t('encyc.related_pals_title') + '</div><div class="related-pals">' + detail.relatedPals.map(esc).join(', ') + '</div>';
    }

    detailEl.innerHTML = html;
  }

  I18N.ready.then(() => Promise.all([
    fetch('data/pals.json').then(r => r.json()),
    fetch('data/pals-detail.json').then(r => r.json()),
  ])).then(([r, d]) => {
    roster = r.slice().sort((a, b) => {
      const [an, as] = dexSortKey(a.dexId);
      const [bn, bs] = dexSortKey(b.dexId);
      return an !== bn ? an - bn : as.localeCompare(bs);
    });
    detailBySlug = d;
    renderList('');
  }).catch(err => {
    document.getElementById('palsList').innerHTML = '<div class="empty">' + I18N.t('encyc.failed_load_pal') + '</div>';
    console.error(err);
  });
})();
