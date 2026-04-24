import QrScanner from "@/components/admin/qr-scanner";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-black leading-none">
            Check-in
          </h1>
          <p className="text-sm opacity-60 mt-1">
            Aponta a câmara ao QR de cada convidado.
          </p>
        </div>
        <a
          href="/admin"
          className="rounded-full border-2 border-white/25 px-4 py-2 text-xs tracking-[.18em] uppercase hover:border-[#FFD27A] transition"
        >
          ← Tabela
        </a>
      </div>
      <QrScanner />
    </div>
  );
}
