const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const types = { 'index.html': 'text/html', 'style.css': 'text/css', 'app.js': 'text/javascript', 'config.js': 'text/javascript' };
const port = Number(process.env.PORT || 8765);
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!Object.hasOwn(types, name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(root, name), (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[name] + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '預覽連接埠已被使用。' : error.message); process.exitCode = 1; });
server.listen(port, '0.0.0.0', () => console.log('預覽：http://localhost:' + port));
