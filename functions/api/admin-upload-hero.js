import { createClient } from '@supabase/supabase-js';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB
const FETCH_TIMEOUT_MS = 30_000;

// Blocca SSRF: solo HTTPS, niente localhost/reti private
function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error(`URL non valido: ${raw}`); }
  if (u.protocol !== 'https:') throw new Error('Solo URL HTTPS consentiti');
  const h = u.hostname;
  if (/^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1)$/.test(h))
    throw new Error('URL localhost non consentito');
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h))
    throw new Error('URL rete privata non consentito');
}

async function fetchBuffer(url) {
  validateUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const cl = res.headers.get('content-length');
    if (cl && parseInt(cl) > MAX_IMAGE_SIZE) throw new Error('Immagine troppo grande (max 15 MB)');
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_SIZE) throw new Error('Immagine troppo grande (max 15 MB)');
    return buf;
  } finally {
    clearTimeout(timer);
  }
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
