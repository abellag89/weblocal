const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const CLIENTI_DIR = path.join(__dirname, 'clienti');

function percorsoCliente(chatId) {
  return path.join(CLIENTI_DIR, String(chatId), 'dati-cliente.json');
}

function leggiCliente(chatId) {
  const p = percorsoCliente(chatId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function scriviCliente(chatId, dati) {
  const dir = path.join(CLIENTI_DIR, String(chatId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(percorsoCliente(chatId), JSON.stringify(dati, null, 2));
}

// GET /cliente/:chatId — leggi dati
app.get('/cliente/:chatId', (req, res) => {
  const dati = leggiCliente(req.params.chatId);
  if (!dati) return res.status(404).json({ errore: 'Cliente non trovato' });
  res.json(dati);
});

// PATCH /cliente/:chatId — aggiorna campi
app.patch('/cliente/:chatId', (req, res) => {
  const dati = leggiCliente(req.params.chatId);
  if (!dati) return res.status(404).json({ errore: 'Cliente non trovato' });

  const { campo, valore } = req.body;

  switch (campo) {
    case 'avviso':
      dati.avviso = valore;
      break;
    case 'telefono':
      dati.telefono = valore;
      break;
    case 'promo':
      const parti = valore.split(' - ');
      dati.promozione = {
        attiva: true,
        testo: parti[0]?.trim() || valore,
        dettaglio: parti[1]?.trim() || ''
      };
      break;
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

  scriviCliente(req.params.chatId, dati);
  res.json({ ok: true, campo, dati });
});

// GET /sito/:chatId — serve il sito del cliente
app.get('/sito/:chatId', (req, res) => {
  const dati = leggiCliente(req.params.chatId);
  if (!dati) return res.status(404).send('<h2>Sito non trovato</h2>');
  res.sendFile(path.join(__dirname, 'sito.html'));
});

// Serve file statici dalla cartella weblocal
app.use(express.static(__dirname));

// POST /cliente/:chatId — crea nuovo cliente
app.post('/cliente/:chatId', (req, res) => {
  const esistente = leggiCliente(req.params.chatId);
  if (esistente) return res.status(409).json({ errore: 'Cliente già esistente' });
  scriviCliente(req.params.chatId, req.body);
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`WebLocal server in ascolto su http://localhost:${PORT}`));
