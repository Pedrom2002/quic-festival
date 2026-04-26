import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade · QUIC Festival",
  description: "Política de privacidade e tratamento de dados RGPD.",
};

const SUBPROCESSORS: { name: string; role: string }[] = [
  { name: "Supabase", role: "base de dados e autenticação · UE" },
  { name: "Resend", role: "envio do email de confirmação" },
  { name: "Vercel", role: "alojamento · analytics agregada (sem cookies de marketing)" },
  { name: "Cloudflare Turnstile", role: "captcha anti-bot na área admin" },
  { name: "Upstash", role: "rate-limit (chaves anonimizadas)" },
];

const SECTIONS: {
  num: string;
  label: string;
  body: React.ReactNode;
}[] = [
  {
    num: "01",
    label: "Dados recolhidos",
    body: (
      <p>
        Para gerir a entrada no festival recolhemos: <strong>nome completo</strong>,{" "}
        <strong>email</strong>, <strong>telefone</strong> e (se aplicável) nome
        e telefone do <strong>acompanhante</strong>. Tudo guardado em base de
        dados Supabase alojada na União Europeia.
      </p>
    ),
  },
  {
    num: "02",
    label: "Finalidade",
    body: (
      <p>
        Os dados servem exclusivamente para validar a presença, enviar o QR de
        entrada por email e fazer check-in à porta. Nunca partilhamos com
        terceiros nem usamos para marketing.
      </p>
    ),
  },
  {
    num: "03",
    label: "Sub-processadores",
    body: (
      <ul className="grid gap-2">
        {SUBPROCESSORS.map((s) => (
          <li
            key={s.name}
            className="flex flex-col rounded-lg border border-[#06111B]/15 bg-[#06111B]/[0.025] px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <span className="font-serif text-base font-black text-[#06111B]">
              {s.name}
            </span>
            <span className="text-sm text-[#3a4b5a]">{s.role}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    num: "04",
    label: "Retenção",
    body: (
      <p>
        Inscrições são apagadas <strong>6 meses</strong> após o festival. Logs
        de auditoria são apagados <strong>180 dias</strong> após o registo, via
        cron automático.
      </p>
    ),
  },
  {
    num: "05",
    label: "Direitos RGPD",
    body: (
      <p>
        Tens direito a <strong>acesso</strong>, <strong>retificação</strong>,{" "}
        <strong>eliminação</strong> e <strong>portabilidade</strong>. Para
        exercer envia email para{" "}
        <a
          className="font-bold underline decoration-[#B83F1F] decoration-2 underline-offset-2 hover:bg-[#FFD27A]/40"
          href="mailto:info@quic.pt"
        >
          info@quic.pt
        </a>{" "}
        com a tua morada de email registada. Respondemos em até{" "}
        <strong>30 dias</strong>.
      </p>
    ),
  },
  {
    num: "06",
    label: "Contacto",
    body: (
      <p>
        QUIC · Lisboa, Portugal ·{" "}
        <a
          className="font-bold underline decoration-[#B83F1F] decoration-2 underline-offset-2 hover:bg-[#FFD27A]/40"
          href="mailto:info@quic.pt"
        >
          info@quic.pt
        </a>
      </p>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <main className="relative isolate min-h-screen px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      {/* Hero */}
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#FFD27A]">
          QUIC · Festival 2026
        </p>
        <h1 className="mt-3 font-serif text-5xl font-black leading-[0.95] text-[#F4EBD6] sm:text-6xl">
          Privacidade
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-[#F4EBD6]/70">
          Como tratamos os dados que partilhas connosco, em linguagem direta e
          sem letra miudinha.
        </p>
      </header>

      {/* Paper card */}
      <article className="mx-auto mt-10 max-w-2xl rounded-[28px] border-2 border-[#06111B] bg-[#F4EBD6] text-[#06111B] shadow-[6px_6px_0_#06111B] sm:mt-14">
        <div className="space-y-10 px-6 py-10 sm:px-10 sm:py-12">
          {SECTIONS.map((s) => (
            <section key={s.num} className="grid gap-3 sm:grid-cols-[68px_1fr] sm:gap-6">
              <div className="flex sm:flex-col sm:items-end sm:text-right">
                <span className="font-serif text-3xl font-black leading-none text-[#B83F1F]">
                  {s.num}
                </span>
                <span className="ml-3 self-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#06111B]/60 sm:ml-0 sm:mt-2 sm:self-auto">
                  bloc
                </span>
              </div>
              <div>
                <h2 className="font-serif text-xl font-black leading-tight text-[#06111B]">
                  {s.label}
                </h2>
                <div className="mt-2 space-y-2 text-base leading-relaxed text-[#06111B]">
                  {s.body}
                </div>
              </div>
            </section>
          ))}
        </div>

        <hr className="mx-6 border-t border-dashed border-[#06111B]/25 sm:mx-10" />

        <footer className="px-6 py-6 text-center text-xs uppercase tracking-[0.22em] text-[#06111B]/55 sm:px-10">
          Última actualização · 25.04.2026
        </footer>
      </article>

      {/* Voltar pill */}
      <div className="mx-auto mt-10 max-w-2xl text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#06111B] bg-[#06111B] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-[#FFD27A] shadow-[3px_3px_0_#06111B] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#06111B]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M11 18l-6-6 6-6" />
          </svg>
          <span>VOLTAR</span>
        </Link>
      </div>
    </main>
  );
}
