// Cloudflare Pages Function
// Route: POST /api/qwen-modifica/{id}
//
// Applica una richiesta di modifica del cliente chiamando Qwen (Alibaba DashScope)
// con un prompt strutturato, parsando il JSON di risposta e aggiornando Supabase.
//
// Trigger: chiamato da n8n DOPO che /api/modifica ha registrato la richiesta,
// oppure direttamente dal client (con ADMIN_SECRET) per test.
//
// Architettura: Qwen NON riscrive HTML — restituisce solo i contenuti testuali
// aggiornati (hero_tagline, descrizione_breve, ecc.). Il design resta intatto.
// Vantaggio: prompt 10x più piccolo, zero rischio rottura layout.

import { createClient } from '@supabase/supabase-js';

const ORE_72 = 72 * 3600 * 1000;
const ORE_24 = 24 * 3600 * 1000;

function checkScaduta(data) {
  if (data.stato === 'pagata' || data.stato === 'pubblicata') return false;
  if (data.scelta_stile_at) {
    return Date.now() > new Date(data.scelta_stile_at).getTime() + ORE_24;
  }
  return Date.now() > new Date(data.created_at || Date.now()).getTime() + ORE_72;
}

// Costruisce il prompt strutturato per Qwen.
// Importante: chiediamo SOLO output JSON, con campi nominati, validabili.
function buildPrompt({ cur, stile, richiesta }) {
  const contenutiAttuali = {
    hero_tagline:       cur.hero_tagline      || null,
    hero_sottotitolo:   cur.hero_sottotitolo  || null,
    descrizione_breve:  cur.descrizione_breve || null,
    descrizione_lunga:  cur.descrizione_lunga || null,
    cta_principale:     cur.cta_principale    || 'Chiama subito',
    mostra_menu:        Boolean(cur.mostra_menu),
    mostra_galleria:    Boolean(cur.mostra_galleria),
    mostra_recensioni:  Boolean(cur.mostra_recensioni),
  };

  return `Sei un copywriter italiano specializzato in attività locali (bar, ristoranti, negozi, parrucchieri, palestre).
Il tuo compito: riscrivere SOLO i contenuti testuali del sito di un cliente in base alla sua richiesta di modifica.

# DATI DEL CLIENTE
- Nome attività: ${cur.nome || '(non specificato)'}
- Categoria: ${cur.categoria || 'attività locale'}
- Indirizzo: ${cur.indirizzo || ''}
- Descrizione fornita dal cliente: ${cur.descrizione || '(nessuna)'}
- Stile grafico scelto: ${stile} (minimal / classico / bold / elegante)

# CONTENUTI ATTUALI DEL SITO
${JSON.stringify(contenutiAttuali, null, 2)}

# RICHIESTA DEL CLIENTE
"${richiesta}"

# REGOLE
1. Mantieni un tono coerente con lo stile "${stile}":
   - minimal  → essenziale, pulito, frasi brevi
   - classico → caldo, italiano, evocativo (puoi usare metafore della tradizione)
   - bold     → diretto, energico, con punti esclamativi moderati
   - elegante → raffinato, formale, frasi compiute
2. Italiano corretto, niente anglicismi inutili.
3. NON inventare dati che non esistono (orari, prezzi, persone). Lavora solo su tono/contenuto.
4. hero_tagline: max 6 parole, d'effetto.
5. hero_sottotitolo: max 12 parole, complementare al tagline.
6. descrizione_breve: 1 frase, max 25 parole.
7. descrizione_lunga: 2-4 frasi, max 80 parole.
8. cta_principale: max 3 parole (es. "Chiama subito", "Prenota un tavolo").
9. mostra_menu / mostra_galleria / mostra_recensioni: true SOLO se il cliente lo chiede esplicitamente.

# OUTPUT
Rispondi UNICAMENTE con un JSON valido (nessun testo prima o dopo, nessun markdown).
Includi SOLO i campi che hai modificato. Esempio:

{
  "hero_tagline": "...",
  "descrizione_breve": "...",
  "mostra_menu": true
}`;
}

