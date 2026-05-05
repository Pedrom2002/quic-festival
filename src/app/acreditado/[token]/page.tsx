import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateQrDataUrl } from "@/lib/qr";
import AcreditadoActions from "@/components/acreditado-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function AcreditadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = supabaseAdmin();
  const { data: acc } = await admin
    .from("accreditations")
    .select("name, email, phone, media_company, token")
    .eq("token", token)
    .maybeSingle();

  if (!acc) notFound();

  const qr = await generateQrDataUrl(acc.token);

  return (
    <main className="min-h-dvh grid place-items-center bg-[#06182A] text-[#F4EBD6] p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-[#06111B] bg-[#F4EBD6] text-[#06111B] p-7 text-center shadow-[8px_8px_0_#F2A93C]">
        <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full bg-[#FFD27A] border-2 border-[#06111B] shadow-[4px_4px_0_#06111B] font-black text-3xl">
          ✓
        </div>
        <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-[.14em] bg-blue-700/20 text-blue-700 border border-blue-400/40 mb-3">
          ACREDITAÇÃO MEDIA
        </div>
        <h1 className="font-serif text-3xl font-black leading-none">
          Acreditado<em className="italic text-[#F2A93C]">.</em>
        </h1>
        <p className="text-sm opacity-70 mt-1 mb-1">{acc.name}</p>
        <p className="text-xs font-bold opacity-50 mb-4">{acc.media_company}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt="QR Acreditação"
          className="mx-auto w-56 h-56 rounded-2xl border-2 border-[#06111B] bg-[#F4EBD6]"
        />

        <AcreditadoActions
          qrDataUrl={qr}
          name={acc.name}
          mediaCompany={acc.media_company}
          token={acc.token}
        />

        <p className="text-[11px] opacity-60 mt-5 leading-relaxed">
          8 e 9 de Maio · Monsanto Open Air, Lisboa
        </p>
      </div>
    </main>
  );
}
