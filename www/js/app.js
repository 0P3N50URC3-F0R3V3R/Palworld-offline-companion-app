(async function () {
  await I18N.ready;
  I18N.renderSwitcher(document.getElementById('langSwitcher'));
  const [mapMeta, types, markers, regions, checklistData, heatmapData, palIcons, checklistTaskNames] = await Promise.all([
    fetch('data/map.json').then(r => r.json()),
    fetch('data/types.json').then(r => r.json()),
    fetch('data/markers.json').then(r => r.json()),
    fetch('data/regions.json').then(r => r.json()),
    fetch('data/checklists.json').then(r => r.json()),
    fetch('data/heatmap.json').then(r => r.json()),
    fetch('data/pal-icons.json').then(r => r.json()).catch(() => ({})),
    fetch('data/checklist-task-names.json').then(r => r.json()).catch(() => ({})),
  ]);

  const PROFILE_NAME_PATTERN = /^[A-Za-z0-9 _-]{1,30}$/;
  let existingProfiles = await AppState.listProfiles();
  if (!existingProfiles.length) {
    let name = null;
    let title = I18N.t('app.who_playing_title');
    while (!name) {
      const entered = (await showPrompt(title, I18N.t('modal.enter_name_placeholder'))) || '';
      const trimmed = entered.trim();
      if (PROFILE_NAME_PATTERN.test(trimmed)) {
        name = trimmed;
      } else {
        title = I18N.t('app.name_invalid_retry');
      }
    }
    await AppState.createProfile(name);
    await AppState.setActiveProfileName(name);
  }

  const state = await AppState.load();
  function persist() { AppState.save(state); }

  const typeBySlug = {};
  for (const t of types) typeBySlug[t.typeSlug] = t;
  const regionById = {};
  for (const r of regions) regionById[r.id] = r;
  const markerByChecklistTaskId = {};
  for (const m of markers) if (m.checklistTaskId) markerByChecklistTaskId[m.checklistTaskId] = m;

  if (!state.initialized) {
    const locationsParent = types.find(t => t.parentTypeSlug === null && t.typeName === 'Locations');
    if (locationsParent) {
      state.hiddenTypeSlugs = types
        .filter(t => t.icon && t.parentTypeSlug !== locationsParent.typeSlug)
        .map(t => t.typeSlug);
    }
    state.initialized = true;
    persist();
  }

  const completedTaskIds = new Set(state.completedTaskIds);
  const hiddenTypeSlugs = new Set(state.hiddenTypeSlugs);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------- map setup ----------------
  const map = L.map('map', { zoomControl: true, minZoom: mapMeta.minZoom, maxZoom: mapMeta.maxZoom, preferCanvas: true })
    .setView([mapMeta.initialLat, mapMeta.initialLng], mapMeta.initialZoom);

  // Live player dots must always sit above every other marker (default markerPane z-index 600).
  map.createPane('livePlayerPane');
  map.getPane('livePlayerPane').style.zIndex = 650;
  map.createPane('priorityMarkerPane');
  map.getPane('priorityMarkerPane').style.zIndex = 660;
  map.createPane('regionLabelPane');
  map.getPane('regionLabelPane').style.zIndex = 670;

  L.tileLayer('tiles.mapgenie.io/games/palworld/1-0/default-v1/{z}/{x}/{y}.jpg', {
    minZoom: mapMeta.minZoom, maxZoom: mapMeta.maxZoom, tileSize: 256, noWrap: true,
    keepBuffer: 3,
    attribution: I18N.t('app.attribution'),
  }).addTo(map);

  // ---------------- region borders ----------------
  const regionLayer = L.layerGroup();
  const regionBoundsById = {};
  for (const r of regions) {
    if (!r.geometry) continue;
    const rings = r.geometry.type === 'Polygon' ? [r.geometry.coordinates] : r.geometry.coordinates;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const ring of rings) {
      const latlngs = ring.map(([lng, lat]) => {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        return [lat, lng];
      });
      L.polygon(latlngs, { color: '#ffd966', weight: 1.5, fillOpacity: 0.03 }).addTo(regionLayer);
    }
    regionBoundsById[r.id] = [[minLat, minLng], [maxLat, maxLng]];
    // Most regions have no explicit label position in the data - fall back to the
    // bounding-box center so every region gets a label, not just the couple with one set.
    const labelLat = r.lat != null ? r.lat : (minLat + maxLat) / 2;
    const labelLng = r.lng != null ? r.lng : (minLng + maxLng) / 2;
    L.marker([labelLat, labelLng], {
      icon: L.divIcon({ className: 'region-label', html: '<div class="region-label-pill">' + esc(r.title) + '</div>', iconSize: [0, 0] }),
      interactive: false, pane: 'regionLabelPane',
    }).addTo(regionLayer);
  }
  if (state.showRegionBorders) regionLayer.addTo(map);

  // ---------------- heatmap ----------------
  const heatLayer = L.heatLayer([], { radius: 22 });
  let activeHeatmapCategoryId = null;
  function setHeatmapCategory(categoryId, skipPersist) {
    activeHeatmapCategoryId = categoryId;
    if (!skipPersist) { state.heatmapActiveId = categoryId; persist(); }
    if (categoryId == null) { map.removeLayer(heatLayer); return; }
    const cat = heatmapData.categories.find(c => c.id === categoryId);
    const pts = cat ? cat.points.map(([lng, lat]) => [lat, lng]) : [];
    if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
    heatLayer.setPoints(pts);
  }

  // ---------------- database editor: heatmap ----------------
  function updateHeatmapCategoryMeta(categoryId, changes) {
    const cat = heatmapData.categories.find(c => c.id === categoryId);
    if (!cat) return;
    Object.assign(cat, changes);
  }

  function addHeatmapPoints(categoryId, latLngPoints) {
    const cat = heatmapData.categories.find(c => c.id === categoryId);
    if (!cat) return;
    for (const [lat, lng] of latLngPoints) cat.points.push([lng, lat]); // stored as [lng, lat]
    if (activeHeatmapCategoryId === categoryId) setHeatmapCategory(categoryId, true);
  }

  async function saveHeatmapToDisk() {
    const res = await fetch('api/save-heatmap.php', {
      method: 'POST',
      body: JSON.stringify({ title: heatmapData.title, categories: heatmapData.categories }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function uploadPalIcon(name, dataUrl) {
    const res = await fetch('api/save-pal-icon.php', { method: 'POST', body: JSON.stringify({ name, dataUrl }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    palIcons[name] = data.iconUrl;
    return data;
  }

  // Brush tool: mousedown+drag on the map paints heatmap points along the path, sampled
  // on a fixed timer (not distance) since our CRS doesn't make on-screen-pixel distance
  // checks reliable. Panning is disabled while active so the drag paints instead of pans.
  let brushActive = false;
  let brushCategoryId = null;
  let brushPainting = false;
  let brushPoints = [];
  let brushLastSampleAt = 0;
  const BRUSH_SAMPLE_INTERVAL_MS = 90;

  function startBrush(categoryId) {
    brushActive = true;
    brushCategoryId = categoryId;
    brushPoints = [];
    map.dragging.disable();
    map.getContainer().style.cursor = 'crosshair';
  }
  function stopBrush() {
    brushActive = false;
    brushPainting = false;
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    const collected = brushPoints.length;
    if (collected) addHeatmapPoints(brushCategoryId, brushPoints);
    brushPoints = [];
    return collected;
  }
  function sampleBrushPoint(domEvent) {
    const now = Date.now();
    if (now - brushLastSampleAt < BRUSH_SAMPLE_INTERVAL_MS) return;
    brushLastSampleAt = now;
    const ll = map.mouseEventToLatLng(domEvent);
    brushPoints.push([ll.lat, ll.lng]);
    if (activeHeatmapCategoryId === brushCategoryId) {
      const cat = heatmapData.categories.find(c => c.id === brushCategoryId);
      const basePts = cat ? cat.points.map(([lng, lat]) => [lat, lng]) : [];
      heatLayer.setPoints(basePts.concat(brushPoints));
    }
  }
  map.getContainer().addEventListener('mousedown', (e) => {
    if (!brushActive) return;
    brushPainting = true;
    brushLastSampleAt = 0;
    sampleBrushPoint(e);
  }, true);
  map.getContainer().addEventListener('mousemove', (e) => {
    if (!brushActive || !brushPainting) return;
    sampleBrushPoint(e);
  }, true);
  map.getContainer().addEventListener('mouseup', () => { brushPainting = false; }, true);

  // ---------------- category markers (virtualized) ----------------
  const markersLayerGroup = L.layerGroup().addTo(map);
  const markerLayerById = new Map();
  const shownMarkerIds = new Set();

  function popupHtml(m, t) {
    const region = regionById[m.regionId];
    const completed = m.checklistTaskId && completedTaskIds.has(m.checklistTaskId);
    let html = '<div class="popup">';
    html += '<div class="popup-title-row"><b>' + esc(m.name) + '</b>' +
      '<button class="popup-edit-btn" data-marker-id="' + esc(m.id) + '" title="' + esc(I18N.t('popup.edit_marker_title')) + '">&#9998;</button></div>';
    html += '<div class="type">' + esc(t.typeName) + (region ? ' &middot; ' + esc(region.title) : '') + '</div>';
    if (m.checklistTaskId) {
      html += '<button class="popup-complete-btn' + (completed ? ' done' : '') + '" data-task="' + m.checklistTaskId + '">' +
        (completed ? I18N.t('popup.completed_undo') : I18N.t('popup.mark_complete')) + '</button>';
    }
    html += '</div>';
    return html;
  }

  function buildMarkerLayer(m) {
    const t = typeBySlug[m.typeSlug];
    if (!t || !t.icon) return null;
    const icon = L.divIcon({
      className: 'mk-' + t.typeSlug, iconSize: [t.icon.width, t.icon.height],
      iconAnchor: [t.icon.anchorX, t.icon.anchorY], popupAnchor: [0, -t.icon.height],
    });
    const marker = L.marker([m.lat, m.lng], { icon, title: m.name });
    marker.bindPopup(() => popupHtml(m, t));
    marker.on('popupopen', (e) => {
      const el = e.popup.getElement();
      const btn = el.querySelector('.popup-complete-btn');
      if (btn) btn.addEventListener('click', () => {
        toggleCompleted(m.checklistTaskId);
        marker.setPopupContent(popupHtml(m, t));
      });
      const editBtn = el.querySelector('.popup-edit-btn');
      if (editBtn) editBtn.addEventListener('click', () => {
        marker.closePopup();
        if (window.Sidebar) window.Sidebar.openMarkerEditor(m.id);
      });
    });
    if (m.checklistTaskId && completedTaskIds.has(m.checklistTaskId)) {
      marker.on('add', () => marker.getElement() && marker.getElement().classList.add('marker-completed'));
    }
    return marker;
  }

  for (const m of markers) {
    const layer = buildMarkerLayer(m);
    if (layer) markerLayerById.set(m.id, layer);
  }

  function refreshVisibleMarkers() {
    const bounds = map.getBounds().pad(0.15);
    const hideCompleted = state.hideCompletedMarkers;
    const shouldShow = new Set();
    for (const m of markers) {
      if (hiddenTypeSlugs.has(m.typeSlug)) continue;
      if (hideCompleted && m.checklistTaskId && completedTaskIds.has(m.checklistTaskId)) continue;
      if (!bounds.contains([m.lat, m.lng])) continue;
      shouldShow.add(m.id);
    }
    for (const id of shownMarkerIds) {
      if (!shouldShow.has(id)) {
        markersLayerGroup.removeLayer(markerLayerById.get(id));
        shownMarkerIds.delete(id);
      }
    }
    for (const id of shouldShow) {
      if (!shownMarkerIds.has(id)) {
        markersLayerGroup.addLayer(markerLayerById.get(id));
        shownMarkerIds.add(id);
      }
    }
  }
  map.on('moveend', refreshVisibleMarkers);
  map.on('dragstart', () => { followedPlayerKey = null; });
  refreshVisibleMarkers();

  // ---------------- database editor: markers ----------------
  // Brings a marker on-screen regardless of its category-hidden state or current
  // viewport, so the user can see and drag the *real* marker they're correcting.
  function focusMarkerForEdit(markerId) {
    const m = markers.find(mk => mk.id === markerId);
    if (!m) return null;
    let layer = markerLayerById.get(markerId);
    if (!layer) { layer = buildMarkerLayer(m); if (layer) markerLayerById.set(markerId, layer); }
    if (layer && !markersLayerGroup.hasLayer(layer)) { markersLayerGroup.addLayer(layer); shownMarkerIds.add(markerId); }
    map.setView([m.lat, m.lng], Math.max(map.getZoom(), 15));
    return { marker: m, layer };
  }

  function enableMarkerDragEdit(markerId, onMoved) {
    const focused = focusMarkerForEdit(markerId);
    if (!focused || !focused.layer) return () => {};
    const layer = focused.layer;
    layer.dragging.enable();
    const handler = () => { const ll = layer.getLatLng(); onMoved(ll.lat, ll.lng); };
    layer.on('dragend', handler);
    return () => { if (layer.dragging) layer.dragging.disable(); layer.off('dragend', handler); };
  }

  function updateMarkerData(markerId, changes) {
    const idx = markers.findIndex(mk => mk.id === markerId);
    if (idx === -1) return;
    Object.assign(markers[idx], changes);
    const m = markers[idx];
    const oldLayer = markerLayerById.get(markerId);
    if (oldLayer) { markersLayerGroup.removeLayer(oldLayer); shownMarkerIds.delete(markerId); }
    const newLayer = buildMarkerLayer(m);
    if (newLayer) markerLayerById.set(markerId, newLayer); else markerLayerById.delete(markerId);
    refreshVisibleMarkers();
  }

  async function saveMarkersToDisk() {
    const res = await fetch('api/save-markers.php', { method: 'POST', body: JSON.stringify(markers) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function toggleCompleted(taskId) {
    if (completedTaskIds.has(taskId)) completedTaskIds.delete(taskId);
    else completedTaskIds.add(taskId);
    state.completedTaskIds = [...completedTaskIds];
    persist();
    const m = markerByChecklistTaskId[taskId];
    const layer = m && markerLayerById.get(m.id);
    if (layer && layer.getElement()) {
      layer.getElement().classList.toggle('marker-completed', completedTaskIds.has(taskId));
    }
    if (state.hideCompletedMarkers) refreshVisibleMarkers();
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }

  function setCategoryHidden(typeSlug, hidden) {
    if (hidden) hiddenTypeSlugs.add(typeSlug); else hiddenTypeSlugs.delete(typeSlug);
    state.hiddenTypeSlugs = [...hiddenTypeSlugs];
    persist();
    refreshVisibleMarkers();
  }

  function setHideCompleted(hide) {
    state.hideCompletedMarkers = hide;
    persist();
    refreshVisibleMarkers();
  }

  function setShowRegionBorders(show) {
    state.showRegionBorders = show;
    persist();
    if (show) regionLayer.addTo(map); else map.removeLayer(regionLayer);
  }

  function setEncyclopediaCollapsed(collapsed) {
    state.encyclopediaCollapsed = collapsed;
    persist();
  }

  // ---------------- notes ----------------
  const notesLayerGroup = L.layerGroup().addTo(map);
  const noteMarkerById = new Map();
  function noteIcon() {
    return L.divIcon({ className: 'note-marker', html: '<div class="marker-pin note-pin"><span>&#9998;</span></div>', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26] });
  }
  function formatNoteBody(text) {
    return text.split(/\n{2,}/).map(para => '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>').join('');
  }
  function renderNoteMarker(note) {
    const marker = L.marker([note.lat, note.lng], { icon: noteIcon(), pane: 'priorityMarkerPane' });
    marker.bindPopup(() => '<div class="popup"><div class="note-popup-title">' + esc(note.title) + '</div>' +
      (note.text ? '<div class="note-popup-body">' + formatNoteBody(note.text) + '</div>' : '') + '</div>',
      { maxWidth: 300, minWidth: 180 });
    noteMarkerById.set(note.id, marker);
    marker.addTo(notesLayerGroup);
    return marker;
  }
  for (const n of state.notes) renderNoteMarker(n);

  function addNote(latlng, title, text) {
    const note = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 7), lat: latlng.lat, lng: latlng.lng, title, text, createdAt: Date.now() };
    state.notes.push(note);
    persist();
    renderNoteMarker(note);
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    persist();
    const layer = noteMarkerById.get(id);
    if (layer) { notesLayerGroup.removeLayer(layer); noteMarkerById.delete(id); }
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }

  // ---------------- custom markers ----------------
  const customLayerGroup = L.layerGroup().addTo(map);
  const customMarkerById = new Map();
  function customIcon() {
    return L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin custom-pin"><span>&#9733;</span></div>', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] });
  }
  function renderCustomMarker(cm) {
    const marker = L.marker([cm.lat, cm.lng], { icon: customIcon(), pane: 'priorityMarkerPane' });
    marker.bindPopup(() => '<div class="popup"><b>' + esc(cm.name) + '</b></div>');
    customMarkerById.set(cm.id, marker);
    marker.addTo(customLayerGroup);
    return marker;
  }
  for (const cm of state.customMarkers) renderCustomMarker(cm);

  function addCustomMarker(latlng, name) {
    const cm = { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7), lat: latlng.lat, lng: latlng.lng, name, createdAt: Date.now() };
    state.customMarkers.push(cm);
    persist();
    renderCustomMarker(cm);
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function deleteCustomMarker(id) {
    state.customMarkers = state.customMarkers.filter(m => m.id !== id);
    persist();
    const layer = customMarkerById.get(id);
    if (layer) { customLayerGroup.removeLayer(layer); customMarkerById.delete(id); }
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }

  // ---------------- dedicated servers / live players ----------------
  const liveServerData = {}; // serverId -> {online, players, error, lastUpdate}
  const livePlayerLayerGroup = L.layerGroup().addTo(map);
  const livePlayerMarkerByKey = new Map();

  const PLAYER_COLOR_PALETTE = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#ef4444',
    '#14b8a6', '#eab308', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
    '#d946ef', '#10b981', '#0ea5e9', '#f43f5e',
  ];
  function colorForPlayer(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    return PLAYER_COLOR_PALETTE[hash % PLAYER_COLOR_PALETTE.length];
  }

  function liveIcon(color) {
    return L.divIcon({
      className: 'live-player-marker',
      html: '<span style="background:' + color + ';box-shadow:0 0 6px ' + color + '"></span>',
      iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9],
    });
  }

  // Which zone a player is in can't be told from the transformed lat/lng - a wrong-zone
  // transform can still land inside the main map's (padded) marker bounding box since that
  // box covers most of the leaflet canvas. The raw in-game x/y ranges are actually disjoint
  // between zones (that's why they need separate calibrations), so use those instead.
  function xyBoundsOf(points) {
    if (!points || points.length < 2) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const padX = (maxX - minX) * 0.3, padY = (maxY - minY) * 0.3;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }
  function isWithinXYBounds(bounds, x, y) {
    return !!bounds && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  }

  // Set while a live player is "followed": the map recenters on them whenever they drift
  // outside the current viewport. Set either by opening their popup bubble (direct map
  // click) or by followPlayer() (sidebar/panel selection) - the latter never opens a popup.
  let followedPlayerKey = null;

  // Main-map calibration is fit from Palpagos Islands landmarks, so it's only valid there.
  // A player standing in the separate DLC zone (Dusty Ravine / Gilded City Ruins - an
  // alternate map that replaces the main one, with its own coordinate origin) has x/y in
  // zone2's own disjoint range, so check zone2's raw x/y bounds first, then fall back to main.
  function resolvePlayerPosition(p) {
    const zone2Transform = state.calibrationTransformZone2;
    const zone2Bounds = xyBoundsOf(state.calibrationPointsZone2);
    if (zone2Transform && isWithinXYBounds(zone2Bounds, p.location_x, p.location_y)) {
      const pos = CoordTransform.applyTransform(zone2Transform, p.location_x, p.location_y);
      if (pos) return { pos, zone: 'zone2' };
    }
    const mainTransform = state.calibrationTransform;
    if (mainTransform) {
      const pos = CoordTransform.applyTransform(mainTransform, p.location_x, p.location_y);
      if (pos) return { pos, zone: 'main' };
    }
    if (zone2Transform) {
      const pos = CoordTransform.applyTransform(zone2Transform, p.location_x, p.location_y);
      if (pos) return { pos, zone: 'zone2' };
    }
    return null;
  }

  function followPlayer(serverId, playerId) {
    followedPlayerKey = serverId + ':' + playerId;
    const data = liveServerData[serverId];
    const p = data && data.players.find(pl => pl.playerId === playerId);
    if (!p) return;
    const resolved = resolvePlayerPosition(p);
    if (!resolved) return;
    map.setView([resolved.pos.lat, resolved.pos.lng], Math.max(map.getZoom(), 15));
  }

  function refreshLivePlayers() {
    const wantedKeys = new Set();
    for (const server of state.servers) {
      const data = liveServerData[server.id];
      if (!data || !data.online) continue;
      for (const p of data.players) {
        const key = server.id + ':' + p.playerId;
        const resolved = resolvePlayerPosition(p);
        if (!resolved) continue; // no transform, or player in an unmapped zone
        const { pos, zone } = resolved;
        wantedKeys.add(key);
        let marker = livePlayerMarkerByKey.get(key);
        const color = colorForPlayer(p.userId);
        const popupHtml = () => '<div class="popup"><b>' + esc(p.name) + '</b><div class="type">' + I18N.t('app.level_abbr') + ' ' + p.level +
          ' &middot; ' + Math.round(p.ping) + 'ms &middot; ' + esc(server.name) +
          '<br>X: ' + Math.round(p.location_x) + ', Y: ' + Math.round(p.location_y) + '</div></div>';
        if (!marker) {
          marker = L.marker([pos.lat, pos.lng], { icon: liveIcon(color), pane: 'livePlayerPane', draggable: true });
          marker.bindPopup(popupHtml);
          marker._serverId = server.id;
          marker._playerId = p.playerId;
          marker.on('dragstart', () => { marker._isDragging = true; });
          marker.on('dragend', () => {
            marker._isDragging = false;
            const freshData = liveServerData[marker._serverId];
            const freshPlayer = freshData && freshData.players.find(pl => pl.playerId === marker._playerId);
            if (!freshPlayer) return; // player left before the drag committed
            const dropped = marker.getLatLng();
            addCalibrationPoint(freshPlayer.location_x, freshPlayer.location_y, dropped.lat, dropped.lng, marker._zone);
          });
          marker.on('popupopen', () => { followedPlayerKey = key; });
          marker.on('popupclose', () => { if (followedPlayerKey === key) followedPlayerKey = null; });
          livePlayerMarkerByKey.set(key, marker);
          marker.addTo(livePlayerLayerGroup);
        } else if (!marker._isDragging) {
          marker.setLatLng([pos.lat, pos.lng]);
          marker.setPopupContent(popupHtml());
        }
        marker._zone = zone;
        if (key === followedPlayerKey && !marker._isDragging && !map.getBounds().contains([pos.lat, pos.lng])) {
          map.setView([pos.lat, pos.lng], map.getZoom());
        }
      }
    }
    for (const [key, marker] of livePlayerMarkerByKey) {
      if (!wantedKeys.has(key)) {
        livePlayerLayerGroup.removeLayer(marker);
        livePlayerMarkerByKey.delete(key);
        if (followedPlayerKey === key) followedPlayerKey = null;
      }
    }
    updateMetricsOverlay();
    updatePlayersPanel();
    if (window.Sidebar) window.Sidebar.onLiveDataChanged();
  }

  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  function updateMetricsOverlay() {
    const overlayEl = document.getElementById('metricsOverlay');
    if (!overlayEl) return;
    const entry = state.servers
      .map(s => ({ server: s, data: liveServerData[s.id] }))
      .find(e => e.data && e.data.online && e.data.metrics);
    if (!entry) { overlayEl.style.display = 'none'; return; }
    const m = entry.data.metrics;
    overlayEl.style.display = 'block';
    overlayEl.innerHTML =
      '<div class="m-title">' + esc(entry.server.name) + '</div>' +
      '<div class="m-row"><span>' + I18N.t('app.metrics_players') + '</span><b>' + m.currentplayernum + ' / ' + m.maxplayernum + '</b></div>' +
      '<div class="m-row"><span>' + I18N.t('app.metrics_server_fps') + '</span><b>' + Math.round(m.serverfps) + '</b></div>' +
      '<div class="m-row"><span>' + I18N.t('app.metrics_uptime') + '</span><b>' + formatUptime(m.uptime) + '</b></div>' +
      '<div class="m-row"><span>' + I18N.t('app.metrics_day') + '</span><b>' + m.days + '</b></div>' +
      '<div class="m-row"><span>' + I18N.t('app.metrics_base_camps') + '</span><b>' + m.basecampnum + '</b></div>';
  }

  function updatePlayersPanel() {
    const panelEl = document.getElementById('playersPanel');
    if (!panelEl) return;
    const rows = [];
    for (const server of state.servers) {
      const data = liveServerData[server.id];
      if (!data || !data.online) continue;
      for (const p of data.players) rows.push({ server, p });
    }
    if (!rows.length) { panelEl.style.display = 'none'; return; }
    panelEl.style.display = 'block';
    panelEl.innerHTML = '<div class="m-title">' + I18N.t('app.players_panel_title') + ' (' + rows.length + ')</div>' +
      rows.map(({ server, p }) => {
        const color = colorForPlayer(p.userId);
        return '<div class="player-panel-row" data-server="' + esc(server.id) + '" data-player="' + esc(p.playerId) + '">' +
          '<span class="player-dot" style="background:' + color + '"></span>' +
          '<span class="player-panel-name">' + esc(p.name) + '</span>' +
          '<span class="player-panel-lvl">' + I18N.t('app.level_abbr') + ' ' + p.level + '</span></div>';
      }).join('');
    panelEl.querySelectorAll('.player-panel-row').forEach((row) => {
      row.addEventListener('click', () => {
        const serverId = row.dataset.server, playerId = row.dataset.player;
        followPlayer(serverId, playerId);
      });
    });
  }

  // Passwords are session-only in memory unless the user opts into rememberPassword;
  // never written to state/localStorage in that (default) case.
  const sessionCredentials = new Map();

  function runtimeServer(server) {
    const password = server.rememberPassword ? server.password : (sessionCredentials.get(server.id) || '');
    return Object.assign({}, server, { password });
  }
  function stripPasswordForStorage(serverConfig) {
    const copy = Object.assign({}, serverConfig);
    if (!copy.rememberPassword) {
      sessionCredentials.set(copy.id, copy.password || '');
      delete copy.password;
    }
    return copy;
  }

  // In-memory only (not persisted) - a rolling recent-trend window, not a permanent log.
  const metricsHistory = {};
  function recordMetricsSample(serverId, metrics) {
    if (!metrics) return;
    const list = metricsHistory[serverId] || (metricsHistory[serverId] = []);
    list.push({ recordedAt: Date.now(), metrics });
    if (list.length > 60) list.shift();
  }

  function startServerPolling(server) {
    PalServerAPI.startPolling(runtimeServer(server), 10000, (serverId, data) => {
      liveServerData[serverId] = data;
      if (data.online) recordMetricsSample(serverId, data.metrics);
      refreshLivePlayers(); // this alone triggers Sidebar.onLiveDataChanged, which patches in place
    });
  }
  function stopServerPolling(serverId) {
    PalServerAPI.stopPolling(serverId);
    delete liveServerData[serverId];
    refreshLivePlayers();
  }
  function addServer(serverConfig) {
    const stored = stripPasswordForStorage(serverConfig);
    state.servers.push(stored);
    persist();
    if (stored.enabled) startServerPolling(stored);
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function updateServer(serverId, newConfig) {
    const idx = state.servers.findIndex(s => s.id === serverId);
    if (idx === -1) return;
    stopServerPolling(serverId);
    const stored = stripPasswordForStorage(newConfig);
    state.servers[idx] = stored;
    persist();
    if (stored.enabled) startServerPolling(stored);
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function deleteServer(serverId) {
    stopServerPolling(serverId);
    sessionCredentials.delete(serverId);
    state.servers = state.servers.filter(s => s.id !== serverId);
    persist();
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function toggleServerEnabled(serverId, enabled) {
    const server = state.servers.find(s => s.id === serverId);
    if (!server) return;
    server.enabled = enabled;
    persist();
    if (enabled) startServerPolling(server); else stopServerPolling(serverId);
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function setSessionPassword(serverId, password) {
    sessionCredentials.set(serverId, password);
    const server = state.servers.find(s => s.id === serverId);
    if (server && server.enabled) startServerPolling(server);
  }
  function needsPassword(serverId) {
    const server = state.servers.find(s => s.id === serverId);
    if (!server || server.rememberPassword) return false;
    return !sessionCredentials.get(serverId);
  }
  for (const server of state.servers) {
    if (server.enabled && (server.rememberPassword || sessionCredentials.has(server.id))) startServerPolling(server);
  }

  // ---------------- admin actions (wrap PalServerAPI calls with the real runtime credentials) ----------------
  function withRuntimeServer(serverId) {
    const server = state.servers.find(s => s.id === serverId);
    if (!server) throw new Error('server not found');
    return runtimeServer(server);
  }
  function announceToServer(serverId, message) { return PalServerAPI.announce(withRuntimeServer(serverId), message); }
  function kickPlayer(serverId, userid, message) { return PalServerAPI.kick(withRuntimeServer(serverId), userid, message); }
  async function banPlayer(serverId, userid, message, name) {
    const result = await PalServerAPI.ban(withRuntimeServer(serverId), userid, message);
    const bans = state.serverBans[serverId] || (state.serverBans[serverId] = []);
    const existing = bans.find(b => b.userid === userid);
    if (existing) { existing.name = name || existing.name; existing.bannedAt = Date.now(); }
    else bans.push({ userid, name: name || '', bannedAt: Date.now() });
    persist();
    if (window.Sidebar) window.Sidebar.onStateChanged();
    return result;
  }
  async function unbanPlayer(serverId, userid) {
    const result = await PalServerAPI.unban(withRuntimeServer(serverId), userid);
    if (state.serverBans[serverId]) state.serverBans[serverId] = state.serverBans[serverId].filter(b => b.userid !== userid);
    persist();
    if (window.Sidebar) window.Sidebar.onStateChanged();
    return result;
  }
  function saveServerWorld(serverId) { return PalServerAPI.save(withRuntimeServer(serverId)); }
  function shutdownServer(serverId, waittime, message) { return PalServerAPI.shutdown(withRuntimeServer(serverId), waittime, message); }
  function forceStopServer(serverId) { return PalServerAPI.forceStop(withRuntimeServer(serverId)); }
  function getServerMetrics(serverId) { return PalServerAPI.getMetrics(withRuntimeServer(serverId)); }
  function getServerInfo(serverId) { return PalServerAPI.getInfo(withRuntimeServer(serverId)); }
  function getServerSettings(serverId) { return PalServerAPI.getSettings(withRuntimeServer(serverId)); }
  function getBanList(serverId) { return state.serverBans[serverId] || []; }
  function getMetricsHistory(serverId) { return metricsHistory[serverId] || []; }

  // ---------------- map calibration ----------------
  let pendingCalibrationResolve = null;
  function captureCalibrationPoint() {
    setPlacementMode('calibrate');
    return new Promise((resolve) => { pendingCalibrationResolve = resolve; });
  }
  // zone: 'main' (Palpagos Islands) or 'zone2' (Dusty Ravine / Gilded City Ruins - the
  // alternate DLC map that replaces the main one while a player is there). Each zone keeps
  // its own points/transform since they don't share a coordinate origin.
  function calibKeys(zone) {
    return zone === 'zone2'
      ? { points: 'calibrationPointsZone2', transform: 'calibrationTransformZone2' }
      : { points: 'calibrationPoints', transform: 'calibrationTransform' };
  }
  function addCalibrationPoint(x, y, lat, lng, zone) {
    const keys = calibKeys(zone);
    state[keys.points].push({ x, y, lat, lng, createdAt: Date.now() });
    recomputeCalibration(zone);
    persist();
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function deleteCalibrationPoint(index, zone) {
    const keys = calibKeys(zone);
    state[keys.points].splice(index, 1);
    recomputeCalibration(zone);
    persist();
    if (window.Sidebar) window.Sidebar.onStateChanged();
  }
  function recomputeCalibration(zone) {
    const keys = calibKeys(zone);
    state[keys.transform] = CoordTransform.computeTransform(state[keys.points]);
    refreshLivePlayers();
  }

  // ---------------- placement mode (click map to add note/marker/calibration point) ----------------
  // Capture-phase DOM listener: Leaflet markers stopPropagation() on click by default,
  // which would silently swallow placement clicks that land on top of an existing marker.
  let placementMode = null;
  map.getContainer().addEventListener('click', async (domEvent) => {
    if (!placementMode) return;
    const point = map.mouseEventToContainerPoint(domEvent);
    const latlng = map.containerPointToLatLng(point);
    const mode = placementMode;
    if (mode === 'note') {
      setPlacementMode(null);
      const result = await showNoteForm(I18N.t('ctx.add_note_title'));
      if (result) addNote(latlng, result.title, result.text);
    } else if (mode === 'marker') {
      setPlacementMode(null);
      const name = await showPrompt(I18N.t('ctx.add_marker_title'), I18N.t('ctx.marker_name_placeholder'));
      if (name) addCustomMarker(latlng, name);
    } else if (mode === 'calibrate') {
      setPlacementMode(null);
      if (pendingCalibrationResolve) { pendingCalibrationResolve(latlng); pendingCalibrationResolve = null; }
    }
  }, true);
  function setPlacementMode(mode) {
    placementMode = mode;
    map.getContainer().style.cursor = mode ? 'crosshair' : '';
    if (window.Sidebar) window.Sidebar.onPlacementModeChanged(mode);
  }

  // ---------------- right-click context menu (add marker/note at the clicked point) ----------------
  let mapContextMenuEl = null;
  function closeMapContextMenu() {
    if (mapContextMenuEl) { mapContextMenuEl.remove(); mapContextMenuEl = null; }
  }
  map.getContainer().addEventListener('contextmenu', (domEvent) => {
    domEvent.preventDefault();
    closeMapContextMenu();
    const point = map.mouseEventToContainerPoint(domEvent);
    const latlng = map.containerPointToLatLng(point);

    const menu = document.createElement('div');
    menu.className = 'map-context-menu';
    menu.style.left = domEvent.clientX + 'px';
    menu.style.top = domEvent.clientY + 'px';

    const markerItem = document.createElement('div');
    markerItem.className = 'map-context-menu-item';
    markerItem.textContent = I18N.t('ctx.add_marker_here');
    markerItem.addEventListener('click', async () => {
      closeMapContextMenu();
      const name = await showPrompt(I18N.t('ctx.add_marker_title'), I18N.t('ctx.marker_name_placeholder'));
      if (name) addCustomMarker(latlng, name);
    });

    const noteItem = document.createElement('div');
    noteItem.className = 'map-context-menu-item';
    noteItem.textContent = I18N.t('ctx.add_note_here');
    noteItem.addEventListener('click', async () => {
      closeMapContextMenu();
      const result = await showNoteForm(I18N.t('ctx.add_note_title'));
      if (result) addNote(latlng, result.title, result.text);
    });

    menu.append(markerItem, noteItem);
    document.body.appendChild(menu);
    mapContextMenuEl = menu;
  }, true);
  document.addEventListener('click', closeMapContextMenu);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMapContextMenu(); });

  function panToMarker(m, zoom) {
    followedPlayerKey = null;
    map.setView([m.lat, m.lng], zoom || Math.max(map.getZoom(), 14));
    setTimeout(() => {
      const layer = markerLayerById.get(m.id);
      if (layer) { if (!markersLayerGroup.hasLayer(layer)) markersLayerGroup.addLayer(layer); layer.openPopup(); }
    }, 350);
  }

  function fitRegion(regionId) {
    followedPlayerKey = null;
    const b = regionBoundsById[regionId];
    if (b) map.fitBounds(b);
  }

  window.App = {
    map, mapMeta, types, typeBySlug, markers, regions, regionById, regionBoundsById,
    checklistData, heatmapData, markerByChecklistTaskId, palIcons, checklistTaskNames,
    state, persist, esc,
    completedTaskIds, hiddenTypeSlugs,
    toggleCompleted, setCategoryHidden, setHideCompleted, setShowRegionBorders, setEncyclopediaCollapsed,
    setHeatmapCategory, panToMarker, fitRegion,
    addNote, deleteNote, addCustomMarker, deleteCustomMarker, setPlacementMode,
    getPlacementMode: () => placementMode,
    getHeatmapActiveId: () => activeHeatmapCategoryId,
    refreshVisibleMarkers,
    addServer, updateServer, deleteServer, toggleServerEnabled, setSessionPassword, needsPassword,
    announceToServer, kickPlayer, banPlayer, unbanPlayer, saveServerWorld, shutdownServer, forceStopServer, getServerMetrics,
    getServerInfo, getServerSettings, getBanList, getMetricsHistory,
    getLiveServerData: () => liveServerData,
    followPlayer,
    captureCalibrationPoint, addCalibrationPoint, deleteCalibrationPoint, refreshLivePlayers,
    focusMarkerForEdit, enableMarkerDragEdit, updateMarkerData, saveMarkersToDisk,
    updateHeatmapCategoryMeta, addHeatmapPoints, saveHeatmapToDisk, uploadPalIcon,
    startBrush, stopBrush,
  };

  if (state.heatmapActiveId != null) setHeatmapCategory(state.heatmapActiveId, true);

  window.Sidebar.init();
})();
