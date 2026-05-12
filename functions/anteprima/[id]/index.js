// Cloudflare Pages Function
// Route: /anteprima/{id}  (senza stile)
// Serve la galleria scegli.html mantenendo l'URL originale.

export async function onRequestGet(ctx) {
  const { params, request, env } = ctx;
  const url = new URL(request.url);
  url.pathname = '/scegli.html';
  // Passiamo l'id come query per il JS della pagina
  url.search = `?id=${encodeURIComponent(params.id)}`;
  const assetRes = await env.ASSETS.fetch(url);

  if (!assetRes.ok) return new Response('Pagina non trovata', { status: 500 });

  const html = await assetRes.text();
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
