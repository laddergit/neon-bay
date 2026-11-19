// Neon Bay local server: serves game/ at http://localhost:8080 for playtesting.
// Standard library only. Run it with: node serve.ts
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:8080');
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = join(gameDir, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(8080, () => console.log('Neon Bay running at http://localhost:8080'));
