// Core hosting logic for the Palworld Companion App, shared between the plain-Node
// launcher (server.js, opens the system browser) and the Electron wrapper
// (electron-main.js, opens a native window). Serves www/ statically (fast, concurrent -
// unlike PHP's single-threaded built-in server, which matters once a page like
// items.html requests 2000+ icon images at once) and proxies api/*.php requests to a
// spawned php.exe -S child process, since PHP itself still needs to execute those scripts.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, 'www');
const PORT = 8090;
const PHP_PORT = 8091;
const PHP_EXE = path.join(__dirname, 'php', 'php.exe');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function proxyToPhp(req, res) {
  const proxyReq = http.request(
    { hostname: '127.0.0.1', port: PHP_PORT, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  req.pipe(proxyReq);
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('PHP backend error: ' + err.message);
  });
}

function handleRequest(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath.endsWith('.php') || urlPath.startsWith('/api/')) {
    return proxyToPhp(req, res);
  }

  const relPath = urlPath === '/' || urlPath === '' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(ROOT, relPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

// Starts the php.exe backend + the Node static/proxy server. Calls onReady(url) once
// the Node server is listening (php.exe's own startup is fire-and-forget - its built-in
// dev server binds near-instantly and requests to it during the brief startup window
// simply queue, same as they would against any other backend under load).
function startServer(onReady) {
  const php = spawn(PHP_EXE, ['-S', '127.0.0.1:' + PHP_PORT, '-t', ROOT], { cwd: ROOT });
  php.stdout.on('data', d => process.stdout.write(d));
  php.stderr.on('data', d => process.stderr.write(d));
  php.on('exit', (code) => console.error('php.exe exited unexpectedly with code', code));

  const server = http.createServer(handleRequest);
  server.listen(PORT, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + PORT + '/index.html';
    console.log('Palworld Companion App server running at ' + url);
    if (onReady) onReady(url);
  });

  function shutdown() {
    console.log('Shutting down...');
    php.kill();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { server, php, shutdown };
}

module.exports = { startServer, PORT };
