import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { nome, categoria, indirizzo, telefono, email, descrizione, link_esterno } = await request.json();

  if (!nome || !email || !indirizzo || !telefono) {
    return Response.json({ errore: 'Compila tutti i campi obbligatori' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('richieste')
    .insert({ nome, categoria: categoria || 'altro', indirizzo, telefono, email, descrizione, link_esterno })
    .select('id')
    .single();

  if (error) return Response.json({ errore: error.message }, { status: 500 });

  const id = data.id;

  const n8nWebhook = env.N8N_WEBHOOK_URL;
  let n8nOk = false;

  if (n8nWebhook) {
    try {
      const n8nRes = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nome, categoria: categoria || 'altro', indirizzo, telefono, email, descrizione: descrizione || '', link_esterno: link_esterno || '' }),
      });
      n8nOk = n8nRes.ok;
    } catch (err) {
      console.error('n8n webhook error:', err.message);
    }
  }

  await supabase
    .from('richieste')
    .update({ stato: n8nOk ? 'n8n_triggered' : 'nuovo' })
    .eq('id', id);

  return Response.json({ ok: true, id, n8nOk });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
