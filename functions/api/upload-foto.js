import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const formData = await request.formData();
  const id = formData.get('id');
  const foto = formData.get('foto');

  if (!id || !foto) return Response.json({ errore: 'Missing id or foto' }, { status: 400 });

  const ext = foto.name?.split('.').pop() || 'jpg';
  const path = `richieste/${id}/foto.${ext}`;
  const buffer = await foto.arrayBuffer();

  const { error } = await supabase.storage
    .from('foto')
    .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });

  if (error) return Response.json({ errore: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('foto').getPublicUrl(path);
  await supabase.from('richieste').update({ foto_url: urlData.publicUrl }).eq('id', id);

  return Response.json({ ok: true, url: urlData.publicUrl });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
