import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidade · QUIC Festival",
  description: "Política de privacidade e tratamento de dados RGPD.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[#06111B]">
      <h1 className="font-serif text-3xl font-black">Privacidade</h1>
      <p className="opacity-70 mt-1 text-sm">QUIC Festival 2026 · Lisboa</p>

      <section className="mt-8 space-y-4 text-base leading-relaxed">
        <h2 className="font-serif text-xl font-bold">Dados recolhidos</h2>
        <p>
          Para gerir a entrada no festival recolhemos: nome completo, email,
          telefone e (se aplicável) nome e telefone do acompanhante. Estes dados
          são guardados em base de dados Supabase alojada na União Europeia.
        </p>

        <h2 className="font-serif text-xl font-bold">Finalidade</h2>
        <p>
          Os dados são usados exclusivamente para validar a presença, enviar o
          QR de entrada por email e fazer check-in à porta. Não são partilhados
          com terceiros nem usados para marketing.
        </p>

        <h2 className="font-serif text-xl font-bold">Sub-processadores</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Supabase</strong> · base de dados e autenticação (UE).
          </li>
          <li>
            <strong>Resend</strong> · envio do email de confirmação.
          </li>
          <li>
            <strong>Vercel</strong> · alojamento e analytics agregada (sem
            cookies de marketing).
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong> · captcha anti-bot na área
            admin.
          </li>
          <li>
            <strong>Upstash</strong> · rate-limit (chaves anonimizadas).
          </li>
        </ul>

        <h2 className="font-serif text-xl font-bold">Retenção</h2>
        <p>
          Dados de inscrição são apagados após 6 meses do festival. Logs de
          auditoria são apagados após 180 dias.
        </p>

        <h2 className="font-serif text-xl font-bold">Direitos RGPD</h2>
        <p>
          Tens direito de acesso, retificação, eliminação e portabilidade. Para
          exercer envia email para{" "}
          <a className="underline" href="mailto:ola@quic.pt">
            ola@quic.pt
          </a>{" "}
          com a tua morada de email registada. Respondemos em até 30 dias.
        </p>

        <h2 className="font-serif text-xl font-bold">Contacto</h2>
        <p>
          QUIC · Lisboa, Portugal ·{" "}
          <a className="underline" href="mailto:ola@quic.pt">
            ola@quic.pt
          </a>
        </p>
      </section>
    </main>
  );
}
