import { createClient } from '@supabase/supabase-js';

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STILI_OK   = new Set(['minimal', 'classico', 'bold', 'elegante']);

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;

  if (!UUID_RE.test(id)) return Response.json({ errore: 'ID non valido' }, { status: 400 });

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const stile  = body.stile || body.layout || null;
  const layout = body.layout || stile;

  if (!stile || !STILI_OK.has(stile)) {
    return Response.json({ errore: 'Stile non valido' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Verifica se la richiesta esiste e ottieni stato corrente
  const { data: cur } = await supabase
    .from('richieste')
    .select('stato, scelta_stile_at, created_at')
    .eq('id', id)
    .single();

  if (!cur) return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });

  // Una scelta già fatta? Aggiorniamo solo lo stile (timer +24h rimane attivo dalla prima scelta)
  // Prima scelta? Settiamo scelta_stile_at = now (parte il timer di 24h)
  const update = {
    stile_scelto:    stile,
    layout_scelto:   layout,
    stato:           `scelta_${stile}`,
  };
  if (!cur.scelta_stile_at) update.scelta_stile_at = now;

  const { error } = await supabase
    .from('richieste')
    .update(update)
    .eq('id', id);

  if (error) return Response.json({ errore: error.message }, { status: 500 });

  // Notifica n8n della scelta (fire-and-forget)
  if (env.N8N_WEBHOOK_SCELTA) {
    const p = fetch(env.N8N_WEBHOOK_SCELTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stile, scelta_at: now }),
    }).catch(err => console.error('n8n scelta webhook:', err.message));
    try { ctx.waitUntil(p); } catch (_) {}
  }

  return Response.json({ ok: true, stile, scelta_at: cur.scelta_stile_at || now });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
