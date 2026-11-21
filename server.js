/**
 * Servidor de desenvolvimento e produção local para Casa Luce
 * Roda tanto os arquivos estáticos quanto as rotas serverless /api/*
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const pixHandler = require('./api/pix');
const statusHandler = require('./api/pix/status');
const webhookHandler = require('./api/webhook/elevypay');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Rotas de API
  if (pathname === '/api/pix' || pathname === '/api/pix/') {
    return pixHandler(req, res);
  }
  if (pathname === '/api/pix/status' || pathname === '/api/status') {
    return statusHandler(req, res);
  }
  if (pathname === '/api/webhook/elevypay') {
    return webhookHandler(req, res);
  }

  // Rewrites amigáveis
  let filePath = pathname;
  if (pathname === '/' || pathname === '') {
    filePath = '/index.html';
  } else if (pathname === '/checkout') {
    filePath = '/checkout.html';
  } else if (pathname === '/obrigado') {
    filePath = '/obrigado.html';
  }

  const safePath = path.normalize(path.join(__dirname, filePath));
  if (!safePath.startsWith(__dirname)) {
    res.statusCode = 403;
    return res.end('Acesso proibido');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<h1>404 - Página não encontrada</h1><p><a href="/">Voltar para a página inicial</a></p>');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(safePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  CASA LUCE STORE + ELEVYPAY PIX SERVER`);
    console.log(`  Rodando em: http://localhost:${PORT}`);
    console.log(`  Checkout:   http://localhost:${PORT}/checkout.html`);
    console.log(`  Obrigado:   http://localhost:${PORT}/obrigado.html`);
    console.log(`======================================================\n`);
  });
}

module.exports = server;
