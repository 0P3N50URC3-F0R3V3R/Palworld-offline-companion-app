(function () {
  // Palworld's main map (Palpagos Islands) is identical for every dedicated server, so this
  // calibration — derived from 5 real in-game landmark positions — is baked in as the default
  // for fresh installs instead of requiring every user to recalibrate from scratch.
  // The separate DLC zone (Dusty Ravine / Gilded City Ruins - one alternate map that replaces
  // the main one while a player is there) has its own coordinate origin, so it gets its own
  // calibrationPoints/Transform pair (zone2) instead of a default - each server has to
  // calibrate that zone from scratch since we have no baked-in landmark positions for it yet.
  const DEFAULT_CALIBRATION_POINTS = [
    { x: 192481.203125, y: -226931.359375, lat: 0.8457878002866712, lng: -0.876760482788086, createdAt: 1784282311819 },
    { x: -451581.875, y: 363292.15625, lat: 0.5547794435257372, lng: -0.6099987030029298, createdAt: 1784282342987 },
    { x: 191086.375, y: 375111.65625, lat: 0.845401604251161, lng: -0.6044626235961915, createdAt: 1784282385564 },
    { x: -33958.265625, y: 564271.25, lat: 0.7432943699642088, lng: -0.5191040039062501, createdAt: 1784282445620 },
    { x: -568674.0625, y: -603377.0625, lat: 0.5019314460630451, lng: -1.0471343994140627, createdAt: 1784282598515 },
  ];
  const DEFAULT_CALIBRATION_TRANSFORM = {
    latCoef: [4.5194611960415437e-7, -8.897730370487186e-11, 0.7588665667590475],
    lngCoef: [2.3804638425158636e-10, 4.5215931367234436e-7, -0.7741771087460079],
  };

  // Dusty Ravine / Gilded City Ruins (DLC zone2) - calibrated from 4 real in-game landmark
  // positions gathered on the hostable dedicated-server client; baked in here too so offline
  // installs plot zone2 players correctly instead of needing to recalibrate from scratch.
  const DEFAULT_CALIBRATION_POINTS_ZONE2 = [
    { x: 500912.125, y: -750588.8125, lat: 0.9905011778338688, lng: -1.2786197662353518, createdAt: 1788762152077 },
    { x: 628463.1875, y: -610808.4375, lat: 1.2637758590331654, lng: -0.979135036468506, createdAt: 1788762180181 },
    { x: 512451.6875, y: -510657.1875, lat: 1.015452626839855, lng: -0.7643866539001466, createdAt: 1788762210213 },
    { x: 406086.15625, y: -729425.9375, lat: 0.7879008866661344, lng: -1.233172416687012, createdAt: 1788762248765 },
  ];
  const DEFAULT_CALIBRATION_TRANSFORM_ZONE2 = {
    latCoef: [0.0000021396772408676773, 7.236612765407475e-10, -0.08059000767988132],
    lngCoef: [-8.659753430843868e-10, 0.000002143280893245855, 0.33054068772465905],
  };

  // Servers + calibration are shared across every profile on this machine (same LAN server,
  // same map, for every kid). Everything else — notes, custom markers, category visibility,
  // checklists, active heatmap — is private per profile.
  const SHARED_KEYS = ['servers', 'serverBans', 'calibrationPoints', 'calibrationTransform', 'calibrationPointsZone2', 'calibrationTransformZone2'];
  const PROFILE_KEYS = [
    'initialized', 'completedTaskIds', 'notes', 'customMarkers', 'hiddenTypeSlugs',
    'hideCompletedMarkers', 'showRegionBorders', 'heatmapActiveId', 'encyclopediaCollapsed',
  ];

  function defaultSharedState() {
    return {
      servers: [],
      serverBans: {},
      calibrationPoints: DEFAULT_CALIBRATION_POINTS.map(p => ({ ...p })),
      calibrationTransform: { latCoef: [...DEFAULT_CALIBRATION_TRANSFORM.latCoef], lngCoef: [...DEFAULT_CALIBRATION_TRANSFORM.lngCoef] },
      calibrationPointsZone2: DEFAULT_CALIBRATION_POINTS_ZONE2.map(p => ({ ...p })),
      calibrationTransformZone2: { latCoef: [...DEFAULT_CALIBRATION_TRANSFORM_ZONE2.latCoef], lngCoef: [...DEFAULT_CALIBRATION_TRANSFORM_ZONE2.lngCoef] },
    };
  }

  function defaultProfileState() {
    return {
      initialized: false,
      completedTaskIds: [],
      notes: [],
      customMarkers: [],
      hiddenTypeSlugs: [],
      hideCompletedMarkers: false,
      showRegionBorders: false,
      heatmapActiveId: null,
      encyclopediaCollapsed: false,
    };
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function listProfiles() {
    try {
      const data = await fetchJson('api/list-profiles.php');
      return data.profiles || [];
    } catch (e) {
      return [];
    }
  }

  async function createProfile(name) {
    return fetchJson('api/create-profile.php', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async function deleteProfile(name) {
    return fetchJson('api/delete-profile.php', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async function getActiveProfileName() {
    try {
      const data = await fetchJson('api/active-profile.php');
      return data.name || null;
    } catch (e) {
      return null;
    }
  }

  async function setActiveProfileName(name) {
    return fetchJson('api/active-profile.php', { method: 'POST', body: JSON.stringify({ name }) });
  }

  // Loads the currently-active profile's state merged with the shared (servers/calibration)
  // state into one flat object, the shape app.js has always worked with.
  async function load() {
    const profiles = await listProfiles();
    const active = await getActiveProfileName();

    let shared = {};
    try { shared = await fetchJson('api/load-shared-state.php'); } catch (e) { /* use defaults */ }

    let profileData = {};
    if (active) {
      try { profileData = await fetchJson('api/load-state.php?user=' + encodeURIComponent(active)); } catch (e) { /* use defaults */ }
    }

    const state = Object.assign(defaultSharedState(), shared, defaultProfileState(), profileData);
    state.activeProfile = active;
    state.profiles = profiles;
    return state;
  }

  // Serialize writes so overlapping persist() calls can't race each other
  // (JSON.stringify happens at call time, so later calls always reflect the newest state).
  let saveQueue = Promise.resolve();
  function save(state) {
    const shared = {};
    for (const k of SHARED_KEYS) shared[k] = state[k];
    const profile = {};
    for (const k of PROFILE_KEYS) profile[k] = state[k];
    const sharedBody = JSON.stringify(shared);
    const profileBody = JSON.stringify(profile);
    const user = state.activeProfile;

    saveQueue = saveQueue
      .then(() => Promise.all([
        fetch('api/save-shared-state.php', { method: 'POST', body: sharedBody }),
        user ? fetch('api/save-state.php?user=' + encodeURIComponent(user), { method: 'POST', body: profileBody }) : Promise.resolve({ ok: true }),
      ]))
      .then(([r1, r2]) => { if (!r1.ok || !r2.ok) console.error('state save failed'); })
      .catch((e) => console.error('state save failed:', e.message));
    return saveQueue;
  }

  window.AppState = {
    load, save, listProfiles, createProfile, deleteProfile,
    getActiveProfileName, setActiveProfileName,
  };
})();
