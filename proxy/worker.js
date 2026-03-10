/**
 * Cloudflare Worker — API Proxy (Anthropic + WebMCP Hub)
 * Routes:
 *   POST /v1/messages → Anthropic API (streaming)
 *   GET  /hub/lookup?domain=x.com → webmcp-hub.com API (CORS proxy)
 */
const ALLOWED_ORIGINS = ['https://webfu.se', 'null'];
const isAllowed = (o) => !o || o === 'null' || ALLOWED_ORIGINS.includes(o) || o.endsWith('.webfu.se') || o.endsWith('.surfly.com');

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || 'null';
    const cors = {
      'Access-Control-Allow-Origin': isAllowed(origin) ? origin : '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);

    // WebMCP Hub lookup proxy
    if (url.pathname === '/hub/lookup' && request.method === 'GET') {
      const domain = url.searchParams.get('domain');
      if (!domain) return new Response(JSON.stringify({ error: 'Missing domain param' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      try {
        const hubRes = await fetch(`https://www.webmcp-hub.com/api/configs/lookup?domain=${encodeURIComponent(domain)}`);
        const body = await hubRes.text();
        return new Response(body, {
          status: hubRes.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    // Anthropic API proxy
    if (request.method !== 'POST' || url.pathname !== '/v1/messages')
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });

    const body = await request.text();
    const parsed = JSON.parse(body);
    const isStream = parsed.stream === true;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    if (isStream) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
