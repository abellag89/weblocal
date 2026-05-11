import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(ctx) {
  const { env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { data, error } = await supabase
    .from('clienti').select('chat_id').eq('chat_id', chatId).single();

  if (error || !data) {
    return new Response('<h2>Sito non trovato</h2>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Redirect to static sito.html served by Pages
  return Response.redirect('/sito.html', 302);
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
