import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";
import AccreditationForm from "@/components/accreditation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acreditação Media · QUIC Festival 2026",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function AccreditationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidInviteCode(code)) notFound();

  const admin = supabaseAdmin();
  const { data: link } = await admin
    .from("accreditation_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.archived_at) notFound();

  const expired = !!link.expires_at && new Date(link.expires_at) < new Date();
  const exhausted = link.uses_count >= link.max_uses;

  return (
    <main className="min-h-dvh bg-[#06182A] text-[#F4EBD6] grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[.22em] uppercase text-[#FFD27A] mb-3">
            ★ &nbsp; ★ &nbsp; ★
          </p>
          <h1 className="font-black text-6xl tracking-tight text-[#FFD27A]"
            style={{ fontFamily: "'Big Shoulders Stencil', sans-serif" }}>
            QUIC
          </h1>
          <p className="text-xs tracking-[.2em] uppercase opacity-60 mt-1">
            F E S T I V A L &nbsp; 2 0 2 6
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-[.14em] bg-blue-700/30 text-blue-200 border border-blue-500/30">
            ACREDITAÇÃO MEDIA
          </div>
          {link.label && (
            <p className="mt-2 text-sm opacity-70">{link.label}</p>
          )}
        </div>

        {expired && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-300 text-center" role="alert">
            Este link de acreditação expirou.
          </div>
        )}
        {exhausted && !expired && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300 text-center" role="alert">
            Todas as acreditações deste link foram utilizadas.
          </div>
        )}

        {!expired && !exhausted && (
          <AccreditationForm accreditationCode={code} />
        )}

        <p className="text-center text-[11px] opacity-40 mt-8">
          8 e 9 de Maio · Monsanto Open Air, Lisboa
        </p>
      </div>
    </main>
  );
}
