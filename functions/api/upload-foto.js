import { createClient } from '@supabase/supabase-js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const formData = await request.formData();
  const id = formData.get('id');
  const foto = formData.get('foto');

  if (!id || !foto) return Response.json({ errore: 'Parametri mancanti' }, { status: 400 });
  if (!UUID_RE.test(id)) return Response.json({ errore: 'ID non valido' }, { status: 400 });

  const mime = foto.type;
  if (!ALLOWED_TYPES.has(mime)) return Response.json({ errore: 'Tipo file non consentito (jpeg/png/webp/gif)' }, { status: 400 });

  const buffer = await foto.arrayBuffer();
  if (buffer.byteLength > MAX_SIZE) return Response.json({ errore: 'File troppo grande (max 5 MB)' }, { status: 400 });

  const ext = EXT_MAP[mime];
  const path = `richieste/${id}/foto.${ext}`;

  const { error } = await supabase.storage
    .from('foto')
    .upload(path, buffer, { contentType: mime, upsert: true });

  if (error) return Response.json({ errore: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('foto').getPublicUrl(path);
  await supabase.from('richieste').update({ foto_url: urlData.publicUrl }).eq('id', id);

  return Response.json({ ok: true, url: urlData.publicUrl });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
