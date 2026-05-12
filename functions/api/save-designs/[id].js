// Cloudflare Pages Function
// Route: POST /api/save-designs/{id}
//
// Riceve i 4 brief AI generati da n8n + i campi piatti del brief default (minimal).
// Salva in Supabase: `designs` (jsonb), hero_tagline, hero_sottotitolo,
// descrizione_breve, descrizione_lunga, cta_principale.
//
// Auth: header X-Admin-Secret.
//
// Body:
//   {
//     "designs": [{stile, hero_tagline, ...}, ...],  // array di 4 brief
//     "hero_tagline": "...",
//     "hero_sottotitolo": "...",
//     "descrizione_breve": "...",
//     "descrizione_lunga": "...",
//     "cta_principale": "..."
//   }

import { createClient } from '@supabase/supabase-js';

const STILI_VALIDI = new Set(['minimal', 'classico', 'bold', 'elegante']);

function sanitizeString(s, maxLen) {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.substring(0, maxLen || 500);
}

function sanitizeDesign(d) {
  if (!d || typeof d !== 'object') return null;
  if (!STILI_VALIDI.has(d.stile)) return null;
  return {
    stile:             d.stile,
    hero_tagline:      sanitizeString(d.hero_tagline,      120),
    hero_sottotitolo:  sanitizeString(d.hero_sottotitolo,  180),
    descrizione_breve: sanitizeString(d.descrizione_breve, 220),
    descrizione_lunga: sanitizeString(d.descrizione_lunga, 600),
    cta_principale:    sanitizeString(d.cta_principale,    40),
    preview_url:       sanitizeString(d.preview_url,       200),
  };
}

export async function onRequestPost(ctx) {
  const { request, params, env } = ctx;

  const authHeader = request.headers.get('X-Admin-Secret')
    || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!authHeader || authHeader !== env.ADMIN_SECRET) {
    return Response.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ errore: 'JSON non valido' }, { status: 400 }); }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;

  // Verifica che la richiesta esista
  const { data: cur, error: errSel } = await supabase
    .from('richieste')
    .select('id, nome, stato')
    .eq('id', id)
    .single();

  if (errSel || !cur) {
    return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });
  }

  // Sanitize designs (array)
  const rawDesigns = Array.isArray(body.designs) ? body.designs : [];
  const designs = rawDesigns.map(sanitizeDesign).filter(Boolean);
  if (designs.length === 0) {
    return Response.json({ errore: 'Nessun design valido nel payload' }, { status: 400 });
  }

  // Sanitize campi piatti default
  const update = {
    designs,
    hero_tagline:      sanitizeString(body.hero_tagline,      120),
    hero_sottotitolo:  sanitizeString(body.hero_sottotitolo,  180),
    descrizione_breve: sanitizeString(body.descrizione_breve, 220),
    descrizione_lunga: sanitizeString(body.descrizione_lunga, 600),
    cta_principale:    sanitizeString(body.cta_principale,    40),
  };

  // Rimuovi i null per non sovrascrivere con vuoto se Qwen non ha dato qualcosa
  const updateClean = Object.fromEntries(
    Object.entries(update).filter(([_, v]) => v !== null && v !== undefined)
  );
  // designs lo passiamo sempre (è il payload principale)
  updateClean.designs = designs;

  const { error: errUpd } = await supabase
    .from('richieste')
    .update(updateClean)
    .eq('id', id);

  if (errUpd) {
    return Response.json({ errore: 'DB update: ' + errUpd.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    id,
    n_designs:        designs.length,
    stili:            designs.map(d => d.stile),
    n_campi_aggiornati: Object.keys(updateClean).length,
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
