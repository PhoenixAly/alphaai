/**
 * AlphaAI — Cloudflare Worker CORS proxy for Anthropic API
 *
 * Deploy this to a free Cloudflare Worker (workers.cloudflare.com).
 * The worker forwards POST /v1/messages to api.anthropic.com,
 * adding the CORS headers the browser requires.
 *
 * Your Claude API key is passed from the browser in x-api-key
 * and forwarded directly — this worker never stores it.
 */

const ANTHROPIC_URL   = 'https://api.anthropic.com/v1/messages';
const ALLOWED_ORIGINS = ['*']; // lock to your GitHub Pages URL for extra safety

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
  'Access-Control-Max-Age':       '86400',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return json({ error: { message: 'Missing x-api-key header' } }, 400);
    }

    let body;
    try {
      body = await request.text();
    } catch {
      return json({ error: { message: 'Invalid request body' } }, 400);
    }

    try {
      const upstream = await fetch(ANTHROPIC_URL, {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
      });

      const text = await upstream.text();
      return new Response(text, {
        status:  upstream.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return json({ error: { message: `Proxy error: ${err.message}` } }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
