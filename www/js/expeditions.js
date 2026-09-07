(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(expeditions) {
    const el = document.getElementById('expeditionsList');
    const categories = [...new Set(expeditions.map(e => e.category))];
    let html = '';
    for (const cat of categories) {
      html += '<div class="expedition-category-title">' + esc(cat) + '</div>';
      for (const e of expeditions.filter(x => x.category === cat)) {
        const diffClass = 'expedition-difficulty-' + (e.difficulty || '').replace(/\s+/g, '');
        html += '<div class="expedition-card">';
        html += '<div class="expedition-card-header">';
        html += '<div class="expedition-name">' + esc(e.name) + '</div>';
        html += '<div class="expedition-meta">' +
          '<span>' + esc(e.duration || '') + '</span>' +
          '<span class="' + diffClass + '">' + esc(e.difficulty || '') + '</span>' +
          '<span>FP ' + esc(e.firepower || '') + '</span>' +
          (e.element ? '<span class="expedition-element"><img src="img/skills/' + esc(e.element.name) + '.png" alt="' + esc(e.element.name) + '">x' + esc(e.element.amount) + '</span>' : '') +
          '</div></div>';
        if (e.unlockText) html += '<div class="expedition-unlock">' + esc(e.unlockText) + '</div>';
        html += '<div class="expedition-rewards"><div class="section-title">Rewards</div>';
        for (const r of e.rewards) {
          html += '<div class="reward-row">' +
            (r.iconUrl ? '<img class="reward-icon" src="img/expeditions/' + esc(r.iconUrl.split('/').pop()) + '" alt="">' : '<span class="reward-icon"></span>') +
            '<span class="reward-name">' + esc(r.itemName) + '</span>' +
            '<span class="reward-qty">Qt. ' + esc(r.qty) + '</span>' +
            '<span class="reward-pct">' + (r.dropPercent != null ? r.dropPercent + '%' : '') + '</span>' +
            '</div>';
        }
        html += '</div></div>';
      }
    }
    el.innerHTML = html;

    el.querySelectorAll('.expedition-card-header').forEach(header => {
      header.addEventListener('click', () => header.parentElement.classList.toggle('expanded'));
    });
  }

  fetch('data/expeditions.json').then(r => r.json()).then(render).catch(err => {
    document.getElementById('expeditionsList').innerHTML = '<div class="empty">Failed to load expeditions data.</div>';
    console.error(err);
  });
})();
