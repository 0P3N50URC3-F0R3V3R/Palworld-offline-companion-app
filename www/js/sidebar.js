(function () {
  const root = document.getElementById('sidebar-content');
  let viewStack = ['main'];
  let viewParams = {};
  let lastServerDetailSignature = null;
  let editorDragCleanup = null;
  let brushActiveInThisView = false;

  function push(view, params) { viewStack.push(view); viewParams = params || {}; render(); }
  function popView() {
    const leaving = viewStack[viewStack.length - 1];
    if (leaving === 'editorMarkerDetail' && editorDragCleanup) { editorDragCleanup(); editorDragCleanup = null; }
    if (leaving === 'editorHeatmapDetail' && brushActiveInThisView) { window.App.stopBrush(); brushActiveInThisView = false; }
    viewStack.pop();
    render();
  }
  function esc(s) { return window.App ? window.App.esc(s) : s; }

  function header(title, showBack) {
    let html = '<div class="panel-header">';
    if (showBack) html += '<button class="back-btn" id="backBtn">&larr;</button>';
    html += '<div class="panel-title">' + esc(title) + '</div></div>';
    return html;
  }

  function wireBack() {
    const back = document.getElementById('backBtn');
    if (back) back.addEventListener('click', popView);
  }

  function render() {
    const App = window.App;
    const view = viewStack[viewStack.length - 1];
    if (view === 'main') renderMain();
    else if (view === 'regions') renderRegions();
    else if (view === 'heatmap') renderHeatmap();
    else if (view === 'notes') renderNotes();
    else if (view === 'markers') renderMarkers();
    else if (view === 'checklists') renderChecklists();
    else if (view === 'checklistDetail') renderChecklistDetail(viewParams.checklistId);
    else if (view === 'servers') renderServers();
    else if (view === 'serverDetail') renderServerDetail(viewParams.serverId);
    else if (view === 'calibration') renderCalibration();
    else if (view === 'editor') renderEditorMenu();
    else if (view === 'editorMarkers') renderEditorMarkers();
    else if (view === 'editorMarkerDetail') renderEditorMarkerDetail(viewParams.markerId);
    else if (view === 'editorHeatmap') renderEditorHeatmap();
    else if (view === 'editorHeatmapDetail') renderEditorHeatmapDetail(viewParams.categoryId);
  }

  // ---------------- main ----------------
  function renderMain() {
    const App = window.App;
    const completedCount = App.completedTaskIds.size;
    const totalWithTask = App.markers.filter(m => m.checklistTaskId).length;
    const incompleteCount = totalWithTask - completedCount;

    let html = '';
    html += '<div class="brand"><img class="brand-icon" src="app-icon.ico" alt=""><div class="brand-text"><div class="title">' + I18N.t('main.brand_title') + '</div><div class="sub">' + I18N.t('main.brand_sub') + '</div></div></div>';
    html += '<input id="mainSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('main.search_markers_placeholder')) + '">';
    html += '<div id="mainSearchResults" class="search-results"></div>';

    html += '<div class="nav-list">';
    html += navRow(I18N.t('nav.regions'), App.regions.length, 'regions');
    html += navRow(I18N.t('nav.heatmap'), App.heatmapData.categories.length, 'heatmap');
    html += navRow(I18N.t('nav.my_notes'), App.state.notes.length, 'notes');
    html += navRow(I18N.t('nav.my_markers'), App.state.customMarkers.length, 'markers');
    html += navRow(I18N.t('nav.my_checklists'), App.checklistData.checklists.length, 'checklists');
    html += navRow(I18N.t('nav.servers'), countOnlinePlayers(), 'servers');
    html += navRow(I18N.t('nav.editor'), '', 'editor');
    html += '</div>';

    const encCollapsed = !!App.state.encyclopediaCollapsed;
    html += '<div class="section-title collapsible-title' + (encCollapsed ? ' collapsed' : '') + '" id="encyclopediaToggle">' + I18N.t('nav.encyclopedia') + '<span class="collapse-caret">&#9662;</span></div>';
    if (!encCollapsed) {
      html += '<div class="nav-list">';
      html += navLink(I18N.t('nav.pals'), 'pals.html');
      html += navLink(I18N.t('nav.items'), 'items.html');
      html += navLink(I18N.t('nav.structures'), 'structures.html');
      html += navLink(I18N.t('nav.breeding'), 'breeding.html');
      html += navLink(I18N.t('nav.skills'), 'skills.html');
      html += navLink(I18N.t('nav.tech'), 'tech.html');
      html += navLink(I18N.t('nav.expeditions'), 'expeditions.html');
      html += navLink(I18N.t('nav.type_chart'), 'type-chart.html');
      html += navLink(I18N.t('nav.compare'), 'compare.html');
      html += '</div>';
    }

    html += '<label class="check-row"><input type="checkbox" id="showRegionBorders"' + (App.state.showRegionBorders ? ' checked' : '') + '> ' + I18N.t('common.show_region_borders') + '</label>';

    html += '<div class="section-block">';
    html += '<div class="section-title">' + I18N.t('main.all_markers') + '</div>';
    html += '<div class="complete-row">';
    html += '<div class="complete-pill">' + I18N.t('main.complete') + ' <b>' + completedCount + '</b></div>';
    html += '<div class="complete-pill">' + I18N.t('main.incomplete') + ' <b>' + incompleteCount + '</b></div>';
    html += '</div>';
    html += '<label class="check-row"><input type="checkbox" id="hideCompleted"' + (App.state.hideCompletedMarkers ? ' checked' : '') + '> ' + I18N.t('main.hide_completed') + '</label>';
    html += '</div>';

    html += '<div class="section-block"><div class="section-title">' + I18N.t('main.locations') + '</div><div id="categories"></div></div>';
    html += '<div class="footer"><button id="showAll">' + I18N.t('main.show_all') + '</button><button id="hideAll">' + I18N.t('main.hide_all') + '</button></div>';

    root.innerHTML = html;
    wireBack();
    buildCategoryTree();
    wireMainSearch();

    document.getElementById('encyclopediaToggle').addEventListener('click', () => {
      App.setEncyclopediaCollapsed(!App.state.encyclopediaCollapsed);
      renderMain();
    });
    document.getElementById('showRegionBorders').addEventListener('change', (e) => App.setShowRegionBorders(e.target.checked));
    document.getElementById('hideCompleted').addEventListener('change', (e) => App.setHideCompleted(e.target.checked));
    document.getElementById('showAll').addEventListener('click', () => {
      document.querySelectorAll('.category-item input[type=checkbox]').forEach(cb => { cb.checked = true; App.setCategoryHidden(cb.dataset.slug, false); });
    });
    document.getElementById('hideAll').addEventListener('click', () => {
      document.querySelectorAll('.category-item input[type=checkbox]').forEach(cb => { cb.checked = false; App.setCategoryHidden(cb.dataset.slug, true); });
    });
  }

  function navRow(label, count, view) {
    return '<button class="nav-row" data-view="' + view + '"><span>' + esc(label) + '</span><span class="nav-count">' + count + '</span><span class="chev">&rsaquo;</span></button>';
  }

  function navLink(label, href) {
    return '<a class="nav-row" href="' + href + '"><span>' + esc(label) + '</span><span class="chev">&rsaquo;</span></a>';
  }

  function buildCategoryTree() {
    const App = window.App;
    const parents = App.types.filter(t => t.parentTypeSlug === null);
    const categoriesEl = document.getElementById('categories');
    for (const parent of parents) {
      const children = App.types.filter(t => t.parentTypeSlug === parent.typeSlug && t.icon);
      if (!children.length) continue;
      const group = document.createElement('div');
      group.className = 'category-group';
      const headerEl = document.createElement('div');
      headerEl.className = 'category-header';
      const parentCb = document.createElement('input');
      parentCb.type = 'checkbox';
      parentCb.className = 'category-parent-cb';
      const childCbs = [];
      function syncParentCb() {
        const checkedCount = childCbs.filter(cb => cb.checked).length;
        parentCb.checked = checkedCount === childCbs.length;
        parentCb.indeterminate = checkedCount > 0 && checkedCount < childCbs.length;
      }
      parentCb.addEventListener('click', (e) => e.stopPropagation());
      parentCb.addEventListener('change', () => {
        for (const t of children) App.setCategoryHidden(t.typeSlug, !parentCb.checked);
        for (const cb of childCbs) cb.checked = parentCb.checked;
        parentCb.indeterminate = false;
      });
      const titleSpan = document.createElement('span');
      titleSpan.textContent = parent.typeName;
      const countSpan = document.createElement('span');
      countSpan.className = 'count';
      countSpan.textContent = children.reduce((s, c) => s + (c.markerCount || 0), 0);
      headerEl.append(parentCb, titleSpan, countSpan);
      group.appendChild(headerEl);
      const childrenEl = document.createElement('div');
      childrenEl.className = 'category-children';
      childrenEl.style.display = 'none';
      headerEl.addEventListener('click', () => { childrenEl.style.display = childrenEl.style.display === 'none' ? 'block' : 'none'; });
      for (const t of children) {
        const item = document.createElement('label');
        item.className = 'category-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !App.hiddenTypeSlugs.has(t.typeSlug);
        cb.dataset.slug = t.typeSlug;
        cb.addEventListener('change', () => { App.setCategoryHidden(t.typeSlug, !cb.checked); syncParentCb(); });
        childCbs.push(cb);
        const swatch = document.createElement('span');
        swatch.className = 'swatch mk-' + t.typeSlug;
        const label = document.createElement('span');
        label.textContent = t.typeName;
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = t.markerCount;
        item.append(cb, swatch, label, count);
        childrenEl.appendChild(item);
      }
      syncParentCb();
      group.appendChild(childrenEl);
      categoriesEl.appendChild(group);
    }
    root.querySelectorAll('.nav-row[data-view]').forEach(btn => btn.addEventListener('click', () => push(btn.dataset.view)));
  }

  function wireMainSearch() {
    const App = window.App;
    const input = document.getElementById('mainSearch');
    const resultsEl = document.getElementById('mainSearchResults');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      resultsEl.innerHTML = '';
      if (q.length < 2) return;
      const matches = App.markers.filter(m => m.name && m.name.toLowerCase().includes(q)).slice(0, 40);
      for (const m of matches) {
        const t = App.typeBySlug[m.typeSlug];
        const region = App.regionById[m.regionId];
        const div = document.createElement('div');
        div.className = 'result-row';
        div.innerHTML = '<div>' + esc(m.name) + (t ? ' (' + esc(t.typeName) + ')' : '') + '</div>' +
          '<div class="result-row-sub">' + (region ? esc(region.title) : I18N.t('sidebar.unknown_region')) +
          ' &middot; ' + Math.round(m.lat) + ', ' + Math.round(m.lng) + '</div>';
        div.addEventListener('click', () => App.panToMarker(m));
        resultsEl.appendChild(div);
      }
    });
  }

  // ---------------- regions ----------------
  function renderRegions() {
    const App = window.App;
    let html = header(I18N.t('nav.regions'), true);
    html += '<input id="regionSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('sidebar.search_regions_placeholder')) + '">';
    html += '<div class="list" id="regionList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('regionList');
    function draw(filter) {
      listEl.innerHTML = '';
      const q = (filter || '').toLowerCase();
      for (const r of App.regions) {
        if (q && !r.title.toLowerCase().includes(q)) continue;
        const row = document.createElement('button');
        row.className = 'list-row';
        row.textContent = r.title;
        row.addEventListener('click', () => App.fitRegion(r.id));
        listEl.appendChild(row);
      }
    }
    draw('');
    document.getElementById('regionSearch').addEventListener('input', (e) => draw(e.target.value));
  }

  // ---------------- pals heatmap ----------------
  function renderHeatmap() {
    const App = window.App;
    const activeId = App.getHeatmapActiveId();
    let html = header(I18N.t('nav.heatmap'), true);
    html += '<input id="heatmapSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('encyc.search_pals_placeholder')) + '">';
    if (activeId != null) html += '<button class="clear-btn" id="clearHeatmap">' + I18N.t('sidebar.clear_heatmap') + '</button>';
    html += '<div class="list" id="heatmapList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('heatmapList');
    const cats = [...App.heatmapData.categories].sort((a, b) => a.title.localeCompare(b.title));
    function draw(filter) {
      listEl.innerHTML = '';
      const q = (filter || '').toLowerCase();
      for (const c of cats) {
        if (q && !c.title.toLowerCase().includes(q)) continue;
        const row = document.createElement('button');
        row.className = 'list-row pal-row' + (activeId === c.id ? ' active' : '');
        const iconUrl = App.palIcons[c.title];
        const thumb = document.createElement('span');
        thumb.className = 'pal-thumb';
        if (iconUrl) thumb.style.backgroundImage = "url('" + iconUrl + "')";
        else thumb.textContent = c.title.charAt(0);
        const label = document.createElement('span');
        label.className = 'pal-label';
        label.textContent = c.title + ' (' + c.points.length + ')';
        row.append(thumb, label);
        row.addEventListener('click', () => {
          App.setHeatmapCategory(c.id);
          renderHeatmap();
        });
        listEl.appendChild(row);
      }
    }
    draw('');
    document.getElementById('heatmapSearch').addEventListener('input', (e) => draw(e.target.value));
    const clearBtn = document.getElementById('clearHeatmap');
    if (clearBtn) clearBtn.addEventListener('click', () => { App.setHeatmapCategory(null); renderHeatmap(); });
  }

  // ---------------- my notes ----------------
  function renderNotes() {
    const App = window.App;
    const placing = App.getPlacementMode() === 'note';
    let html = header(I18N.t('nav.my_notes'), true);
    html += '<button class="add-btn' + (placing ? ' active' : '') + '" id="addNoteBtn">' + (placing ? I18N.t('sidebar.click_to_place') : I18N.t('sidebar.add_note_button')) + '</button>';
    html += '<div class="list" id="notesList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('notesList');
    if (!App.state.notes.length) listEl.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_notes_yet') + '</div>';
    for (const n of App.state.notes) {
      const row = document.createElement('div');
      row.className = 'list-row-item';
      const btn = document.createElement('button');
      btn.className = 'list-row';
      btn.textContent = n.title;
      btn.addEventListener('click', () => App.panToMarker({ id: n.id, lat: n.lat, lng: n.lng }, 15));
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.addEventListener('click', () => { App.deleteNote(n.id); renderNotes(); });
      row.append(btn, del);
      listEl.appendChild(row);
    }
    document.getElementById('addNoteBtn').addEventListener('click', () => {
      App.setPlacementMode(placing ? null : 'note');
    });
  }

  // ---------------- my markers ----------------
  function renderMarkers() {
    const App = window.App;
    const placing = App.getPlacementMode() === 'marker';
    let html = header(I18N.t('nav.my_markers'), true);
    html += '<button class="add-btn' + (placing ? ' active' : '') + '" id="addMarkerBtn">' + (placing ? I18N.t('sidebar.click_to_place') : I18N.t('sidebar.add_marker_button')) + '</button>';
    html += '<div class="list" id="markersList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('markersList');
    if (!App.state.customMarkers.length) listEl.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_markers_yet') + '</div>';
    for (const cm of App.state.customMarkers) {
      const row = document.createElement('div');
      row.className = 'list-row-item';
      const btn = document.createElement('button');
      btn.className = 'list-row';
      btn.textContent = cm.name;
      btn.addEventListener('click', () => App.panToMarker({ id: cm.id, lat: cm.lat, lng: cm.lng }, 15));
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.addEventListener('click', () => { App.deleteCustomMarker(cm.id); renderMarkers(); });
      row.append(btn, del);
      listEl.appendChild(row);
    }
    document.getElementById('addMarkerBtn').addEventListener('click', () => {
      App.setPlacementMode(placing ? null : 'marker');
    });
  }

  // ---------------- checklists ----------------
  function checklistProgress(cl) {
    const App = window.App;
    const done = cl.checklistTaskIds.filter(id => App.completedTaskIds.has(id)).length;
    return { done, total: cl.checklistTaskIds.length };
  }

  function renderChecklists() {
    const App = window.App;
    let html = header(I18N.t('nav.my_checklists'), true);
    html += '<div class="list" id="checklistsList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('checklistsList');
    const byCategory = {};
    for (const cl of App.checklistData.checklists) {
      (byCategory[cl.categoryId] = byCategory[cl.categoryId] || []).push(cl);
    }
    for (const cat of App.checklistData.categories) {
      const cls = byCategory[cat.id];
      if (!cls) continue;
      const catHeader = document.createElement('div');
      catHeader.className = 'category-header';
      catHeader.innerHTML = '<span>' + esc(cat.name) + '</span>';
      listEl.appendChild(catHeader);
      for (const cl of cls) {
        const { done, total } = checklistProgress(cl);
        const row = document.createElement('button');
        row.className = 'list-row';
        row.innerHTML = esc(cl.name) + '<span class="count">' + done + '/' + total + '</span>';
        row.addEventListener('click', () => push('checklistDetail', { checklistId: cl.id }));
        listEl.appendChild(row);
      }
    }
  }

  function renderChecklistDetail(checklistId) {
    const App = window.App;
    const cl = App.checklistData.checklists.find(c => c.id === checklistId);
    let html = header(cl ? cl.name : I18N.t('sidebar.checklist_fallback_title'), true);
    html += '<div class="list" id="checklistTasks"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('checklistTasks');
    if (!cl) return;
    for (const taskId of cl.checklistTaskIds) {
      const marker = App.markerByChecklistTaskId[taskId];
      const row = document.createElement('label');
      row.className = 'task-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = App.completedTaskIds.has(taskId);
      cb.addEventListener('change', () => { App.toggleCompleted(taskId); });
      const label = document.createElement('span');
      label.textContent = marker ? marker.name : (App.checklistTaskNames[taskId] || (I18N.t('sidebar.task_number_prefix') + taskId));
      if (marker) {
        label.className = 'task-label clickable';
        label.addEventListener('click', () => App.panToMarker(marker));
      }
      row.append(cb, label);
      listEl.appendChild(row);
    }
  }

  // ---------------- dedicated servers ----------------
  function countOnlinePlayers() {
    const App = window.App;
    if (!App) return 0;
    const liveData = App.getLiveServerData();
    let count = 0;
    for (const server of App.state.servers) {
      const data = liveData[server.id];
      if (data && data.online) count += data.players.length;
    }
    return count;
  }

  function renderServers() {
    const App = window.App;
    let html = header(I18N.t('nav.servers'), true);
    html += '<button class="add-btn" id="addServerBtn">' + I18N.t('sidebar.add_server_button') + '</button>';
    html += '<div class="list" id="serversList"></div>';
    root.innerHTML = html;
    wireBack();
    const listEl = document.getElementById('serversList');
    const liveData = App.getLiveServerData();
    if (!App.state.servers.length) listEl.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_servers_yet') + '</div>';
    for (const server of App.state.servers) {
      const data = liveData[server.id];
      const needsPw = App.needsPassword(server.id);
      const statusClass = !server.enabled ? 'off' : needsPw ? 'error' : (data && data.online ? 'online' : (data ? 'error' : 'off'));
      const statusText = !server.enabled ? I18N.t('sidebar.status_disabled') : needsPw ? I18N.t('sidebar.status_password_needed') :
        (data && data.online ? data.players.length + I18N.t('sidebar.status_online_suffix') : (data ? (data.error || I18N.t('sidebar.status_offline')) : I18N.t('sidebar.status_connecting')));
      const row = document.createElement('div');
      row.className = 'list-row-item server-row';
      row.dataset.serverId = server.id;
      const btn = document.createElement('button');
      btn.className = 'list-row';
      btn.innerHTML = '<span class="status-dot ' + statusClass + '"></span><span class="server-row-name">' + esc(server.name) + '</span>' +
        '<span class="count">' + esc(statusText) + '</span>';
      btn.addEventListener('click', () => push('serverDetail', { serverId: server.id }));
      row.appendChild(btn);
      if (needsPw && server.enabled) {
        const unlock = document.createElement('button');
        unlock.className = 'mini-btn';
        unlock.textContent = I18N.t('sidebar.unlock_button');
        unlock.addEventListener('click', async (e) => {
          e.stopPropagation();
          const pw = await showPrompt(I18N.t('sidebar.password_for_prefix') + server.name, I18N.t('sidebar.admin_password_placeholder'), '', 'password');
          if (pw) { App.setSessionPassword(server.id, pw); renderServers(); }
        });
        row.appendChild(unlock);
      }
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.addEventListener('click', () => { App.deleteServer(server.id); renderServers(); });
      row.append(del);
      listEl.appendChild(row);
    }
    document.getElementById('addServerBtn').addEventListener('click', async () => {
      const form = await showServerForm(I18N.t('sidebar.add_server_title'));
      if (form) { App.addServer(form); renderServers(); }
    });
  }

  function buildPlayerRow(p, serverId, transform) {
    const App = window.App;
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.userid = p.userId;
    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = p.name;
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent = I18N.t('app.level_abbr') + ' ' + p.level + ' · ' + Math.round(p.ping) + 'ms';
    row.append(nameEl, countEl);
    if (transform) {
      const goBtn = document.createElement('button');
      goBtn.className = 'mini-btn';
      goBtn.textContent = I18N.t('sidebar.show_on_map');
      goBtn.addEventListener('click', () => { App.followPlayer(serverId, p.playerId); });
      row.appendChild(goBtn);
    }
    const kickBtn = document.createElement('button');
    kickBtn.className = 'mini-btn';
    kickBtn.textContent = I18N.t('sidebar.kick_button');
    kickBtn.addEventListener('click', async () => {
      const ok = await showConfirm(I18N.t('sidebar.kick_confirm_prefix') + p.name + '?', I18N.t('sidebar.kick_confirm_body'), I18N.t('sidebar.kick_button'));
      if (!ok) return;
      try { await App.kickPlayer(serverId, p.userId); } catch (e) { alertError(I18N.t('sidebar.kick_failed'), e); }
    });
    const banBtn = document.createElement('button');
    banBtn.className = 'mini-btn danger';
    banBtn.textContent = I18N.t('sidebar.ban_button');
    banBtn.addEventListener('click', async () => {
      const ok = await showConfirm(I18N.t('sidebar.ban_confirm_prefix') + p.name + '?', I18N.t('sidebar.ban_confirm_body'), I18N.t('sidebar.ban_button'), true);
      if (!ok) return;
      try { await App.banPlayer(serverId, p.userId, '', p.name); } catch (e) { alertError(I18N.t('sidebar.ban_failed'), e); }
    });
    row.append(kickBtn, banBtn);
    return row;
  }

  function serverDetailSignature(server, data, needsPw) {
    return JSON.stringify({ enabled: server.enabled, needsPw, online: !!(data && data.online) });
  }

  // Surgical update for the currently-open serverDetail view: refreshes status text and
  // diffs the player list in place, without touching scroll position, expanded sections,
  // or anything the user might be mid-typing into. Falls back to a full re-render only
  // when the *structure* of the panel needs to change (e.g. offline -> online).
  function patchServerDetail(serverId) {
    const App = window.App;
    const server = App.state.servers.find(s => s.id === serverId);
    if (!server) return;
    const liveData = App.getLiveServerData();
    const data = liveData[serverId];
    const needsPw = App.needsPassword(serverId);
    const signature = serverDetailSignature(server, data, needsPw);

    if (signature !== lastServerDetailSignature) {
      renderServerDetail(serverId);
      return;
    }

    const statusLineEl = document.querySelector('.server-status-line');
    if (statusLineEl) {
      if (!server.enabled) statusLineEl.innerHTML = '<span class="status-dot off"></span> ' + I18N.t('sidebar.status_disabled');
      else if (needsPw) statusLineEl.innerHTML = '<span class="status-dot error"></span> ' + I18N.t('sidebar.status_password_needed');
      else if (data && data.online) statusLineEl.innerHTML = '<span class="status-dot online"></span> Online &middot; ' + data.players.length + ' player' + (data.players.length === 1 ? '' : 's');
      else if (data) statusLineEl.innerHTML = '<span class="status-dot error"></span> ' + esc(data.error || I18N.t('sidebar.status_offline'));
      else statusLineEl.innerHTML = '<span class="status-dot off"></span> ' + I18N.t('sidebar.status_connecting');
    }

    const playersList = document.getElementById('playersList');
    if (!playersList || !data || !data.online) return;
    const transform = App.state.calibrationTransform;
    const existingRows = new Map();
    playersList.querySelectorAll('.player-row').forEach(row => existingRows.set(row.dataset.userid, row));
    const seen = new Set();
    for (const p of data.players) {
      seen.add(p.userId);
      const row = existingRows.get(p.userId);
      if (!row) {
        playersList.appendChild(buildPlayerRow(p, serverId, transform));
      } else {
        row.querySelector('.count').textContent = I18N.t('app.level_abbr') + ' ' + p.level + ' · ' + Math.round(p.ping) + 'ms';
      }
    }
    for (const [userid, row] of existingRows) if (!seen.has(userid)) row.remove();
    const emptyEl = playersList.querySelector('.empty');
    if (!data.players.length && !emptyEl) playersList.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_players_online') + '</div>';
    else if (data.players.length && emptyEl) emptyEl.remove();
  }

  function patchServersList() {
    const App = window.App;
    const liveData = App.getLiveServerData();
    document.querySelectorAll('.server-row').forEach((row) => {
      const serverId = row.dataset.serverId;
      const server = App.state.servers.find(s => s.id === serverId);
      if (!server) return;
      const data = liveData[serverId];
      const needsPw = App.needsPassword(serverId);
      const statusClass = !server.enabled ? 'off' : needsPw ? 'error' : (data && data.online ? 'online' : (data ? 'error' : 'off'));
      const statusText = !server.enabled ? I18N.t('sidebar.status_disabled') : needsPw ? I18N.t('sidebar.status_password_needed') :
        (data && data.online ? data.players.length + I18N.t('sidebar.status_online_suffix') : (data ? (data.error || I18N.t('sidebar.status_offline')) : I18N.t('sidebar.status_connecting')));
      const dot = row.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot ' + statusClass;
      const countEl = row.querySelector('.count');
      if (countEl) countEl.textContent = statusText;
    });
  }

  function patchCalibrationPlayerDropdown() {
    const App = window.App;
    const selectEl = document.getElementById('calibPlayerSelect');
    if (!selectEl || document.getElementById('calibManualToggle').checked) return;
    const liveData = App.getLiveServerData();
    const playerOptions = [];
    for (const server of App.state.servers) {
      const data = liveData[server.id];
      if (data && data.online) {
        for (const p of data.players) playerOptions.push({ serverId: server.id, playerId: p.playerId, label: p.name + ' (' + server.name + ')' });
      }
    }
    const prevValue = selectEl.value;
    if (!playerOptions.length) {
      selectEl.innerHTML = '<option value="">' + esc(I18N.t('sidebar.no_players_online_option')) + '</option>';
      selectEl.disabled = true;
    } else {
      selectEl.disabled = false;
      selectEl.innerHTML = playerOptions.map((o, i) => '<option value="' + i + '">' + esc(o.label) + '</option>').join('');
      if (prevValue && Number(prevValue) < playerOptions.length) selectEl.value = prevValue;
    }
    window.__calibPlayerOptions = playerOptions;
  }

  function renderKvTable(obj) {
    if (!obj || typeof obj !== 'object') return '<div class="empty">' + I18N.t('sidebar.no_data') + '</div>';
    const keys = Object.keys(obj);
    if (!keys.length) return '<div class="empty">' + I18N.t('sidebar.no_data') + '</div>';
    let html = '<table class="kv-table">';
    for (const k of keys) {
      const v = obj[k];
      const display = (v && typeof v === 'object') ? JSON.stringify(v) : String(v);
      html += '<tr><td class="kv-key">' + esc(k) + '</td><td class="kv-val">' + esc(display) + '</td></tr>';
    }
    html += '</table>';
    return html;
  }

  function sparklineSvg(values) {
    const w = 100, h = 24, pad = 2;
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max - min) || 1;
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polyline points="' + points + '" fill="none" stroke="#3d6cb9" stroke-width="1.5"/></svg>';
  }

  function renderMetricsHistory(samples) {
    if (!samples || !samples.length) return '<div class="empty">' + I18N.t('sidebar.no_metrics_samples') + '</div>';
    const latest = samples[samples.length - 1].metrics || {};
    const numericKeys = Object.keys(latest).filter(k => typeof latest[k] === 'number');
    if (!numericKeys.length) return '<div class="empty">' + I18N.t('sidebar.no_numeric_metrics') + '</div>';
    let html = '';
    for (const key of numericKeys) {
      const values = samples.map(s => (s.metrics && typeof s.metrics[key] === 'number') ? s.metrics[key] : null).filter(v => v !== null);
      if (!values.length) continue;
      const last = values[values.length - 1];
      html += '<div class="metric-row"><span class="metric-label">' + esc(key) + '</span>' +
        sparklineSvg(values) +
        '<span class="metric-value">' + (Number.isInteger(last) ? last : last.toFixed(2)) + '</span></div>';
    }
    return html || '<div class="empty">' + I18N.t('sidebar.no_numeric_metrics') + '</div>';
  }

  function renderServerDetail(serverId) {
    const App = window.App;
    const server = App.state.servers.find(s => s.id === serverId);
    let html = header(server ? server.name : I18N.t('common.server_word'), true);
    if (!server) { root.innerHTML = html; wireBack(); return; }
    const liveData = App.getLiveServerData();
    const data = liveData[serverId];

    const needsPw = App.needsPassword(serverId);
    html += '<div class="server-meta">' + esc(server.host) + ':' + server.port + '</div>';
    html += '<div class="server-status-line">';
    if (!server.enabled) html += '<span class="status-dot off"></span> ' + I18N.t('sidebar.status_disabled');
    else if (needsPw) html += '<span class="status-dot error"></span> ' + I18N.t('sidebar.status_password_needed');
    else if (data && data.online) html += '<span class="status-dot online"></span> Online &middot; ' + data.players.length + ' player' + (data.players.length === 1 ? '' : 's');
    else if (data) html += '<span class="status-dot error"></span> ' + esc(data.error || I18N.t('sidebar.status_offline'));
    else html += '<span class="status-dot off"></span> ' + I18N.t('sidebar.status_connecting');
    html += '</div>';

    if (needsPw && server.enabled) html += '<button class="add-btn" id="unlockBtn">' + I18N.t('sidebar.enter_admin_password_button') + '</button>';

    html += '<label class="check-row"><input type="checkbox" id="serverEnabledToggle"' + (server.enabled ? ' checked' : '') + '> ' + I18N.t('sidebar.enabled_label') + '</label>';

    html += '<div class="list" id="playersList"></div>';
    html += '<button class="add-btn" id="calibrateBtn">' + I18N.t('sidebar.calibrate_button') + '</button>';

    if (data && data.online) {
      html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.admin_actions_title') + '</div>';
      html += '<div class="admin-actions-grid">';
      html += '<button class="mini-btn" id="actAnnounce">' + I18N.t('sidebar.action_announce') + '</button>';
      html += '<button class="mini-btn" id="actSave">' + I18N.t('sidebar.action_save_world') + '</button>';
      html += '<button class="mini-btn" id="actUnban">' + I18N.t('sidebar.action_unban_player') + '</button>';
      html += '<button class="mini-btn" id="actInfo">' + I18N.t('sidebar.action_server_info') + '</button>';
      html += '<button class="mini-btn" id="actSettings">' + I18N.t('sidebar.action_server_settings') + '</button>';
      html += '<button class="mini-btn danger" id="actShutdown">' + I18N.t('modal.shutdown_button') + '</button>';
      html += '<button class="mini-btn danger" id="actForceStop">' + I18N.t('sidebar.action_force_stop') + '</button>';
      html += '</div>';
      html += '<div class="kv-panel" id="infoPanel" style="display:none"></div>';
      html += '<div class="kv-panel" id="settingsPanel" style="display:none"></div>';
      html += '</div>';
    }

    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.banned_players_title') + '</div><div class="list" id="banList"></div></div>';
    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.recent_metrics_title') + '</div><div id="metricsHistoryPanel"></div></div>';

    html += '<div class="footer"><button id="editServerBtn">' + I18N.t('common.edit') + '</button><button id="removeServerBtn">' + I18N.t('common.remove') + '</button></div>';
    root.innerHTML = html;
    wireBack();

    const playersList = document.getElementById('playersList');
    if (data && data.online && data.players.length) {
      const transform = App.state.calibrationTransform;
      for (const p of data.players) playersList.appendChild(buildPlayerRow(p, serverId, transform));
    } else if (data && data.online) {
      playersList.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_players_online') + '</div>';
    }
    lastServerDetailSignature = serverDetailSignature(server, data, needsPw);

    document.getElementById('serverEnabledToggle').addEventListener('change', (e) => App.toggleServerEnabled(serverId, e.target.checked));
    document.getElementById('calibrateBtn').addEventListener('click', () => push('calibration', { serverId }));
    const unlockBtn = document.getElementById('unlockBtn');
    if (unlockBtn) unlockBtn.addEventListener('click', async () => {
      const pw = await showPrompt(I18N.t('sidebar.password_for_prefix') + server.name, I18N.t('sidebar.admin_password_placeholder'), '', 'password');
      if (pw) { App.setSessionPassword(serverId, pw); renderServerDetail(serverId); }
    });
    document.getElementById('editServerBtn').addEventListener('click', async () => {
      const form = await showServerForm(I18N.t('sidebar.edit_server_title'), server);
      if (form) { App.updateServer(serverId, form); renderServerDetail(serverId); }
    });
    document.getElementById('removeServerBtn').addEventListener('click', () => { App.deleteServer(serverId); popView(); });

    const announceBtn = document.getElementById('actAnnounce');
    if (announceBtn) announceBtn.addEventListener('click', async () => {
      const message = await showPrompt(I18N.t('sidebar.announce_modal_title'), I18N.t('sidebar.announce_placeholder'));
      if (!message) return;
      const ok = await showConfirm(I18N.t('sidebar.announce_confirm_title'), '"' + message + '"', I18N.t('sidebar.action_announce'));
      if (!ok) return;
      try { await App.announceToServer(serverId, message); } catch (e) { alertError(I18N.t('sidebar.announce_failed'), e); }
    });
    const saveBtn = document.getElementById('actSave');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const ok = await showConfirm(I18N.t('sidebar.save_world_confirm_title'), I18N.t('sidebar.save_world_confirm_body'), I18N.t('common.save'));
      if (!ok) return;
      try { await App.saveServerWorld(serverId); } catch (e) { alertError(I18N.t('common.save_failed'), e); }
    });
    const unbanBtn = document.getElementById('actUnban');
    if (unbanBtn) unbanBtn.addEventListener('click', async () => {
      const userid = await showPrompt(I18N.t('sidebar.unban_modal_title'), I18N.t('sidebar.unban_userid_placeholder'));
      if (!userid) return;
      const ok = await showConfirm(I18N.t('sidebar.unban_confirm_title'), userid, I18N.t('sidebar.unban_button'));
      if (!ok) return;
      try { await App.unbanPlayer(serverId, userid); } catch (e) { alertError(I18N.t('sidebar.unban_failed'), e); }
    });
    const shutdownBtn = document.getElementById('actShutdown');
    if (shutdownBtn) shutdownBtn.addEventListener('click', async () => {
      const form = await showShutdownForm();
      if (!form) return;
      const ok = await showConfirm(I18N.t('sidebar.shutdown_confirm_prefix') + server.name + '?',
        form.waittime + I18N.t('sidebar.shutdown_seconds_suffix'), I18N.t('modal.shutdown_button'), true);
      if (!ok) return;
      try { await App.shutdownServer(serverId, form.waittime, form.message); } catch (e) { alertError(I18N.t('sidebar.shutdown_failed'), e); }
    });
    const forceStopBtn = document.getElementById('actForceStop');
    if (forceStopBtn) forceStopBtn.addEventListener('click', async () => {
      const ok = await showConfirm(I18N.t('sidebar.force_stop_confirm_prefix') + server.name + '?',
        I18N.t('sidebar.force_stop_confirm_body'), I18N.t('sidebar.action_force_stop'), true);
      if (!ok) return;
      try { await App.forceStopServer(serverId); } catch (e) { alertError(I18N.t('sidebar.force_stop_failed'), e); }
    });

    const infoBtn = document.getElementById('actInfo');
    const infoPanel = document.getElementById('infoPanel');
    if (infoBtn) infoBtn.addEventListener('click', async () => {
      if (infoPanel.style.display !== 'none') { infoPanel.style.display = 'none'; return; }
      infoPanel.style.display = '';
      infoPanel.innerHTML = '<div class="empty">' + I18N.t('common.loading') + '</div>';
      try { infoPanel.innerHTML = renderKvTable(await App.getServerInfo(serverId)); }
      catch (e) { infoPanel.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    });
    const settingsBtn = document.getElementById('actSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsBtn) settingsBtn.addEventListener('click', async () => {
      if (settingsPanel.style.display !== 'none') { settingsPanel.style.display = 'none'; return; }
      settingsPanel.style.display = '';
      settingsPanel.innerHTML = '<div class="empty">' + I18N.t('common.loading') + '</div>';
      try { settingsPanel.innerHTML = renderKvTable(await App.getServerSettings(serverId)); }
      catch (e) { settingsPanel.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    });

    const banListEl = document.getElementById('banList');
    (async () => {
      try {
        const bans = await App.getBanList(serverId);
        if (!bans.length) { banListEl.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_banned_players') + '</div>'; return; }
        banListEl.innerHTML = '';
        for (const b of bans) {
          const row = document.createElement('div');
          row.className = 'player-row';
          const nameEl = document.createElement('span');
          nameEl.className = 'player-name';
          nameEl.textContent = b.name ? (b.name + ' (' + b.userid + ')') : b.userid;
          const unbanBtn = document.createElement('button');
          unbanBtn.className = 'mini-btn';
          unbanBtn.textContent = I18N.t('sidebar.unban_button');
          unbanBtn.addEventListener('click', async () => {
            try { await App.unbanPlayer(serverId, b.userid); renderServerDetail(serverId); }
            catch (e) { alertError(I18N.t('sidebar.unban_failed'), e); }
          });
          row.append(nameEl, unbanBtn);
          banListEl.appendChild(row);
        }
      } catch (e) { banListEl.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    })();

    const metricsPanel = document.getElementById('metricsHistoryPanel');
    (async () => {
      try {
        const samples = await App.getMetricsHistory(serverId);
        metricsPanel.innerHTML = renderMetricsHistory(samples);
      } catch (e) { metricsPanel.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    })();
  }

  function alertError(title, err) {
    showConfirm(title, err.message || String(err), I18N.t('common.ok'));
  }

  // ---------------- map calibration ----------------
  let calibZone = 'main';
  function renderCalibration(serverId) {
    const App = window.App;
    const points = calibZone === 'zone2' ? App.state.calibrationPointsZone2 : App.state.calibrationPoints;
    const transform = calibZone === 'zone2' ? App.state.calibrationTransformZone2 : App.state.calibrationTransform;
    let html = header(I18N.t('sidebar.map_calibration_title'), true);
    html += '<div class="calib-explainer">' + I18N.t('sidebar.calib_explainer') + '</div>';

    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.map_section_title') + '</div>';
    html += '<select id="calibZoneSelect" class="search-input">' +
      '<option value="main"' + (calibZone === 'main' ? ' selected' : '') + '>' + I18N.t('sidebar.main_island_option') + '</option>' +
      '<option value="zone2"' + (calibZone === 'zone2' ? ' selected' : '') + '>' + I18N.t('sidebar.zone2_option') + '</option>' +
      '</select></div>';
    html += '<div class="calib-status ' + (transform ? 'ok' : '') + '">' +
      (transform ? I18N.t('sidebar.calibrated_prefix') + points.length + I18N.t('sidebar.calibrated_suffix') : points.length + I18N.t('sidebar.not_calibrated_suffix')) + '</div>';

    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.add_point_title') + '</div>';
    html += '<select id="calibPlayerSelect" class="search-input"></select>';
    html += '<label class="check-row"><input type="checkbox" id="calibManualToggle"> ' + I18N.t('sidebar.enter_coords_manually') + '</label>';
    html += '<div id="calibManualFields" style="display:none;">' +
      '<input id="calibManualX" class="modal-input" type="text" placeholder="' + esc(I18N.t('sidebar.x_coordinate_placeholder')) + '" style="margin-bottom:6px;">' +
      '<input id="calibManualY" class="modal-input" type="text" placeholder="' + esc(I18N.t('sidebar.y_coordinate_placeholder')) + '">' +
      '</div>';
    html += '<button class="add-btn" id="calibAddBtn" style="margin-top:8px;">' + I18N.t('sidebar.click_map_set_position') + '</button>';
    html += '</div>';

    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.existing_points_title') + '</div><div class="list" id="calibPointsList"></div></div>';
    root.innerHTML = html;
    wireBack();

    document.getElementById('calibZoneSelect').addEventListener('change', (e) => {
      calibZone = e.target.value;
      renderCalibration(serverId);
    });

    const selectEl = document.getElementById('calibPlayerSelect');
    patchCalibrationPlayerDropdown();
    if (window.__calibPlayerOptions && !window.__calibPlayerOptions.length) {
      document.getElementById('calibManualToggle').checked = true;
      document.getElementById('calibManualFields').style.display = 'block';
      selectEl.style.display = 'none';
    }

    document.getElementById('calibManualToggle').addEventListener('change', (e) => {
      document.getElementById('calibManualFields').style.display = e.target.checked ? 'block' : 'none';
      selectEl.style.display = e.target.checked ? 'none' : '';
    });

    document.getElementById('calibAddBtn').addEventListener('click', async () => {
      const manual = document.getElementById('calibManualToggle').checked;
      let x, y;
      if (manual) {
        x = parseFloat(document.getElementById('calibManualX').value);
        y = parseFloat(document.getElementById('calibManualY').value);
        if (isNaN(x) || isNaN(y)) { return; }
      } else {
        const idx = parseInt(selectEl.value, 10);
        const chosen = (window.__calibPlayerOptions || [])[idx];
        if (!chosen) return;
        const freshData = App.getLiveServerData()[chosen.serverId];
        const freshPlayer = freshData && freshData.players.find(p => p.playerId === chosen.playerId);
        if (!freshPlayer) return;
        x = freshPlayer.location_x;
        y = freshPlayer.location_y;
      }
      const latlng = await App.captureCalibrationPoint();
      App.addCalibrationPoint(x, y, latlng.lat, latlng.lng, calibZone);
      renderCalibration(serverId);
    });

    const pointsList = document.getElementById('calibPointsList');
    if (!points.length) pointsList.innerHTML = '<div class="empty">' + I18N.t('sidebar.no_calibration_points') + '</div>';
    points.forEach((pt, i) => {
      const row = document.createElement('div');
      row.className = 'list-row-item';
      const info = document.createElement('div');
      info.className = 'calib-point-info';
      info.textContent = 'raw(' + Math.round(pt.x) + ', ' + Math.round(pt.y) + I18N.t('sidebar.calib_map_arrow') + pt.lat.toFixed(3) + ', ' + pt.lng.toFixed(3) + ')';
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '✕';
      del.addEventListener('click', () => { App.deleteCalibrationPoint(i, calibZone); renderCalibration(serverId); });
      row.append(info, del);
      pointsList.appendChild(row);
    });
  }

  // ---------------- database editor ----------------
  function renderEditorMenu() {
    const App = window.App;
    let html = header(I18N.t('sidebar.database_editor_title'), true);
    html += '<div class="calib-explainer">' + I18N.t('sidebar.db_editor_explainer') + '</div>';
    html += '<div class="nav-list">';
    html += navRow(I18N.t('sidebar.editor_nav_markers'), App.markers.length, 'editorMarkers');
    html += navRow(I18N.t('sidebar.editor_nav_heatmap'), App.heatmapData.categories.length, 'editorHeatmap');
    html += '</div>';
    root.innerHTML = html;
    wireBack();
    root.querySelectorAll('.nav-row').forEach(btn => btn.addEventListener('click', () => push(btn.dataset.view)));
  }

  function renderEditorMarkers() {
    const App = window.App;
    let html = header(I18N.t('sidebar.edit_markers_title'), true);
    html += '<input id="editorMarkerSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('sidebar.search_markers_edit_placeholder')) + '">';
    html += '<div class="list" id="editorMarkerResults"></div>';
    root.innerHTML = html;
    wireBack();
    const resultsEl = document.getElementById('editorMarkerResults');
    const RESULT_LIMIT = 200;
    function draw(q) {
      resultsEl.innerHTML = '';
      if (!q || q.length < 2) { resultsEl.innerHTML = '<div class="empty">' + I18N.t('sidebar.type_at_least_2_chars') + '</div>'; return; }
      const ql = q.toLowerCase();
      const all = App.markers.filter(m => m.name && m.name.toLowerCase().includes(ql));
      const matches = all.slice(0, RESULT_LIMIT);
      if (!matches.length) { resultsEl.innerHTML = '<div class="empty">' + I18N.t('common.no_matches') + '</div>'; return; }
      if (all.length > RESULT_LIMIT) {
        const notice = document.createElement('div');
        notice.className = 'empty';
        notice.textContent = I18N.t('sidebar.showing_prefix') + RESULT_LIMIT + I18N.t('sidebar.showing_of_middle') + all.length + I18N.t('sidebar.showing_matches_suffix');
        resultsEl.appendChild(notice);
      }
      for (const m of matches) {
        const t = App.typeBySlug[m.typeSlug];
        const region = App.regionById[m.regionId];
        const row = document.createElement('button');
        row.className = 'list-row';
        let label = m.name;
        if (t) label += ' (' + t.typeName + ')';
        if (region) label += ' — ' + region.title;
        row.textContent = label;
        row.addEventListener('click', () => push('editorMarkerDetail', { markerId: m.id }));
        resultsEl.appendChild(row);
      }
    }
    document.getElementById('editorMarkerSearch').addEventListener('input', (e) => draw(e.target.value));
  }

  function renderEditorMarkerDetail(markerId) {
    const App = window.App;
    if (editorDragCleanup) { editorDragCleanup(); editorDragCleanup = null; }
    const m = App.markers.find(mk => mk.id === markerId);
    let html = header(I18N.t('sidebar.edit_marker_title'), true);
    if (!m) { root.innerHTML = html + '<div class="empty">' + I18N.t('sidebar.marker_not_found') + '</div>'; wireBack(); return; }

    const leafTypes = App.types.filter(t => t.icon);
    html += '<label class="modal-field-label">' + I18N.t('common.name_label') + '</label>';
    html += '<input id="editName" class="modal-input" type="text" value="' + esc(m.name) + '">';
    html += '<label class="modal-field-label">' + I18N.t('common.type_label') + '</label>';
    html += '<select id="editType" class="search-input">' +
      leafTypes.map(t => '<option value="' + t.typeSlug + '"' + (t.typeSlug === m.typeSlug ? ' selected' : '') + '>' + esc(t.typeName) + '</option>').join('') +
      '</select>';
    html += '<label class="modal-field-label">' + I18N.t('common.description_label') + '</label>';
    html += '<textarea id="editDescription" class="modal-input modal-textarea" rows="3">' + esc(m.description || '') + '</textarea>';
    html += '<label class="modal-field-label">' + I18N.t('common.position_label') + '</label>';
    html += '<div class="modal-field-row">' +
      '<input id="editLat" class="modal-input" type="text" value="' + m.lat + '">' +
      '<input id="editLng" class="modal-input" type="text" value="' + m.lng + '">' +
      '</div>';
    html += '<button class="add-btn" id="dragPositionBtn">' + I18N.t('sidebar.drag_marker_button') + '</button>';
    html += '<div class="modal-status" id="editorStatus"></div>';
    html += '<div class="footer"><button id="editorSaveBtn">' + I18N.t('common.save_changes') + '</button></div>';
    root.innerHTML = html;
    wireBack();

    const latInput = document.getElementById('editLat');
    const lngInput = document.getElementById('editLng');
    const statusEl = document.getElementById('editorStatus');

    App.focusMarkerForEdit(markerId);

    document.getElementById('dragPositionBtn').addEventListener('click', () => {
      statusEl.textContent = I18N.t('sidebar.drag_marker_hint');
      statusEl.className = 'modal-status';
      if (editorDragCleanup) editorDragCleanup();
      editorDragCleanup = App.enableMarkerDragEdit(markerId, (lat, lng) => {
        latInput.value = lat;
        lngInput.value = lng;
        statusEl.textContent = I18N.t('sidebar.position_updated_from_drag');
        statusEl.className = 'modal-status ok';
      });
    });

    document.getElementById('editorSaveBtn').addEventListener('click', async () => {
      const name = document.getElementById('editName').value.trim();
      const typeSlug = document.getElementById('editType').value;
      const description = document.getElementById('editDescription').value.trim();
      const lat = parseFloat(latInput.value), lng = parseFloat(lngInput.value);
      if (!name || isNaN(lat) || isNaN(lng)) { statusEl.textContent = I18N.t('sidebar.name_position_required'); statusEl.className = 'modal-status error'; return; }
      const ok = await showConfirm(I18N.t('sidebar.save_marker_confirm_prefix') + m.name + '"?', I18N.t('sidebar.overwrite_marker_warning'), I18N.t('common.save'));
      if (!ok) return;
      App.updateMarkerData(markerId, { name, typeSlug, description, lat, lng });
      statusEl.textContent = I18N.t('common.saving');
      statusEl.className = 'modal-status';
      try {
        await App.saveMarkersToDisk();
        statusEl.textContent = I18N.t('common.saved');
        statusEl.className = 'modal-status ok';
      } catch (e) {
        statusEl.textContent = I18N.t('sidebar.save_failed_prefix') + e.message;
        statusEl.className = 'modal-status error';
      }
    });
  }

  function renderEditorHeatmap() {
    const App = window.App;
    let html = header(I18N.t('sidebar.edit_heatmap_title'), true);
    html += '<input id="editorHeatmapSearch" class="search-input" type="text" placeholder="' + esc(I18N.t('sidebar.search_pals_edit_placeholder')) + '">';
    html += '<div class="list" id="editorHeatmapResults"></div>';
    root.innerHTML = html;
    wireBack();
    const resultsEl = document.getElementById('editorHeatmapResults');
    const cats = [...App.heatmapData.categories].sort((a, b) => a.title.localeCompare(b.title));
    function draw(q) {
      resultsEl.innerHTML = '';
      const ql = (q || '').toLowerCase();
      for (const c of cats) {
        if (ql && !c.title.toLowerCase().includes(ql)) continue;
        const row = document.createElement('button');
        row.className = 'list-row';
        row.innerHTML = esc(c.title) + '<span class="count">' + c.points.length + ' pts</span>';
        row.addEventListener('click', () => push('editorHeatmapDetail', { categoryId: c.id }));
        resultsEl.appendChild(row);
      }
    }
    draw('');
    document.getElementById('editorHeatmapSearch').addEventListener('input', (e) => draw(e.target.value));
  }

  function renderEditorHeatmapDetail(categoryId) {
    const App = window.App;
    if (brushActiveInThisView) { App.stopBrush(); brushActiveInThisView = false; }
    const cat = App.heatmapData.categories.find(c => c.id === categoryId);
    let html = header(I18N.t('sidebar.edit_pal_title'), true);
    if (!cat) { root.innerHTML = html + '<div class="empty">' + I18N.t('sidebar.category_not_found') + '</div>'; wireBack(); return; }

    if (App.getHeatmapActiveId() !== categoryId) App.setHeatmapCategory(categoryId);

    html += '<label class="modal-field-label">' + I18N.t('common.name_label') + '</label>';
    html += '<input id="editHeatmapName" class="modal-input" type="text" value="' + esc(cat.title) + '">';
    html += '<label class="modal-field-label">' + I18N.t('common.icon_label') + '</label>';
    html += '<div class="heatmap-icon-preview">';
    const iconUrl = App.palIcons[cat.title];
    html += iconUrl ? '<div class="pal-thumb" style="background-image:url(\'' + iconUrl + '\')"></div>' : '<div class="pal-thumb">' + esc(cat.title.charAt(0)) + '</div>';
    html += '<input id="editHeatmapIconFile" type="file" accept="image/png,image/jpeg">';
    html += '</div>';
    html += '<div class="section-block"><div class="section-title">' + I18N.t('sidebar.points_count_prefix') + cat.points.length + ')</div>';
    html += '<button class="add-btn" id="brushToggleBtn">' + I18N.t('sidebar.start_painting_button') + '</button>';
    html += '<div class="calib-explainer">' + I18N.t('sidebar.painting_explainer') + '</div>';
    html += '</div>';
    html += '<div class="modal-status" id="editorHeatmapStatus"></div>';
    html += '<div class="footer"><button id="editorHeatmapSaveBtn">' + I18N.t('common.save_changes') + '</button></div>';
    root.innerHTML = html;
    wireBack();

    const statusEl = document.getElementById('editorHeatmapStatus');
    const brushBtn = document.getElementById('brushToggleBtn');
    brushBtn.addEventListener('click', () => {
      if (!brushActiveInThisView) {
        App.startBrush(categoryId);
        brushActiveInThisView = true;
        brushBtn.textContent = I18N.t('sidebar.stop_painting_button');
        brushBtn.classList.add('active');
      } else {
        const added = App.stopBrush();
        brushActiveInThisView = false;
        renderEditorHeatmapDetail(categoryId);
        const freshStatusEl = document.getElementById('editorHeatmapStatus');
        freshStatusEl.textContent = added ? (added + I18N.t('sidebar.points_added_suffix')) : I18N.t('sidebar.no_points_painted');
        freshStatusEl.className = 'modal-status ok';
      }
    });

    document.getElementById('editHeatmapIconFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await App.uploadPalIcon(cat.title, reader.result);
          statusEl.textContent = I18N.t('sidebar.icon_uploaded');
          statusEl.className = 'modal-status ok';
          renderEditorHeatmapDetail(categoryId);
        } catch (err) {
          statusEl.textContent = I18N.t('sidebar.icon_upload_failed_prefix') + err.message;
          statusEl.className = 'modal-status error';
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('editorHeatmapSaveBtn').addEventListener('click', async () => {
      const name = document.getElementById('editHeatmapName').value.trim();
      if (!name) { statusEl.textContent = I18N.t('sidebar.name_required'); statusEl.className = 'modal-status error'; return; }
      const ok = await showConfirm(I18N.t('sidebar.save_marker_confirm_prefix') + cat.title + '"?', I18N.t('sidebar.overwrite_heatmap_warning'), I18N.t('common.save'));
      if (!ok) return;
      App.updateHeatmapCategoryMeta(categoryId, { title: name });
      statusEl.textContent = I18N.t('common.saving');
      statusEl.className = 'modal-status';
      try {
        await App.saveHeatmapToDisk();
        statusEl.textContent = I18N.t('common.saved');
        statusEl.className = 'modal-status ok';
      } catch (e) {
        statusEl.textContent = I18N.t('sidebar.save_failed_prefix') + e.message;
        statusEl.className = 'modal-status error';
      }
    });
  }

  // ---------------- profile bar (persistent, outside the view-routed sidebar-content) ----------------
  function renderProfileBar() {
    const App = window.App;
    const bar = document.getElementById('profileBar');
    if (!bar) return;
    bar.innerHTML = '<div class="profile-bar-name">&#128100; ' + esc(App.state.activeProfile || '?') + '</div><span class="profile-bar-chev">&#9662;</span>';
    bar.onclick = () => {
      window.showProfileManager(App.state.profiles, App.state.activeProfile, {
        onSwitch: async (name) => {
          await window.AppState.setActiveProfileName(name);
          window.location.reload();
        },
        onCreate: async (name) => {
          await window.AppState.createProfile(name);
        },
        onDelete: async (name) => {
          await window.AppState.deleteProfile(name);
        },
      });
    };
  }

  window.Sidebar = {
    init: () => { renderProfileBar(); render(); },
    onStateChanged: () => render(),
    onPlacementModeChanged: () => render(),
    openMarkerEditor: (markerId) => push('editorMarkerDetail', { markerId }),
    // Live player data (poll every ~10s) should keep the visible panel up to date, but
    // must never blow away in-progress typing, expanded sections, or scroll position.
    // So: patch in place for the views that show live data, and leave every other view
    // completely untouched.
    onLiveDataChanged: () => {
      const view = viewStack[viewStack.length - 1];
      if (view === 'servers') patchServersList();
      else if (view === 'serverDetail') patchServerDetail(viewParams.serverId);
      else if (view === 'calibration') patchCalibrationPlayerDropdown();
      const navCount = document.querySelector('.nav-row[data-view="servers"] .nav-count');
      if (navCount) navCount.textContent = countOnlinePlayers();
    },
  };
})();
