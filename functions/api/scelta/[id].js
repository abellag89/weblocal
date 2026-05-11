import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;
  const { layout } = await request.json();

  await supabase.from('richieste')
    .update({ layout_scelto: layout, stato: 'layout_scelto' })
    .eq('id', id);

  return Response.json({ ok: true });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
