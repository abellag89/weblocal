// Cloudflare Pages Function
// Route: POST /api/save-previews/{id}
//
// Riceve da n8n le URL delle 4 screenshot PNG (una per stile) e le salva
// nella colonna `preview_images` JSONB della tabella `richieste`.
//
// Chiamato da n8n DOPO aver caricato tutti e 4 i PNG su Supabase Storage.
// Body: { minimal: "url", classico: "url", bold: "url", elegante: "url" }

import { createClient } from '@supabase/supabase-js';

const STILI_VALIDI = new Set(['minimal', 'classico', 'bold', 'elegante']);

// Valida che una stringa sia un UUID v4
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Valida che una stringa sia un URL HTTPS (solo domini Supabase o CDN fidato)
function isValidStorageUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (
      u.hostname.endsWith('.supabase.co') ||
      u.hostname.endsWith('.supabase.in')
    );
  } catch {
    return false;
  }
}

export async function onRequestPost(ctx) {
  const { request, params, env } = ctx;

  // Auth: ADMIN_SECRET
  const auth = request.headers.get('X-Admin-Secret') ||
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!auth || auth !== env.ADMIN_SECRET) {
    return Response.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  // Validazione UUID
  const { id } = params;
  if (!id || !isValidUUID(id)) {
    return Response.json({ errore: 'ID non valido' }, { status: 400 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ errore: 'JSON non valido' }, { status: 400 }); }

  // Filtra e valida solo gli stili noti con URL Supabase Storage
  const previewImages = {};
  for (const [stile, url] of Object.entries(body)) {
    if (!STILI_VALIDI.has(stile)) continue;
    if (typeof url !== 'string' || !isValidStorageUrl(url)) {
      return Response.json({
        errore: `URL non valido per stile "${stile}": deve essere HTTPS su dominio Supabase`,
        url,
      }, { status: 400 });
    }
    previewImages[stile] = url;
  }

  if (Object.keys(previewImages).length === 0) {
    return Response.json({ errore: 'Nessuna preview valida nel body' }, { status: 400 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Verifica che la richiesta esista
  const { data: existing, error: errSel } = await supabase
    .from('richieste').select('id').eq('id', id).single();
  if (errSel || !existing) {
    return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });
  }

  // Salva le URL
  const { error: errUpd } = await supabase
    .from('richieste')
    .update({ preview_images: previewImages })
    .eq('id', id);

  if (errUpd) {
    return Response.json({ errore: 'DB update: ' + errUpd.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    id,
    previews_salvate: Object.keys(previewImages),
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
