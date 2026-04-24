import { Resend } from "resend";

let cached: Resend | null = null;
function client(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY em falta");
  cached = new Resend(key);
  return cached;
}

type SendArgs = {
  to: string;
  name: string;
  qrDataUrl: string;
  token: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export async function sendRsvpEmail({ to, name, qrDataUrl, token }: SendArgs) {
  const from = process.env.RESEND_FROM ?? "QUIC Festival <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const confirmUrl = `${site}/confirmado/${token}`;
  const icsUrl = `${site}/api/ics/${token}`;

  const subject = "Tás dentro · QUIC Festival 2026";
  const preheader = `Mostra o QR à entrada · 8 e 9 Maio · Monsanto Open Air`;
  const safeName = escapeHtml(name);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#06182A;font-family:Helvetica,Arial,sans-serif;color:#F4EBD6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06182A;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#F4EBD6;color:#06111B;border-radius:20px;border:2px solid #06111B;">
        <tr><td style="padding:28px 28px 8px 28px;">
          <p style="margin:0;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#E8613C;">QUIC Festival · 2026</p>
          <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.05;font-weight:900;color:#06111B;">Olá ${safeName}, tás <em style="color:#F2A93C;font-style:italic;">dentro</em>.</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.5;color:#3a4b5a;">
            Guarda este email. O QR abaixo é a tua entrada no dia <strong style="color:#06111B;">8 e 9 de Maio</strong> em Monsanto Open Air, Lisboa.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px;">
          <img src="${qrDataUrl}" alt="QR de entrada" width="260" height="260" style="display:block;width:260px;height:260px;border:2px solid #06111B;border-radius:16px;background:#F4EBD6;" />
        </td></tr>
        <tr><td style="padding:0 28px 8px 28px;" align="center">
          <a href="${confirmUrl}" style="display:inline-block;background:#06111B;color:#FFD27A;text-decoration:none;font-weight:900;letter-spacing:.14em;padding:14px 22px;border-radius:99px;font-size:14px;">ABRIR NO BROWSER</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;" align="center">
          <a href="${icsUrl}" style="display:inline-block;color:#06111B;text-decoration:underline;font-size:12px;letter-spacing:.1em;">Adicionar ao calendário</a>
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;font-size:12px;color:#6a7885;line-height:1.5;">
          Se não foste tu a inscrever-te, ignora este email.<br />
          Dúvidas: responde a este email.
        </td></tr>
      </table>
      <p style="color:#7c8a97;font-size:11px;margin:16px 0 0 0;letter-spacing:.14em;text-transform:uppercase;">quic.pt</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `QUIC Festival 2026 — estás dentro.
Olá ${name}, mostra o QR à entrada no dia 8 e 9 de Maio em Monsanto Open Air, Lisboa.
Abrir no browser: ${confirmUrl}
Adicionar ao calendário: ${icsUrl}
`;

  const { data, error } = await client().emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message ?? "Falha a enviar email");
  }

  return data;
}
