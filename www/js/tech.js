(function () {
  let tech = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render() {
    const el = document.getElementById('techTree');
    const q = (document.getElementById('techSearch').value || '').trim().toLowerCase();
    const type = document.getElementById('techTypeFilter').value;
    const partnerOnly = document.getElementById('techPartnerOnly').checked;
    const ancientOnly = document.getElementById('techAncientOnly').checked;

    const rows = tech.filter(t =>
      (!q || t.name.toLowerCase().includes(q)) &&
      (!type || t.category === type) &&
      (!partnerOnly || t.isPartnerSkill) &&
      (!ancientOnly || t.isAncientTech)
    );

    const levels = [...new Set(rows.map(t => t.level))].sort((a, b) => a - b);
    if (!levels.length) { el.innerHTML = '<div class="empty">' + I18N.t('tech.no_match') + '</div>'; return; }

    let html = '';
    for (const lvl of levels) {
      const nodes = rows.filter(t => t.level === lvl).sort((a, b) => a.name.localeCompare(b.name));
      html += '<div class="tech-level-group"><div class="tech-level-title">' + I18N.t('tech.level_prefix') + lvl + '</div><div class="tech-node-grid">';
      for (const n of nodes) {
        const flags = [];
        if (n.isPartnerSkill) flags.push(I18N.t('tech.partner_skill_label'));
        if (n.isAncientTech) flags.push(I18N.t('tech.ancient_tech_label'));
        html += '<div class="tech-node" title="' + esc(n.category) + '">' +
          '<div class="tech-node-icon-wrap">' +
          (n.localIcon ? '<div class="tech-node-icon" style="background-image:url(\'img/tech/' + esc(n.localIcon) + '\')"></div>' : '<div class="tech-node-icon"></div>') +
          '<span class="tech-node-cost">' + esc(n.cost) + '</span>' +
          '</div>' +
          '<div class="tech-node-name">' + esc(n.name) + '</div>' +
          (flags.length ? '<div class="tech-node-flags">' + flags.map(f => '<span class="tech-flag">' + esc(f) + '</span>').join('') + '</div>' : '') +
          '</div>';
      }
      html += '</div></div>';
    }
    el.innerHTML = html;
  }

  I18N.ready.then(() => fetch('data/tech.json')).then(r => r.json()).then((t) => {
    tech = t;
    render();
    ['techSearch', 'techTypeFilter', 'techPartnerOnly', 'techAncientOnly'].forEach(id => {
      document.getElementById(id).addEventListener('input', render);
      document.getElementById(id).addEventListener('change', render);
    });
  }).catch(err => {
    document.getElementById('techTree').innerHTML = '<div class="empty">' + I18N.t('encyc.failed_load_tech') + '</div>';
    console.error(err);
  });
})();
