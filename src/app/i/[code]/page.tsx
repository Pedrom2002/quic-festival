import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";
import RsvpForm from "@/components/rsvp-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Convite · QUIC Festival 2026",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidInviteCode(code)) notFound();

  const admin = supabaseAdmin();
  const { data: invite } = await admin
    .from("invite_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.archived_at) notFound();

  const expired =
    !!invite.expires_at && new Date(invite.expires_at) < new Date();
  const remaining = Math.max(0, invite.max_uses - invite.uses_count);
  const exhausted = remaining === 0;

  return (
    <main className="relative isolate min-h-screen px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#FFD27A]">
          Convite · QUIC Festival 2026
        </p>
        <h1 className="mt-3 font-serif text-5xl font-black leading-[0.95] text-[#F4EBD6] sm:text-6xl">
          {invite.label ?? "Convite especial"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-[#F4EBD6]/70">
          Estás na lista. Confirma a tua presença para receberes o QR de
          entrada por email.
        </p>

        {expired ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border-2 border-rose-300/50 bg-rose-900/40 px-5 py-4 text-rose-100">
            Este convite expirou. Contacta o organizador.
          </div>
        ) : exhausted ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border-2 border-amber-300/50 bg-amber-900/40 px-5 py-4 text-amber-100">
            Convite esgotado. Já não há vagas neste link.
          </div>
        ) : (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#FFD27A]/40 bg-[#06111B]/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FFD27A]">
            <span className="h-2 w-2 rounded-full bg-[#FFD27A]" />
            {remaining} {remaining === 1 ? "vaga restante" : "vagas restantes"}{" "}
            de {invite.max_uses}
          </p>
        )}
      </header>

      {!expired && !exhausted && (
        <section className="mx-auto mt-10 max-w-xl sm:mt-14">
          <RsvpForm inviteCode={code} />
        </section>
      )}
    </main>
  );
}