async function callQwen({ env, prompt }) {
  if (!env.QWEN_API_KEY || env.QWEN_API_KEY.startsWith('sk-REPLACE')) {
    throw new Error('QWEN_API_KEY non configurata (vedi wrangler.toml)');
  }
  const baseUrl = env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const model   = env.QWEN_MODEL   || 'qwen-plus';

  // Endpoint OpenAI-compatible di DashScope
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Sei un copywriter italiano. Rispondi sempre con JSON valido, niente markdown.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.7,
      // Forziamo JSON output se il modello supporta response_format
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Qwen ${res.status}: ${errText.substring(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Risposta Qwen vuota');

  // Parse JSON (con fallback se ha aggiunto code fences)
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    try { parsed = JSON.parse(cleaned); }
    catch (e2) { throw new Error('JSON Qwen non parsabile: ' + content.substring(0, 200)); }
  }
  return parsed;
}

// Whitelist dei campi che Qwen può modificare
const CAMPI_AMMESSI = new Set([
  'hero_tagline',
  'hero_sottotitolo',
  'descrizione_breve',
  'descrizione_lunga',
  'cta_principale',
  'mostra_menu',
  'mostra_galleria',
  'mostra_recensioni',
]);

function sanitizeUpdate(parsed) {
  const out = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!CAMPI_AMMESSI.has(k)) continue;
    if (k.startsWith('mostra_')) out[k] = Boolean(v);
    else if (typeof v === 'string') {
      const trimmed = v.trim().substring(0, 500);
      if (trimmed) out[k] = trimmed;
    }
  }
  return out;
}

export async function onRequestPost(ctx) {
  const { request, params, env } = ctx;

  // Auth: ADMIN_SECRET
  const authHeader = request.headers.get('X-Admin-Secret') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!authHeader || authHeader !== env.ADMIN_SECRET) {
    return Response.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ errore: 'JSON non valido' }, { status: 400 }); }

  // Modalità 1 (default): leggi l'ultima richiesta pending dal DB
  // Modalità 2: stile + richiesta passati esplicitamente nel body
  const { data: cur, error: errSel } = await supabase
    .from('richieste').select('*').eq('id', id).single();
  if (errSel || !cur) return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });
  if (checkScaduta(cur)) return Response.json({ errore: 'Anteprima scaduta' }, { status: 410 });

  let stile     = body.stile;
  let richiesta = body.richiesta;

  if (!stile || !richiesta) {
    // Pesca l'ultima richiesta pending dal log
    const log = Array.isArray(cur.richieste_modifica) ? cur.richieste_modifica : [];
    const pending = [...log].reverse().find(r => r.stato === 'pending');
    if (!pending) return Response.json({ errore: 'Nessuna richiesta pending trovata' }, { status: 400 });
    stile     = pending.stile;
    richiesta = pending.richiesta;
  }

  if (!['minimal','classico','bold','elegante'].includes(stile)) {
    return Response.json({ errore: 'Stile non valido' }, { status: 400 });
  }

  // Chiama Qwen
  let parsed;
  try {
    const prompt = buildPrompt({ cur, stile, richiesta });
    parsed = await callQwen({ env, prompt });
  } catch (e) {
    return Response.json({ errore: 'Qwen: ' + e.message }, { status: 502 });
  }

  // Whitelist + sanitize
  const update = sanitizeUpdate(parsed);
  if (Object.keys(update).length === 0) {
    return Response.json({ errore: 'Qwen non ha modificato nessun campo valido', parsed }, { status: 422 });
  }

  // Marca tutte le richieste pending come applicate
  const logUpdated = Array.isArray(cur.richieste_modifica)
    ? cur.richieste_modifica.map(r => r.stato === 'pending' ? { ...r, stato: 'applicata', applicata_at: new Date().toISOString() } : r)
    : [];

  const { error: errUpd } = await supabase
    .from('richieste')
    .update({
      ...update,
      richieste_modifica: logUpdated,
      stato_modifica:     'applicata',
      ultima_modifica_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (errUpd) return Response.json({ errore: 'DB update: ' + errUpd.message }, { status: 500 });

  // Trigger email "anteprima aggiornata" (fire-and-forget)
  if (cur.email) {
    const url = new URL(request.url);
    const emailUrl = `${url.origin}/api/send-modifica-applicata/${id}`;
    const p = fetch(emailUrl, {
      method: 'POST',
      headers: { 'X-Admin-Secret': env.ADMIN_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stile, modifiche: Object.keys(update) }),
    }).catch(err => console.error('send-modifica-applicata:', err.message));
    try { ctx.waitUntil(p); } catch (_) {}
  }

  return Response.json({
    ok: true,
    id,
    stile,
    modifiche: update,
    n_campi_modificati: Object.keys(update).length,
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
