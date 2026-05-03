import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { chatId } = req.query;

  // GET — leggi dati cliente
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('clienti')
      .select('dati')
      .eq('chat_id', chatId)
      .single();

    if (error || !data) return res.status(404).json({ errore: 'Cliente non trovato' });
    return res.json(data.dati);
  }

  // POST — crea nuovo cliente
  if (req.method === 'POST') {
    const { data: existing } = await supabase
      .from('clienti')
      .select('chat_id')
      .eq('chat_id', chatId)
      .single();

    if (existing) return res.status(409).json({ errore: 'Cliente già esistente' });

    const { error } = await supabase
      .from('clienti')
      .insert({ chat_id: chatId, dati: req.body });

    if (error) return res.status(500).json({ errore: error.message });
    return res.json({ ok: true });
  }

  // PATCH — aggiorna campo specifico
  if (req.method === 'PATCH') {
    const { data: row, error: fetchErr } = await supabase
      .from('clienti')
      .select('dati')
      .eq('chat_id', chatId)
      .single();

    if (fetchErr || !row) return res.status(404).json({ errore: 'Cliente non trovato' });

    const dati = row.dati;
    const { campo, valore } = req.body;

    switch (campo) {
      case 'avviso':
        dati.avviso = valore;
        break;
      case 'telefono':
        dati.telefono = valore;
        break;
      case 'promo': {
        const parti = valore.split(' - ');
        dati.promozione = {
          attiva: true,
          testo: parti[0]?.trim() || valore,
          dettaglio: parti[1]?.trim() || ''
        };
        break;
      }
      case 'promo_off':
        dati.promozione = { attiva: false, testo: '', dettaglio: '' };
        break;
      case 'orari':
        dati.orari = valore.split('|').map(o => {
          const p = o.trim().split(' ');
          return { giorno: p[0], ore: p.slice(1).join(' ') };
        });
        break;
      default:
        return res.status(400).json({ errore: `Campo '${campo}' non supportato` });
    }

    const { error: updateErr } = await supabase
      .from('clienti')
      .update({ dati })
      .eq('chat_id', chatId);

    if (updateErr) return res.status(500).json({ errore: updateErr.message });
    return res.json({ ok: true, campo, dati });
  }

  res.status(405).json({ errore: 'Metodo non supportato' });
}
