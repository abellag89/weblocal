// Cloudflare Pages Function
// Route: POST /api/send-anteprime/{id}
// Invia email "le tue 4 proposte sono pronte" via Resend.
//
// Trigger: chiamato da n8n DOPO la generazione AI dei contenuti delle 4 anteprime.
// Sicurezza: richiede header X-Admin-Secret per evitare abuso.
//
// GET (con ?preview=1): restituisce solo l'HTML dell'email (per debug/anteprima).

import { createClient } from '@supabase/supabase-js';

const STILI = [
  {
    key: 'minimal',
    nome: 'Minimal',
    desc: 'Pulito, generoso, mobile-first',
    bg: '#fafaf7',
    fg: '#1a1a1a',
    accent: '#6b6b6b',
    titleStyle: 'font-family: -apple-system, sans-serif; font-weight: 300; letter-spacing: -1.5px;',
  },
  {
    key: 'classico',
    nome: 'Classico',
    desc: 'Caldo, italiano, editoriale',
    bg: '#f3eadb',
    fg: '#2a1810',
    accent: '#c2552d',
    titleStyle: 'font-family: Georgia, serif; font-style: italic; font-weight: 400;',
  },
  {
    key: 'bold',
    nome: 'Bold',
    desc: 'Energico, colorato, diretto',
    bg: 'linear-gradient(135deg, #f97316, #dc2626)',
    fg: '#ffffff',
    accent: '#fef3c7',
    titleStyle: 'font-family: Arial Black, sans-serif; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; text-shadow: 2px 2px 0 #1a0f0a;',
  },
  {
    key: 'elegante',
    nome: 'Elegante',
    desc: 'Dark, oro, raffinato',
    bg: '#0a0a0a',
    fg: '#f5ebdc',
    accent: '#d4a857',
    titleStyle: 'font-family: Georgia, serif; font-style: italic; font-weight: 300;',
  },
];

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function buildEmailHtml({ nome, id, origin }) {
  const safeNome = escapeHtml(nome || 'la tua attività');
  const baseUrl  = origin || 'https://orientico.com';

  const cardsHtml = STILI.map(s => {
    const isGradient = s.bg.startsWith('linear-gradient');
    const previewBg  = isGradient ? `background: ${s.bg};` : `background-color: ${s.bg};`;
    const accentBar  = s.key === 'elegante'
      ? `<div style="width:24px; height:1px; background:${s.accent}; margin:0 auto 12px;"></div>`
      : `<div style="display:inline-block; padding:4px 10px; background:${s.accent}; color:${s.fg}; font-size:9px; letter-spacing:2px; text-transform:uppercase; font-family:Arial,sans-serif; margin-bottom:14px;">${escapeHtml(s.nome)}</div>`;

    return `
    <td style="padding:0 6px 12px; vertical-align:top; width:50%;">
      <a href="${baseUrl}/anteprima/${id}/${s.key}"
         style="display:block; text-decoration:none; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff; border-collapse:collapse;">
          <tr>
            <td style="${previewBg} padding:32px 20px; text-align:center; color:${s.fg};">
              ${accentBar}
              <div style="${s.titleStyle} font-size:24px; color:${s.fg}; line-height:1.1;">${safeNome}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px; background:#ffffff;">
              <div style="font-family:Arial,sans-serif; font-size:14px; font-weight:600; color:#111827; margin-bottom:4px;">
                ${escapeHtml(s.nome)}
              </div>
              <div style="font-family:Arial,sans-serif; font-size:12px; color:#6b7280; line-height:1.4;">
                ${escapeHtml(s.desc)}
              </div>
              <div style="font-family:Arial,sans-serif; font-size:12px; font-weight:600; color:#f97316; margin-top:10px;">
                Apri l'anteprima &rarr;
              </div>
            </td>
          </tr>
        </table>
      </a>
    </td>`;
  });

  // Costruiamo grid 2x2 con coppie di card
  const row1 = cardsHtml.slice(0, 2).join('');
  const row2 = cardsHtml.slice(2, 4).join('');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le tue 4 proposte sono pronte</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header con logo -->
        <tr>
          <td style="padding:32px 32px 8px; text-align:left;">
            <div style="font-family:-apple-system,Arial,sans-serif; font-size:18px; font-weight:700; color:#111827; letter-spacing:-0.4px;">
              <span style="display:inline-block; vertical-align:middle; margin-right:4px;">
                <svg width="18" height="18" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M11 1C7.13 1 4 4.13 4 8c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#f97316"/><circle cx="11" cy="8" r="2.5" fill="#fff"/></svg>
              </span>
              Orien<span style="color:#f97316;">tico</span>
            </div>
          </td>
        </tr>

        <!-- Titolo -->
        <tr>
          <td style="padding:24px 32px 0;">
            <h1 style="margin:0 0 12px; font-family:-apple-system,Arial,sans-serif; font-size:28px; font-weight:800; color:#0f172a; letter-spacing:-0.8px; line-height:1.15;">
              Ciao, le tue 4 proposte<br>
              <span style="font-family:Georgia,serif; font-style:italic; font-weight:400; color:#f97316;">sono pronte.</span>
            </h1>
            <p style="margin:0 0 8px; font-family:Arial,sans-serif; font-size:15px; color:#4b5563; line-height:1.55;">
              Abbiamo preparato 4 versioni del sito per <strong style="color:#111827;">${safeNome}</strong>.
              Aprile dal telefono, scegli quella che ti rispecchia di più.
            </p>
          </td>
        </tr>

        <!-- Badge scadenza -->
        <tr>
          <td style="padding:12px 32px 20px;">
            <div style="display:inline-block; padding:5px 12px; background:#fef3c7; color:#92400e; border-radius:100px; font-family:Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:0.5px;">
              ⏱ Hai 72h per decidere
            </div>
          </td>
        </tr>

        <!-- Grid 2x2 delle anteprime -->
        <tr>
          <td style="padding:0 26px 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>${row1}</tr>
              <tr>${row2}</tr>
            </table>
          </td>
        </tr>

        <!-- Help -->
        <tr>
          <td style="padding:8px 32px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e5e7eb; padding-top:20px;">
              <tr>
                <td style="font-family:Arial,sans-serif; font-size:13px; color:#6b7280; line-height:1.6;">
                  <strong style="color:#111827;">Non riesci a decidere?</strong><br>
                  Rispondi a questa email descrivendo cosa cerchi — ti aiutiamo noi a scegliere.
                  Oppure dopo aver aperto un'anteprima, clicca <em>"Modifica"</em> per personalizzarla.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb; padding:22px 32px; text-align:center;">
            <div style="font-family:Arial,sans-serif; font-size:12px; color:#9ca3af; line-height:1.5;">
              Email automatica da Orientico<br>
              <a href="https://orientico.com" style="color:#6b7280; text-decoration:underline;">orientico.com</a> &middot;
              <a href="mailto:onboarding@orientico.com" style="color:#6b7280; text-decoration:underline;">onboarding@orientico.com</a>
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

function buildEmailText({ nome, id, origin }) {
  const baseUrl = origin || 'https://orientico.com';
  return `Ciao, le tue 4 proposte per ${nome || 'la tua attività'} sono pronte.

Abbiamo preparato 4 versioni del sito. Aprile e scegli quella che ti rispecchia:

1. MINIMAL   — pulito, generoso, mobile-first
   ${baseUrl}/anteprima/${id}/minimal

2. CLASSICO  — caldo, italiano, editoriale
   ${baseUrl}/anteprima/${id}/classico

3. BOLD      — energico, colorato, diretto
   ${baseUrl}/anteprima/${id}/bold

4. ELEGANTE  — dark, oro, raffinato
   ${baseUrl}/anteprima/${id}/elegante

Hai 72 ore per decidere.

Non riesci a decidere? Rispondi a questa email descrivendo cosa cerchi.
Oppure dopo aver aperto un'anteprima, clicca "Modifica" per personalizzarla.

— Orientico
https://orientico.com`;
}

async function sendViaResend({ env, to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY non configurata');
  const from = env.RESEND_FROM || 'Orientico <onboarding@orientico.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo || 'onboarding@orientico.com',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return res.json();
}

// GET con ?preview=1 → restituisce solo l'HTML per debug (no invio)
export async function onRequestGet(ctx) {
  const { request, params, env } = ctx;
  const url = new URL(request.url);
  if (url.searchParams.get('preview') !== '1') {
    return new Response('Method Not Allowed (usa POST o ?preview=1)', { status: 405 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data } = await supabase.from('richieste').select('nome,email').eq('id', params.id).single();
  if (!data) return new Response('Richiesta non trovata', { status: 404 });

  const html = buildEmailHtml({ nome: data.nome, id: params.id, origin: url.origin });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function onRequestPost(ctx) {
  const { request, params, env } = ctx;

  // Auth: ADMIN_SECRET in header
  const authHeader = request.headers.get('X-Admin-Secret') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!authHeader || authHeader !== env.ADMIN_SECRET) {
    return Response.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const url = new URL(request.url);
  const { data, error } = await supabase
    .from('richieste')
    .select('id,nome,email,stato')
    .eq('id', params.id)
    .single();

  if (error || !data) return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });
  if (!data.email) return Response.json({ errore: 'Email destinatario mancante' }, { status: 400 });

  const html = buildEmailHtml({ nome: data.nome, id: data.id, origin: url.origin });
  const text = buildEmailText({ nome: data.nome, id: data.id, origin: url.origin });

  try {
    const result = await sendViaResend({
      env,
      to: data.email,
      subject: `4 proposte per ${data.nome || 'la tua attività'} — quale preferisci?`,
      html,
      text,
    });

    // Aggiorna stato
    await supabase.from('richieste').update({ stato: 'anteprime_inviate' }).eq('id', data.id);

    return Response.json({ ok: true, resend_id: result?.id, to: data.email });
  } catch (e) {
    return Response.json({ errore: e.message }, { status: 502 });
  }
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
