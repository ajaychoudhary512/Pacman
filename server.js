const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || process.argv[2] || '8000', 10);
const BASE_DIR = __dirname;
const WEB_DIR = path.join(BASE_DIR, 'web');
function findLayoutsDir() {
  const candidates = [
    path.join(BASE_DIR, 'Pacman-Game-master', 'Pacman', 'layouts'),
    path.join(BASE_DIR, 'Pacman', 'layouts'),
    path.join(BASE_DIR, 'layouts'),
    path.join(process.cwd(), 'Pacman-Game-master', 'Pacman', 'layouts'),
    path.join(process.cwd(), 'Pacman', 'layouts'),
    path.join(process.cwd(), 'layouts'),
    path.join(__dirname, 'Pacman-Game-master', 'Pacman', 'layouts'),
    path.join(__dirname, 'Pacman', 'layouts'),
  ];
  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        return cand;
      }
    } catch (e) {}
  }
  return candidates[0];
}

const LAYOUTS_DIR = findLayoutsDir();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:8000'}`);
  const pathname = reqUrl.pathname;

  // Enable CORS & no-cache for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Get layout list
  if (pathname === '/api/layouts') {
    try {
      let layouts = [];
      if (fs.existsSync(LAYOUTS_DIR)) {
        const files = fs.readdirSync(LAYOUTS_DIR);
        layouts = files
          .filter(f => f.endsWith('.lay'))
          .map(f => f.slice(0, -4))
          .sort();
      }
      if (layouts.length === 0) {
        layouts = [
          'bigMaze', 'mediumClassic', 'mediumMaze', 'originalClassic',
          'smallClassic', 'tinyMaze', 'trickySearch'
        ];
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ layouts }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Get specific layout
  if (pathname === '/api/layout') {
    const layoutName = reqUrl.searchParams.get('name') || 'originalClassic';
    let filePath = path.join(LAYOUTS_DIR, `${layoutName}.lay`);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(LAYOUTS_DIR, 'originalClassic.lay');
    }

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter((line, idx, arr) => idx < arr.length - 1 || line.trim() !== '');
        const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
        const height = lines.length;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          name: layoutName,
          grid: lines,
          width,
          height
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Layout not found' }));
    }
    return;
  }

  // Serve static files from web/
  let reqPath = decodeURIComponent(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(path.join(WEB_DIR, reqPath));
  if (!safePath.startsWith(WEB_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(` Pacman Web App running at: http://localhost:${PORT}`);
  console.log('==================================================');
});
