// Cloudflare Pages Function
// Route: /anteprima/{id}/{stile}
// Serve uno dei 4 template HTML senza redirect, preservando l'URL.
// L'ID resta nel pathname e il JS del template lo estrae.

const STILI_VALIDI = new Set(['minimal', 'classico', 'bold', 'elegante']);

export async function onRequestGet(ctx) {
  const { params, request, env } = ctx;
  const stile = (params.stile || '').toLowerCase();

  if (!STILI_VALIDI.has(stile)) {
    // Stile non valido → rimanda alla galleria di scelta
    return Response.redirect(new URL(`/anteprima/${params.id}`, request.url).toString(), 302);
  }

  // Carica il template HTML statico dal bundle
  const url = new URL(request.url);
  url.pathname = `/tmpl-${stile}.html`;
  const assetRes = await env.ASSETS.fetch(url);

  if (!assetRes.ok) {
    return new Response('Template non trovato', { status: 500 });
  }

  // Inoltra il contenuto mantenendo l'URL originale visibile nel browser.
  // Aggiungiamo header anti-cache per evitare che CDN cachi la pagina
  // (i contenuti possono cambiare dopo una modifica via Qwen).
  const html = await assetRes.text();
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Anteprima-Stile': stile,
      'X-Anteprima-Id': params.id,
    },
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
