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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
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

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Content-Type': 'application/json',
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { ...corsHeaders });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502, corsHeaders);
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
