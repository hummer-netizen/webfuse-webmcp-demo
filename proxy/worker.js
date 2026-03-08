/**
 * Cloudflare Worker — Anthropic API Proxy
 * Deploy: wrangler deploy
 * Set secret: wrangler secret put ANTHROPIC_API_KEY
 */
const ALLOWED_ORIGINS = ['https://webfu.se', 'null'];
const isAllowed = (o) => !o || o === 'null' || ALLOWED_ORIGINS.includes(o) || o.endsWith('.webfu.se') || o.endsWith('.surfly.com');

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || 'null';
    const cors = {
      'Access-Control-Allow-Origin': isAllowed(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages')
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    const body = await request.text();
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body,
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
