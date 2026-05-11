import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(ctx) {
  const { env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;

  const { data, error } = await supabase
    .from('richieste')
    .select('notizie, promozione, avviso')
    .eq('id', id)
    .single();

  if (error || !data) return Response.json({ errore: 'Non trovato' }, { status: 404 });
  return Response.json(data);
}

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;
  const { tipo, testo, dettaglio } = await request.json();

  if (tipo === 'avviso') {
    await supabase.from('richieste').update({ avviso: testo }).eq('id', id);
  } else if (tipo === 'promo') {
    await supabase.from('richieste').update({
      promozione: { attiva: true, testo, dettaglio: dettaglio || '' }
    }).eq('id', id);
  } else if (tipo === 'promo_off') {
    await supabase.from('richieste').update({
      promozione: { attiva: false, testo: '', dettaglio: '' }
    }).eq('id', id);
  } else if (tipo === 'notizia') {
    const { data } = await supabase.from('richieste').select('notizie').eq('id', id).single();
    const notizie = data?.notizie || [];
    notizie.unshift({ testo, data: new Date().toISOString().split('T')[0] });
    if (notizie.length > 10) notizie.pop();
    await supabase.from('richieste').update({ notizie }).eq('id', id);
  }

  return Response.json({ ok: true });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
