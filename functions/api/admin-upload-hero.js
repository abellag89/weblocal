import { createClient } from '@supabase/supabase-js';

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.arrayBuffer();
}

async function uploadHero(supabase, clienteId, filename, buffer) {
  const path = `richieste/${clienteId}/${filename}`;
  const { error } = await supabase.storage
    .from('foto')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Upload ${filename}: ${error.message}`);
  const { data } = supabase.storage.from('foto').getPublicUrl(path);
  return data.publicUrl;
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const ADMIN_SECRET = env.ADMIN_SECRET || 'orientico-admin-2026';

  const { secret, cliente_id, url_landing, url_chi_siamo, url_news } = await request.json();

  if (secret !== ADMIN_SECRET) return Response.json({ errore: 'Non autorizzato' }, { status: 403 });
  if (!cliente_id || !url_landing || !url_chi_siamo || !url_news)
    return Response.json({ errore: 'Parametri mancanti' }, { status: 400 });

  try {
    const [bufLanding, bufChiSiamo, bufNews] = await Promise.all([
      fetchBuffer(url_landing),
      fetchBuffer(url_chi_siamo),
      fetchBuffer(url_news),
    ]);

    const [pubLanding, pubChiSiamo, pubNews] = await Promise.all([
      uploadHero(supabase, cliente_id, 'hero_landing.png', bufLanding),
      uploadHero(supabase, cliente_id, 'hero_chi_siamo.png', bufChiSiamo),
      uploadHero(supabase, cliente_id, 'hero_news.png', bufNews),
    ]);

    const { error: dbErr } = await supabase
      .from('richieste')
      .update({ foto_url: pubLanding, foto_chi_siamo_url: pubChiSiamo, foto_news_url: pubNews })
      .eq('id', cliente_id);

    if (dbErr) throw new Error(`DB update: ${dbErr.message}`);

    return Response.json({ ok: true, foto_url: pubLanding, foto_chi_siamo_url: pubChiSiamo, foto_news_url: pubNews });
  } catch (err) {
    return Response.json({ errore: err.message }, { status: 500 });
  }
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
