/**
 * Webfuse WebMCP Demo — Anthropic API Proxy
 * Holds the API key server-side. CORS-restricted to Webfuse domains.
 * Never exposes the key to the browser.
 */

const http = require('http');
const https = require('https');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3001;

// Only allow requests from these origins
const ALLOWED_ORIGINS = [
  'https://webfu.se',
  'https://surfly.com',
  'https://surfly-s3.com',
  'null', // extension popups have null origin
];

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || 'null';
  const allowed = ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.webfu.se') || origin.endsWith('.surfly.com'));

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // WebMCP Hub lookup proxy (CORS bypass for extension)
  if (req.method === 'GET' && req.url.startsWith('/hub/lookup')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const domain = url.searchParams.get('domain');
    if (!domain) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing domain param' }));
      return;
    }
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Content-Type': 'application/json',
    };
    const hubReq = https.get(`https://www.webmcp-hub.com/api/configs/lookup?domain=${encodeURIComponent(domain)}`, (hubRes) => {
      res.writeHead(hubRes.statusCode, corsHeaders);
      hubRes.pipe(res);
    });
    hubReq.on('error', (e) => {
      res.writeHead(502, corsHeaders);
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/messages') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
    }

    // Forward to Anthropic
    const payload = JSON.stringify(parsed);
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Forward the upstream Content-Type (text/event-stream for streaming, application/json otherwise)
      const contentType = proxyRes.headers['content-type'] || 'application/json';
      res.writeHead(proxyRes.statusCode, {
        'Access-Control-Allow-Origin': allowed ? origin : 'null',
        'Content-Type': contentType,
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502, {
        'Access-Control-Allow-Origin': allowed ? origin : 'null',
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: e.message }));
    });

    proxyReq.write(payload);
    proxyReq.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy running on http://127.0.0.1:${PORT}`);
  console.log(`API key: ${API_KEY ? API_KEY.slice(0,12) + '...' : 'NOT SET'}`);
});
