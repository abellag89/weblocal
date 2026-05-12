// Cloudflare Pages Function
// Route: POST /api/send-modifica-applicata/{id}
// Email "la tua anteprima è stata aggiornata" dopo che Qwen ha applicato la modifica.
// Chiamato in fire-and-forget da /api/qwen-modifica.

import { createClient } from '@supabase/supabase-js';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const STILE_LABEL = {
  minimal:  { nome: 'Minimal',  color: '#1a1a1a' },
  classico: { nome: 'Classico', color: '#c2552d' },
  bold:     { nome: 'Bold',     color: '#dc2626' },
  elegante: { nome: 'Elegante', color: '#d4a857' },
};

function buildHtml({ nome, id, stile, modifiche, origin }) {
  const safeNome = escapeHtml(nome || 'la tua attività');
  const lbl      = STILE_LABEL[stile] || { nome: 'la versione', color: '#f97316' };
  const baseUrl  = origin || 'https://orientico.com';
  const link     = `${baseUrl}/anteprima/${id}/${stile}`;

  const mods = (modifiche || []).map(m => {
    const labels = {
      hero_tagline: 'Titolo principale',
      hero_sottotitolo: 'Sottotitolo',
      descrizione_breve: 'Descrizione breve',
      descrizione_lunga: 'Descrizione completa',
      cta_principale: 'Bottone call-to-action',
      mostra_menu: 'Sezione menu',
      mostra_galleria: 'Galleria foto',
      mostra_recensioni: 'Recensioni',
    };
    return `<li style="margin-bottom:6px;">${escapeHtml(labels[m] || m)}</li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anteprima aggiornata</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

<tr><td style="padding:32px 32px 8px;">
<div style="font-family:-apple-system,Arial,sans-serif;font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.4px;">
Orien<span style="color:#f97316;">tico</span>
</div></td></tr>

<tr><td style="padding:20px 32px 0;">
<div style="display:inline-block;padding:4px 12px;background:${lbl.color}15;color:${lbl.color};border-radius:100px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">
✓ Versione ${escapeHtml(lbl.nome)} aggiornata
</div>
<h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.7px;line-height:1.2;">
Le tue modifiche<br>
<span style="font-family:Georgia,serif;font-style:italic;font-weight:400;color:#f97316;">sono applicate.</span>
</h1>
<p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.55;">
L'anteprima per <strong style="color:#111827;">${safeNome}</strong> è stata aggiornata con le tue indicazioni.
</p>
</td></tr>

${modifiche?.length ? `
<tr><td style="padding:0 32px 8px;">
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;">
<div style="font-size:11px;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;font-weight:600;">
Aggiornati
</div>
<ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#374151;line-height:1.5;">${mods}</ul>
</div>
</td></tr>` : ''}

<tr><td style="padding:24px 32px 32px;">
<a href="${link}" style="display:block;width:100%;padding:16px;background:#0f172a;color:#fff;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;text-align:center;box-sizing:border-box;">
Apri l'anteprima aggiornata &rarr;
</a>
<p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
Vuoi altre modifiche? Apri l'anteprima e clicca <em>"Modifica"</em>.
</p>
</td></tr>

<tr><td style="background:#f9fafb;padding:18px 32px;text-align:center;">
<div style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.5;">
<a href="https://orientico.com" style="color:#6b7280;text-decoration:underline;">orientico.com</a> &middot;
<a href="mailto:onboarding@orientico.com" style="color:#6b7280;text-decoration:underline;">onboarding@orientico.com</a>
</div>
</td></tr>

</table></td></tr></table>
</body></html>`;
}

async function sendViaResend({ env, to, subject, html }) {
  const from = env.RESEND_FROM || 'Orientico <onboarding@orientico.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: 'onboarding@orientico.com' }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function onRequestPost(ctx) {
  const { request, params, env } = ctx;
  const authHeader = request.headers.get('X-Admin-Secret') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!authHeader || authHeader !== env.ADMIN_SECRET) {
    return Response.json({ errore: 'Non autorizzato' }, { status: 401 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { id } = params;
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const { data, error } = await supabase
    .from('richieste').select('nome,email').eq('id', id).single();
  if (error || !data) return Response.json({ errore: 'Richiesta non trovata' }, { status: 404 });
  if (!data.email) return Response.json({ errore: 'Email mancante' }, { status: 400 });

  const url = new URL(request.url);
  const html = buildHtml({
    nome:      data.nome,
    id,
    stile:     body.stile || 'minimal',
    modifiche: body.modifiche || [],
    origin:    url.origin,
  });

  try {
    const result = await sendViaResend({
      env,
      to: data.email,
      subject: `Anteprima aggiornata per ${data.nome || 'la tua attività'}`,
      html,
    });
    return Response.json({ ok: true, resend_id: result?.id });
  } catch (e) {
    return Response.json({ errore: e.message }, { status: 502 });
  }
}

export async function onRequest(ctx) {
  return new Response(null, { status: 405 });
}
