import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(ctx) {
  const { env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { data } = await supabase
    .from('sessioni').select('stato').eq('chat_id', chatId).single();

  return Response.json({ stato: data?.stato || null });
}

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;
  const { stato } = await request.json();

  const { error } = await supabase.from('sessioni').upsert({ chat_id: chatId, stato });
  if (error) return Response.json({ errore: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function onRequestDelete(ctx) {
  const { env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { chatId } = params;

  const { error } = await supabase.from('sessioni').delete().eq('chat_id', chatId);
  if (error) return Response.json({ errore: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
