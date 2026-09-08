# Palworld Companion App (Offline / Desktop)

A standalone, fully offline Palworld interactive map and encyclopedia that runs entirely on your own machine as a desktop app — no account, no internet connection, and no external server required after installation. It bundles its own PHP runtime, Node.js runtime, and Electron shell so it works out of the box on a bare Windows machine.

This is the **offline desktop** sibling of `PalworldHostableMap` (the multi-user, web-hosted version with accounts and a dedicated-server admin panel). Both share the same map/encyclopedia frontend code; this version trades accounts/roles/hosting for local "profiles" and zero setup.

## Contents

- [Features](#features)
- [How it's put together](#how-its-put-together)
- [Tech stack & bundled runtimes](#tech-stack--bundled-runtimes)
- [System requirements](#system-requirements)
- [Running the app](#running-the-app)
- [API reference](#api-reference)
- [Frontend module reference](#frontend-module-reference)
- [Data & storage](#data--storage)
- [Internationalization](#internationalization)

## Features

### Offline interactive map & encyclopedia
- **Leaflet-based world map**, fully tiled locally (~522 MB of pre-downloaded map tiles under `www/tiles.mapgenie.io/`) so panning/zooming works with **no internet connection**.
- Marker sidebar, regions, and a density **heatmap** covering 11,000+ points of interest.
- The same encyclopedia page set as the hosted version, each backed by static local JSON (`www/data/`):
  `pals.html`, `items.html`, `structures.html`, `breeding.html`, `tech.html`, `expeditions.html`, `skills.html`, `type-chart.html`, `compare.html`.

### Local "profiles" instead of accounts
- No login system. Instead, multiple **named local profiles** can be created, listed, and deleted (`create-profile.php`, `list-profiles.php`, `delete-profile.php`, `active-profile.php`), each with its own saved state file under `www/data-store/profiles/`.
- Per-profile state save/load (`save-state.php` / `load-state.php`) and a separate **shared state** that all profiles see (`save-shared-state.php` / `load-shared-state.php`) — e.g. for data that shouldn't be duplicated per profile.
- Personal map markers and the heatmap are still saved locally (`save-markers.php`, `save-heatmap.php`), same as the hosted version, just without a per-user owner column since there's only one local user at a time.

### Sidebar notes
- The same rich-text **Quill.js** sidebar notes editor as the hosted version (`sidenotes.js`, `sidenotes-load.php` / `sidenotes-save.php`), profile-keyed instead of account-keyed.

### Direct dedicated-server connection
- If you run your own Palworld dedicated server, `js/server-api.js` lets the app talk to its REST admin API **directly from the browser/Electron renderer** (Basic auth, JSON) — unlike the hosted version, there's no PHP proxy in between, since there's no multi-user admin boundary to enforce locally.
- The Electron shell deliberately runs with `webSecurity: false` to allow this direct cross-origin fetch to your dedicated server (a raw game-server admin API that doesn't send CORS headers for browser clients) — see `electron-main.js`.

### Internationalization
- Same 29-language UI translation set as the hosted version (`www/lang/*.json`), loaded by `i18n.js`.

## How it's put together

There's no build step and no framework — same as the hosted version, plain PHP + vanilla JS — but this repo also bundles everything needed to run that PHP/JS app **without the user installing anything**:

```
PalworldOfflineMap/
├── PalworldCompanion.exe     ← branded launcher (starts the app)
├── start.bat                 ← launches electron\electron.exe . (native window)
├── start-browser.bat         ← launches node.exe server.js (opens system browser instead)
├── electron-main.js          ← Electron entry point: creates the app window
├── server.js                 ← plain-Node entry point: opens system browser instead of a native window
├── app-server.js             ← shared hosting logic used by both entry points (see below)
├── electron/                 ← bundled Electron runtime (~165 MB)
├── php/                      ← bundled PHP CLI runtime (~56 MB)
├── node.exe                  ← bundled Node.js runtime
└── www/                      ← the app itself (same shape as PalworldHostableMap/www)
    ├── index.html, pals.html, ...
    ├── js/, css/, vendor/, lang/, data/
    ├── data-store/            ← profiles/, markers, heatmap, sidenotes (writable, runtime state)
    └── api/                   ← PHP endpoints (profile-based, no auth)
```

**Request flow** (`app-server.js`): a Node.js HTTP server listens on port **8090** and serves `www/` directly as static files (fast and concurrent — important since pages like `items.html` request 2000+ icon images at once, which PHP's single-threaded built-in dev server would serialize). It spawns `php/php.exe -S 127.0.0.1:8091` as a child process and transparently reverse-proxies any request for `*.php` or `/api/*` to that PHP server. This lets the same PHP backend code run unmodified, while Node handles fast static-asset serving.

Two ways to start that server:
- **`electron-main.js`** (used by `start.bat` / `PalworldCompanion.exe`) — wraps it in a native Electron window (1400×900, maximized on launch), titled "Palworld Companion App".
- **`server.js`** (used by `start-browser.bat`) — starts the same server and opens it in your system's default web browser instead of a native window.

## Tech stack & bundled runtimes

| Component | Version found in this repo |
|---|---|
| Bundled Node.js (`node.exe`) | v24.16.0 |
| Bundled PHP (`php/php.exe`) | PHP 8.3.32 (NTS, Visual C++ 2019 x64 build) |
| Bundled Electron (`electron/`) | version file reports `8.3.0` |
| Map rendering | Leaflet.js (vendored, `www/vendor/leaflet`) |
| Rich text editor | Quill.js (vendored, `www/vendor/quill`) |
| Frontend | Vanilla JavaScript, no bundler/framework |
| Backend | Plain procedural PHP, no framework |
| Local persistence | Flat JSON files under `www/data-store/` (no database engine) |

No `npm install` or `composer install` is needed — the runtimes and all dependencies (Leaflet, Quill) are vendored directly in the repo.

## System requirements

- **Windows only** — the repo bundles Windows binaries exclusively (`electron.exe`, `php.exe`, `node.exe`, and Windows-specific DLLs such as `libGLESv2.dll`, `d3dcompiler_47.dll`, `vk_swiftshader.dll`).
- **~2.6 GB of free disk space** for the full install (the map tiles alone are ~522 MB; Electron runtime ~165 MB; PHP runtime ~56 MB; encyclopedia data ~9 MB).
- **No internet connection required to run** — all map tiles, icons, and encyclopedia data are bundled locally. Internet is only needed if you connect the app to your own dedicated server over your network, or to re-run the data scraper for updates.
- Local TCP ports **8090** (Node static/proxy server) and **8091** (internal PHP server, loopback-only) must be free.
- A writable `www/data-store/` directory for profiles, markers, heatmap, and notes.

## Running the app

Pick one:
- **Double-click `PalworldCompanion.exe`** or run **`start.bat`** — opens the app in its own native window (recommended; this is the only mode where the direct dedicated-server connection works without CORS issues, since `webSecurity` is disabled only in the Electron window).
- Run **`start-browser.bat`** — starts the same backend and opens the app in your default web browser instead of a native window.

To stop the app, close its window (or Ctrl+C the console for `start-browser.bat`) — both entry points cleanly shut down the spawned PHP child process on exit (`SIGINT`/`SIGTERM` handlers in `app-server.js`).

## API reference

All endpoints live in `www/api/` and return JSON. Files prefixed `_` are shared includes, not routes. There is **no authentication** — every endpoint operates on whichever local profile is currently active.

**Profiles**: `list-profiles.php`, `create-profile.php`, `delete-profile.php`, `active-profile.php`

**State**: `save-state.php` / `load-state.php` (per-profile), `save-shared-state.php` / `load-shared-state.php` (shared across all profiles)

**Map data**: `save-markers.php`, `save-heatmap.php`, `save-pal-icon.php`

**Notes**: `sidenotes-load.php`, `sidenotes-save.php`

## Frontend module reference

| File | Responsibility |
|---|---|
| `js/app.js` | Main map bootstrap: Leaflet init, marker/heatmap loading |
| `js/server-api.js` | Direct browser → dedicated-server REST client (Basic auth), unique to this offline build |
| `js/state.js` | Shared client-side app state |
| `js/sidebar.js` | Sidebar navigation (no admin views — those are hosted-version-only) |
| `js/sidenotes.js` | Rich-text sidebar notes (Quill integration) |
| `js/modal.js` | Reusable modal dialog component |
| `js/heatlayer.js` | Marker density heatmap layer for Leaflet |
| `js/coord-transform.js` | In-game ↔ map-pixel coordinate calibration math |
| `js/i18n.js` | Loads `lang/*.json` and resolves translation keys |
| `js/pals.js`, `items.js`, `structures.js`, `breeding.js`, `tech.js`, `expeditions.js`, `skills.js`, `type-chart.js`, `compare.js` | One file per encyclopedia page, rendering `www/data/*.json` |

## Data & storage

- `www/data/*.json` — static, pre-generated encyclopedia content (Pals, Items, Structures, Breeding, Tech, Expeditions, Skills, Types, Regions, Map, Shops, Checklists), bundled read-only.
- `www/tiles.mapgenie.io/` and `www/cdn.mapgenie.io/` — pre-downloaded map tile and icon assets that make the map fully offline-capable.
- `www/data-store/profiles/state_<name>.json` — one JSON file per local profile (name restricted to 1–30 chars of letters/digits/space/`_`/`-`), created on demand.
- No database engine (SQLite/MySQL/etc.) is used in this build — everything is flat JSON on disk, consistent with a single-user, no-network-hosting design.

## Internationalization

Same translation set as the hosted version — `www/lang/*.json` covering 29 languages (Steam-style region codes: `schinese`, `tchinese`, `brazilian`, `latam`, `koreana`, etc.), loaded client-side by `i18n.js`.
