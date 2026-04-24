import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateQrDataUrl } from "@/lib/qr";
import ConfirmadoActions from "@/components/confirmado-actions";

export const dynamic = "force-dynamic";

export default async function ConfirmadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("name,token,companion_count,companion_names")
    .eq("token", token)
    .maybeSingle();

  if (!guest) notFound();

  const qr = await generateQrDataUrl(guest.token);

  return (
    <main className="min-h-dvh grid place-items-center bg-[#06182A] text-[#F4EBD6] p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-[#06111B] bg-[#F4EBD6] text-[#06111B] p-7 text-center shadow-[8px_8px_0_#F2A93C]">
        <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full bg-[#FFD27A] border-2 border-[#06111B] shadow-[4px_4px_0_#06111B] font-black text-3xl">
          ✓
        </div>
        <h1 className="font-serif text-3xl font-black leading-none">
          Tás <em className="italic text-[#F2A93C]">dentro</em>.
        </h1>
        <p className="text-sm opacity-70 mt-2 mb-4">
          Olá {guest.name}. Mostra este QR à entrada no dia do festival.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt="QR"
          className="mx-auto w-64 h-64 rounded-2xl border-2 border-[#06111B] bg-[#F4EBD6]"
        />
        {guest.companion_count > 0 && (
          <p className="text-xs opacity-70 mt-4">
            Acompanhante: {guest.companion_names.join(", ")}
          </p>
        )}

        <ConfirmadoActions qrDataUrl={qr} token={guest.token} name={guest.name} />

        <p className="text-[11px] opacity-60 mt-5 leading-relaxed">
          8 e 9 de Maio · Monsanto Open Air, Lisboa
        </p>
      </div>
    </main>
  );
}
