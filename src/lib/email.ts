import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendArgs = {
  to: string;
  name: string;
  qrDataUrl: string;
  token: string;
};

export async function sendRsvpEmail({ to, name, qrDataUrl, token }: SendArgs) {
  const from = process.env.RESEND_FROM ?? "QUIC Festival <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const confirmUrl = `${site}/confirmado/${token}`;

  const subject = "Tás dentro · QUIC Festival 2026";
  const html = `<!doctype html>
<html lang="pt-PT">
<body style="margin:0;padding:0;background:#06182A;font-family:Helvetica,Arial,sans-serif;color:#F4EBD6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06182A;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#F4EBD6;color:#06111B;border-radius:20px;border:2px solid #06111B;">
        <tr><td style="padding:28px 28px 8px 28px;">
          <p style="margin:0;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#E8613C;">QUIC Festival · 2026</p>
          <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.05;font-weight:900;">Olá ${escapeHtml(name)}, tás <em style="color:#F2A93C;">dentro</em>.</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.5;color:rgba(6,17,27,.75);">
            Guarda este email. O QR abaixo é a tua entrada no dia <strong>8 e 9 de Maio</strong> em Monsanto Open Air, Lisboa.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px;">
          <img src="${qrDataUrl}" alt="QR code" width="260" height="260" style="display:block;width:260px;height:260px;border:2px solid #06111B;border-radius:16px;background:#F4EBD6;" />
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;" align="center">
          <a href="${confirmUrl}" style="display:inline-block;background:#06111B;color:#FFD27A;text-decoration:none;font-weight:900;letter-spacing:.14em;padding:14px 22px;border-radius:99px;font-size:14px;">ABRIR NO BROWSER</a>
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;font-size:12px;color:rgba(6,17,27,.55);">
          Se não foste tu que te inscreveste, ignora este email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message ?? "Falha a enviar email");
  }

  return data;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
