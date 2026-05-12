import { createClient } from '@supabase/supabase-js';

const CATEGORIE = {
  ristorante:   { label: 'Ristorante · Trattoria', emoji: '🍝' },
  bar:          { label: 'Bar · Caffetteria',       emoji: '☕' },
  pizzeria:     { label: 'Pizzeria',                emoji: '🍕' },
  negozio:      { label: 'Negozio',                 emoji: '🛍️' },
  parrucchiere: { label: 'Parrucchiere',            emoji: '✂️' },
  estetista:    { label: 'Centro Estetico',         emoji: '💅' },
  palestra:     { label: 'Palestra · Fitness',      emoji: '💪' },
  barbiere:     { label: 'Barbiere',                emoji: '💈' },
  farmacia:     { label: 'Farmacia',                emoji: '💊' },
  altro:        { label: 'Attività locale',         emoji: '📍' },
};

const TEMI = {
  classico: { primario: '#b45309', header: '#1c1917' },
  moderno:  { primario: '#2563eb', header: '#0f172a' },
  fresco:   { primario: '#16a34a', header: '#14532d' },
  minimal:  { primario: '#374151', header: '#1f2937' },
};

const ORE_72 = 72 * 3600 * 1000;
const ORE_24 = 24 * 3600 * 1000;

function computeScadenza(data) {
  // Se già pagata, non scade più
  if (data.stato === 'pagata' || data.stato === 'pubblicata') {
    return { scaduta: false, scadenza_at: null, fase: 'pagata' };
  }
  // Se ha già scelto uno stile, applica +24h dalla scelta
  if (data.scelta_stile_at) {
    const sceltaTs = new Date(data.scelta_stile_at).getTime();
    const scadTs = sceltaTs + ORE_24;
    return {
      scaduta: Date.now() > scadTs,
      scadenza_at: new Date(scadTs).toISOString(),
      fase: 'pagamento',
    };
  }
  // Altrimenti, 72h da created_at
  const createdTs = new Date(data.created_at || Date.now()).getTime();
  const scadTs = createdTs + ORE_72;
  return {
    scaduta: Date.now() > scadTs,
    scadenza_at: new Date(scadTs).toISOString(),
    fase: 'scelta',
  };
}

function pulisciTelefono(t) {
  if (!t) return '';
  let s = String(t).replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+') && /^\d{9,11}$/.test(s)) s = '+39' + s;
  return s;
}

export async function onRequestGet(ctx) {
  const { env, params, request } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;
  const url = new URL(request.url);
  const tema = url.searchParams.get('theme') || url.searchParams.get('stile') || 'classico';

  const { data, error } = await supabase
    .from('richieste')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return Response.json({ errore: 'Anteprima non trovata' }, { status: 404 });
  }

  // Check scadenza
  const sc = computeScadenza(data);
  if (sc.scaduta) {
    return Response.json(
      {
        errore: 'Anteprima scaduta',
        scaduta: true,
        fase: sc.fase,
        redirect: `/scaduta?id=${id}&fase=${sc.fase}`,
      },
      { status: 410 }
    );
  }

  const cat = CATEGORIE[data.categoria] || CATEGORIE.altro;
  const colori = TEMI[data.layout_scelto] || TEMI[tema] || TEMI.classico;
  const notizie = data.notizie || [];
  const promozione = data.promozione || { attiva: false, testo: '', dettaglio: '' };
  const telPulito = pulisciTelefono(data.telefono);

  return Response.json({
    id,
    nome:               data.nome,
    categoria:          data.categoria,
    categoria_label:    cat.label,
    emoji_categoria:    cat.emoji,
    indirizzo:          data.indirizzo,
    telefono:           data.telefono,
    telefono_pulito:    telPulito,
    email:              data.email,
    colore_primario:    colori.primario,
    colore_header:      colori.header,
    layout:             data.layout_scelto || tema,

    // Contenuti AI-generated (con fallback ai campi base)
    hero_tagline:       data.hero_tagline || null,
    hero_sottotitolo:   data.hero_sottotitolo || null,
    descrizione_breve:  data.descrizione_breve || (data.descrizione ? data.descrizione.substring(0, 140) : ''),
    descrizione_lunga:  data.descrizione_lunga || data.descrizione || '',
    cta_principale:     data.cta_principale || 'Chiama subito',

    orari: data.orari || [
      { giorno: 'Lunedì',    ore: '09:00 – 19:00' },
      { giorno: 'Martedì',   ore: '09:00 – 19:00' },
      { giorno: 'Mercoledì', ore: '09:00 – 19:00' },
      { giorno: 'Giovedì',   ore: '09:00 – 19:00' },
      { giorno: 'Venerdì',   ore: '09:00 – 19:00' },
      { giorno: 'Sabato',    ore: '09:00 – 13:00' },
      { giorno: 'Domenica',  ore: 'Chiuso' },
    ],
    avviso:           data.avviso || '',
    promozione,
    notizie,
    stelle:           data.stelle || 5.0,
    num_recensioni:   data.num_recensioni || 0,
    menu:             data.menu || [],

    foto_url:             data.foto_url || null,
    foto_chi_siamo_url:   data.foto_chi_siamo_url || data.foto_url || null,
    foto_news_url:        data.foto_news_url || data.foto_url || null,
    descrizione:          data.descrizione || '',
    link_esterno:         data.link_esterno || '',

    // Sezioni opzionali (toggle)
    mostra_menu:       Boolean(data.mostra_menu),
    mostra_galleria:   Boolean(data.mostra_galleria),
    mostra_recensioni: Boolean(data.mostra_recensioni),

    // Scadenza
    scadenza_at:      sc.scadenza_at,
    fase:             sc.fase,
    stato:            data.stato || 'anteprime_pronte',

    _is_preview: true,
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
