// Plain-Node launcher: starts the app server and opens it in the system's default
// browser. Use electron-main.js instead (via electron-start.bat) for a native window
// with the dedicated-server CORS restriction lifted.
const { exec } = require('child_process');
const { startServer } = require('./app-server');

startServer((url) => exec('start "" "' + url + '"'));
