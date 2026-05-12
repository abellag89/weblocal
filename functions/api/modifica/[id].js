import { createClient } from '@supabase/supabase-js';

const ORE_72 = 72 * 3600 * 1000;
const ORE_24 = 24 * 3600 * 1000;

function checkScaduta(data) {
  if (data.stato === 'pagata' || data.stato === 'pubblicata') return false;
  if (data.scelta_stile_at) {
    return Date.now() > new Date(data.scelta_stile_at).getTime() + ORE_24;
  }
  return Date.now() > new Date(data.created_at || Date.now()).getTime() + ORE_72;
}

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;

  let body;
  try { body = await request.json(); } catch (_) {
    return Response.json({ errore: 'JSON non valido' }, { status: 400 });
  }

  const stile     = String(body.stile || '').trim();
  const richiesta = String(body.richiesta || '').trim();

  if (!richiesta || richiesta.length < 8) {
    return Response.json({ errore: 'Richiesta troppo breve (min 8 caratteri)' }, { status: 400 });
  }
  if (richiesta.length > 2000) {
    return Response.json({ errore: 'Richiesta troppo lunga (max 2000 caratteri)' }, { status: 400 });
  }
  if (!['minimal','classico','bold','elegante'].includes(stile)) {
    return Response.json({ errore: 'Stile non valido' }, { status: 400 });
  }

  // Verifica anteprima esista e non scaduta
  const { data: cur, error: errSel } = await supabase
    .from('richieste')
    .select('*')
    .eq('id', id)
    .single();

  if (errSel || !cur) return Response.json({ errore: 'Anteprima non trovata' }, { status: 404 });
  if (checkScaduta(cur)) {
    return Response.json({ errore: 'Anteprima scaduta', scaduta: true, redirect: `/scaduta?id=${id}` }, { status: 410 });
  }

  // Append richiesta al log
  const logPrec = Array.isArray(cur.richieste_modifica) ? cur.richieste_modifica : [];
  const nuovaRichiesta = {
    stile,
    richiesta,
    ts: new Date().toISOString(),
    stato: 'pending', // pending | in_lavorazione | applicata | rifiutata
  };
  const log = [...logPrec, nuovaRichiesta];

  const { error: errUpd } = await supabase
    .from('richieste')
    .update({
      richieste_modifica: log,
      stato_modifica: 'pending',
      ultima_modifica_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (errUpd) {
    // Se le colonne non esistono ancora in Supabase, fallback: solo trigger n8n
    console.warn('Colonne modifica non trovate, skip update:', errUpd.message);
  }

  // Triggera n8n per chiamare Qwen e applicare la modifica
  if (env.N8N_WEBHOOK_MODIFICA) {
    const payload = {
      id,
      nome: cur.nome,
      categoria: cur.categoria,
      indirizzo: cur.indirizzo,
      telefono: cur.telefono,
      email: cur.email,
      descrizione: cur.descrizione,
      stile,
      richiesta,
      contenuti_attuali: {
        hero_tagline:      cur.hero_tagline      || null,
        hero_sottotitolo:  cur.hero_sottotitolo  || null,
        descrizione_breve: cur.descrizione_breve || null,
        descrizione_lunga: cur.descrizione_lunga || null,
        cta_principale:    cur.cta_principale    || null,
        mostra_menu:       Boolean(cur.mostra_menu),
        mostra_galleria:   Boolean(cur.mostra_galleria),
        mostra_recensioni: Boolean(cur.mostra_recensioni),
      },
    };
    const p = fetch(env.N8N_WEBHOOK_MODIFICA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => console.error('n8n modifica webhook:', err.message));
    try { ctx.waitUntil(p); } catch (_) {}
  }

  // Path principale: chiama direttamente la function Qwen (fire-and-forget).
  // Indipendente da n8n — se n8n è down, l'elaborazione avviene comunque.
  if (env.QWEN_API_KEY && !env.QWEN_API_KEY.startsWith('sk-REPLACE')) {
    const url = new URL(request.url);
    const qwenUrl = `${url.origin}/api/qwen-modifica/${id}`;
    const pQwen = fetch(qwenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': env.ADMIN_SECRET },
      body: JSON.stringify({ stile, richiesta }),
    }).catch(err => console.error('qwen-modifica fire-and-forget:', err.message));
    try { ctx.waitUntil(pQwen); } catch (_) {}
  }

  return Response.json({
    ok: true,
    id,
    stato_modifica: 'pending',
    messaggio: 'Richiesta registrata. L\'anteprima sarà aggiornata via email entro pochi minuti.',
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
