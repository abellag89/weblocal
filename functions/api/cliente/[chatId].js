import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(ctx) {
  const { env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { data, error } = await supabase
    .from('clienti')
    .select('dati')
    .eq('chat_id', chatId)
    .single();

  if (error || !data) return Response.json({ errore: 'Cliente non trovato' }, { status: 404 });
  return Response.json(data.dati);
}

function checkAuth(request, env) {
  const auth = request.headers.get('X-Admin-Secret') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return auth && auth === env.ADMIN_SECRET;
}

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  if (!checkAuth(request, env)) return Response.json({ errore: 'Non autorizzato' }, { status: 401 });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { data: existing } = await supabase
    .from('clienti').select('chat_id').eq('chat_id', chatId).single();

  if (existing) return Response.json({ errore: 'Cliente già esistente' }, { status: 409 });

  const body = await request.json();
  const { error } = await supabase.from('clienti').insert({ chat_id: chatId, dati: body });

  if (error) return Response.json({ errore: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function onRequestPatch(ctx) {
  const { request, env, params } = ctx;
  if (!checkAuth(request, env)) return Response.json({ errore: 'Non autorizzato' }, { status: 401 });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { data: row, error: fetchErr } = await supabase
    .from('clienti').select('dati').eq('chat_id', chatId).single();

  if (fetchErr || !row) return Response.json({ errore: 'Cliente non trovato' }, { status: 404 });

  const dati = row.dati;
  const { campo, valore } = await request.json();

  switch (campo) {
    case 'avviso':    dati.avviso = valore; break;
    case 'telefono':  dati.telefono = valore; break;
    case 'promo': {
      const parti = valore.split(' - ');
      dati.promozione = { attiva: true, testo: parti[0]?.trim() || valore, dettaglio: parti[1]?.trim() || '' };
      break;
    }
    case 'promo_off': dati.promozione = { attiva: false, testo: '', dettaglio: '' }; break;
    case 'orari':
      dati.orari = valore.split('|').map(o => {
        const p = o.trim().split(' ');
        return { giorno: p[0], ore: p.slice(1).join(' ') };
      });
      break;
    default:
      return Response.json({ errore: `Campo '${campo}' non supportato` }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from('clienti').update({ dati }).eq('chat_id', chatId);

  if (updateErr) return Response.json({ errore: updateErr.message }, { status: 500 });
  return Response.json({ ok: true, campo, dati });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
