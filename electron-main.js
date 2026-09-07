// Native desktop window for the Palworld Companion App (replaces the old CEF host).
// webSecurity is disabled to match the old CEF app's "disable-web-security" flag -
// without it, fetches from server-api.js to a user's dedicated Palworld server fail
// CORS (that REST API is a raw game-server admin API, not built to send CORS headers
// for browser access), which is exactly the "can't connect to the dedicated server"
// regression introduced by the brief plain-browser setup.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { startServer, PORT } = require('./app-server');

Menu.setApplicationMenu(null);

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Palworld Companion App',
    icon: path.join(__dirname, 'www', 'app-icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.maximize();
  win.loadURL(url);
}

app.whenReady().then(() => {
  startServer((url) => createWindow(url));
});

app.on('window-all-closed', () => app.quit());
