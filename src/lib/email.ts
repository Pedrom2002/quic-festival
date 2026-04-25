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
  token: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// Plain-text safe: remove CR/LF para impedir injecção de linhas no fallback texto.
function textSafe(s: string) {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export async function sendRsvpEmail({ to, name, token }: SendArgs) {
  const fromEnv = process.env.RESEND_FROM;
  if (!fromEnv && process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM em falta em produção");
  }
  const from = fromEnv ?? "QUIC Festival <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const confirmUrl = `${site}/confirmado/${token}`;
  const qrUrl = `${site}/api/qr/${token}`;
  const logoUrl = `${site}/logo.png`;

  const subject = "Tás dentro · QUIC Festival 2026";
  const preheader = "Mostra o QR à entrada · QUIC Festival 2026, Lisboa";
  const safeName = escapeHtml(name);
  const textName = textSafe(name);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${subject}</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    /* Gmail iOS / Android dark mode lock */
    u + .body .gmail-blend-screen { background: #06182A; mix-blend-mode: screen; }
    u + .body .gmail-blend-difference { background: #06182A; mix-blend-mode: difference; }
    /* Apple Mail dark mode lock */
    @media (prefers-color-scheme: dark) {
      .lock-bg { background: #06182A !important; }
      .lock-paper { background: #F4EBD6 !important; color: #06111B !important; }
      .lock-ink { color: #06111B !important; }
      .lock-glow { color: #FFD27A !important; }
      .lock-coral { color: #E8613C !important; }
      .lock-amber { color: #F2A93C !important; }
    }
  </style>
</head>
<body class="body lock-bg" style="margin:0;padding:0;background:#06182A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#F4EBD6;">

  <!-- preheader -->
  <div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06182A" class="lock-bg" style="background:#06182A;">
    <tr><td align="center" style="padding:28px 14px 40px 14px;">

      <!-- HERO -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:12px 0 0 0;">
          <img src="${logoUrl}" alt="QUIC Festival 2026" width="300" style="display:block;width:300px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;" />
        </td></tr>

        <!-- DATAS (mesma img do frontend, sobrepõe levemente o logo) -->
        <tr><td align="center" style="padding:0 0 14px 0;">
          <div style="margin-top:-42px;">
            <img src="${site}/datas.png" alt="8 e 9 de Maio · QUIC Festival 2026, Lisboa · Bilhetes em FNAC, Wortek, El Corte Inglês e Ticketline.pt" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;" />
          </div>
        </td></tr>
      </table>

      <!-- PAPER CARD -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EBD6" class="lock-paper" style="max-width:560px;width:100%;background:#F4EBD6;color:#06111B;border-radius:22px;border:2px solid #06111B;">
        <tr><td style="padding:30px 30px 6px 30px;">
          <p style="margin:0;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#E8613C;font-weight:700;">Confirmação · RSVP</p>
          <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.05;font-weight:900;color:#06111B;">
            Olá ${safeName}, tás <em style="color:#F2A93C;font-style:italic;">dentro</em>.
          </h1>
          <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#3a4b5a;">
            Guarda este email. O QR abaixo é a tua entrada no <strong style="color:#06111B;">QUIC Festival 2026, Lisboa</strong>.
          </p>
        </td></tr>

        <!-- QR -->
        <tr><td align="center" style="padding:22px 30px 6px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius:18px;background:#FFFFFF;border:2px solid #06111B;">
            <tr><td style="padding:14px;">
              <img src="${qrUrl}" alt="QR de entrada QUIC Festival" width="240" height="240" style="display:block;width:240px;height:240px;border:0;outline:none;text-decoration:none;" />
            </td></tr>
          </table>
          <p style="margin:10px 0 0 0;font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6a7885;">entrada pessoal · não partilhes</p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:22px 30px 8px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" bgcolor="#06111B" style="border-radius:99px;">
              <a href="${confirmUrl}" style="display:inline-block;background:#06111B;color:#FFD27A;text-decoration:none;font-weight:900;letter-spacing:.14em;padding:14px 26px;border-radius:99px;font-size:14px;border:2px solid #06111B;">
                ABRIR NO BROWSER
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 0 0 0;"></td></tr>

        <!-- DIVIDER -->
        <tr><td style="padding:0 30px;">
          <div style="height:2px;background:#06111B;opacity:.12;border-radius:2px;"></div>
        </td></tr>

        <!-- INFO 2 COLS -->
        <tr><td style="padding:22px 30px 26px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="padding-right:8px;">
                <p style="margin:0;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#E8613C;font-weight:700;">Local</p>
                <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:900;color:#06111B;line-height:1.15;">QUIC<br/>Festival 2026</p>
              </td>
              <td width="50%" valign="top" style="padding-left:8px;">
                <p style="margin:0;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#E8613C;font-weight:700;">Portas</p>
                <p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:17px;font-weight:900;color:#06111B;line-height:1.15;">17:00</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 30px 26px 30px;font-size:12px;color:#6a7885;line-height:1.55;">
          Se não foste tu a inscrever-te, ignora este email. Dúvidas → responde diretamente.
        </td></tr>
      </table>

      <!-- FOOTER -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding:22px 16px 0 16px;">
          <p style="margin:0;color:#FFD27A;font-size:11px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;">QUIC · Festival</p>
          <p style="margin:6px 0 0 0;color:#7c8a97;font-size:11px;line-height:1.6;">
            Lisboa · Portugal · <a href="https://quic.pt" style="color:#7c8a97;text-decoration:underline;">quic.pt</a>
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  const text = `QUIC Festival 2026 — tás dentro.

Olá ${textName},

O QR em anexo é a tua entrada no QUIC Festival 2026, Lisboa.
Portas às 17:00.

Abrir no browser: ${confirmUrl}

Dúvidas? Responde a este email.
— QUIC Festival
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
