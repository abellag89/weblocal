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

export async function onRequestGet(ctx) {
  const { env, params, request } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;
  const url = new URL(request.url);
  const tema = url.searchParams.get('theme') || 'classico';

  const { data, error } = await supabase
    .from('richieste')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return Response.json({ errore: 'Anteprima non trovata' }, { status: 404 });

  const cat = CATEGORIE[data.categoria] || CATEGORIE.altro;
  const colori = TEMI[data.layout_scelto] || TEMI[tema] || TEMI.classico;
  const notizie = data.notizie || [];
  const promozione = data.promozione || { attiva: false, testo: '', dettaglio: '' };

  return Response.json({
    id,
    nome:             data.nome,
    categoria:        cat.label,
    emoji_categoria:  cat.emoji,
    indirizzo:        data.indirizzo,
    telefono:         data.telefono,
    email:            data.email,
    colore_primario:  colori.primario,
    colore_header:    colori.header,
    layout:           data.layout_scelto || tema,
    orari: data.orari || [
      { giorno: 'Lun–Ven', ore: '09:00–19:00' },
      { giorno: 'Sabato',  ore: '09:00–13:00' },
      { giorno: 'Domenica', ore: 'Chiuso' },
    ],
    avviso:           data.avviso || (data.descrizione ? data.descrizione.substring(0, 120) : ''),
    promozione,
    notizie,
    stelle:           data.stelle || 5.0,
    num_recensioni:   data.num_recensioni || 0,
    menu:             data.menu || [],
    info_extra:       data.link_esterno ? [{ icona: '🔗', label: 'Visita online', valore: data.link_esterno }] : [],
    foto_url:             data.foto_url || null,
    foto_chi_siamo_url:   data.foto_chi_siamo_url || data.foto_url || null,
    foto_news_url:        data.foto_news_url || data.foto_url || null,
    descrizione:          data.descrizione || '',
    link_esterno:         data.link_esterno || '',
    _is_preview: true,
  });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
