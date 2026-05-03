import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { chatId } = req.query;

  const { data, error } = await supabase
    .from('clienti')
    .select('chat_id')
    .eq('chat_id', chatId)
    .single();

  if (error || !data) {
    return res.status(404).send('<h2>Sito non trovato</h2>');
  }

  const html = readFileSync(join(process.cwd(), 'sito.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
}
