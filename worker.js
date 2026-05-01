/**
 * AlphaAI — Cloudflare Worker CORS proxy for Anthropic API
 * Paste this entire file into the Cloudflare Worker editor and click Deploy.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
  'Access-Control-Max-Age':       '86400',
};

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Browser sends OPTIONS first (preflight) — respond with CORS headers
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return jsonResponse({ error: { message: 'Missing x-api-key header' } }, 400);
  }

  var body;
  try {
    body = await request.text();
  } catch (e) {
    return jsonResponse({ error: { message: 'Could not read request body' } }, 400);
  }

  try {
    var upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: body,
    });

    var text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: Object.assign({}, CORS, { 'Content-Type': 'application/json' }),
    });

  } catch (e) {
    return jsonResponse({ error: { message: 'Proxy error: ' + e.message } }, 502);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({}, CORS, { 'Content-Type': 'application/json' }),
  });
}
