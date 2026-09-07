(function () {
  const ELEMENTS = ['neutral', 'fire', 'water', 'grass', 'electric', 'ice', 'ground', 'dark', 'dragon'];
  const LABEL = { neutral: 'Neutral', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric', ice: 'Ice', ground: 'Ground', dark: 'Dark', dragon: 'Dragon' };
  // Verified against Palworld community type charts (Dexerto/GameWith): each element's
  // super-effective (1.5x) targets. Same-element attacks are resisted (0.5x). Everything else 1x.
  const STRONG_AGAINST = {
    neutral: [],
    fire: ['grass', 'ice'],
    water: ['fire'],
    grass: ['ground'],
    electric: ['water'],
    ice: ['dragon'],
    ground: ['electric'],
    dark: ['neutral'],
    dragon: ['dark'],
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function multiplier(atk, def) {
    if (atk === def) return 0.5;
    if (STRONG_AGAINST[atk].includes(def)) return 1.5;
    return 1;
  }

  function renderGrid() {
    let html = '<table class="type-chart-table"><thead><tr><th class="tc-corner">Atk \\ Def</th>';
    for (const def of ELEMENTS) html += '<th>' + LABEL[def] + '</th>';
    html += '</tr></thead><tbody>';
    for (const atk of ELEMENTS) {
      html += '<tr><th>' + LABEL[atk] + '</th>';
      for (const def of ELEMENTS) {
        const m = multiplier(atk, def);
        const cls = m === 1.5 ? 'tc-strong' : m === 0.5 ? 'tc-weak' : 'tc-neutral';
        html += '<td class="' + cls + '" data-atk="' + atk + '" data-def="' + def + '">' + m + 'x</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('typeChartGrid').innerHTML = html;
  }

  function renderPalsFor(atk, def, pals) {
    const el = document.getElementById('typeChartPals');
    const atkPals = pals.filter(p => p.elements.includes(atk));
    const defPals = pals.filter(p => p.elements.includes(def));
    function palChip(p) {
      return '<div class="tc-pal-chip"><span class="tc-pal-thumb" style="background-image:url(\'img/pals/' + esc(p.slug) + '.png\')"></span>' +
        '<span>' + esc(p.name) + '</span></div>';
    }
    let html = '<div class="section-title">' + LABEL[atk] + ' attackers (' + atkPals.length + ')</div><div class="tc-pal-list">' + atkPals.map(palChip).join('') + '</div>';
    if (def !== atk) {
      html += '<div class="section-title">' + LABEL[def] + ' defenders (' + defPals.length + ')</div><div class="tc-pal-list">' + defPals.map(palChip).join('') + '</div>';
    }
    el.innerHTML = html;
  }

  fetch('data/pals.json').then(r => r.json()).then(pals => {
    renderGrid();
    document.querySelectorAll('#typeChartGrid td[data-atk]').forEach(td => {
      td.addEventListener('click', () => renderPalsFor(td.dataset.atk, td.dataset.def, pals));
    });
  }).catch(err => {
    renderGrid();
    console.error(err);
  });
})();
