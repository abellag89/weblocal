import { createClient } from '@supabase/supabase-js';

const CATEGORIE = {
  ristorante:   { label: 'Ristorante · Trattoria', emoji: '🍝' },
  bar:          { label: 'Bar · Caffetteria',       emoji: '☕' },
  pizzeria:     { label: 'Pizzeria',                emoji: '🍕' },
  negozio:      { label: 'Negozio',                 emoji: '🛍️' },
  parrucchiere: { label: 'Parrucchiere',            emoji: '✂️' },
  estetista:    { label: 'Centro Estetico',         emoji: '💅' },
  palestra:     { label: 'Palestra · Fitness',      emoji: '💪' },
  altro:        { label: 'Attività locale',         emoji: '📍' },
};

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { nome, categoria, indirizzo, telefono, email, password } = await request.json();

  if (!nome || !email || !password || !indirizzo || !telefono) {
    return Response.json({ errore: 'Compila tutti i campi obbligatori' }, { status: 400 });
  }

  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });

  if (authErr) {
    if (authErr.message.includes('already registered') || authErr.message.includes('already been registered')) {
      return Response.json({ errore: 'Email già registrata' }, { status: 409 });
    }
    return Response.json({ errore: authErr.message }, { status: 500 });
  }

  if (!authData.user) {
    return Response.json({ errore: 'Registrazione non riuscita. Verifica le impostazioni Supabase Auth.' }, { status: 500 });
  }

  const userId = authData.user.id;
  const cat = CATEGORIE[categoria] || CATEGORIE.altro;

  const datiDefault = {
    nome,
    categoria: cat.label,
    emoji_categoria: cat.emoji,
    indirizzo,
    telefono,
    colore_primario: '#1d4ed8',
    colore_header: '#1e293b',
    orari: [
      { giorno: 'Lun–Ven', ore: '09:00–19:00' },
      { giorno: 'Sabato',  ore: '09:00–13:00' },
      { giorno: 'Domenica', ore: 'Chiuso' },
    ],
    avviso: '',
    promozione: { attiva: false, testo: '', dettaglio: '' },
    stelle: 5.0,
    num_recensioni: 0,
    sezioni: ['orari', 'info'],
    menu: [],
    info_extra: [],
  };

  const { error: insertErr } = await supabase
    .from('clienti')
    .insert({ chat_id: userId, dati: datiDefault, email, user_id: userId });

  if (insertErr) return Response.json({ errore: insertErr.message }, { status: 500 });

  return Response.json({ ok: true, siteId: userId });
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
