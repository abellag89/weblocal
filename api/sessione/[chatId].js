import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { chatId } = req.query;

  // GET — leggi stato sessione
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('sessioni')
      .select('stato')
      .eq('chat_id', chatId)
      .single();

    return res.json({ stato: data?.stato || null });
  }

  // POST — salva stato sessione
  if (req.method === 'POST') {
    const { stato } = req.body;
    const { error } = await supabase
      .from('sessioni')
      .upsert({ chat_id: chatId, stato });

    if (error) return res.status(500).json({ errore: error.message });
    return res.json({ ok: true });
  }

  // DELETE — cancella sessione
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('sessioni')
      .delete()
      .eq('chat_id', chatId);

    if (error) return res.status(500).json({ errore: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ errore: 'Metodo non supportato' });
}
