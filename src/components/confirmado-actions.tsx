"use client";

export default function ConfirmadoActions({
  qrDataUrl,
  token,
  name,
}: {
  qrDataUrl: string;
  token: string;
  name: string;
}) {
  const safeName = name.replace(/[^a-z0-9\-]+/gi, "-").toLowerCase();

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-5">
      <a
        href={qrDataUrl}
        download={`quic-qr-${safeName}.png`}
        className="flex-1 rounded-full border-2 border-[#06111B] bg-[#06111B] text-[#FFD27A] px-4 py-3 font-black tracking-[.14em] text-xs uppercase hover:bg-[#F2A93C] hover:text-[#06111B] transition"
      >
        Guardar QR
      </a>
      <a
        href={`/api/ics/${token}`}
        className="flex-1 rounded-full border-2 border-[#06111B] text-[#06111B] px-4 py-3 font-black tracking-[.14em] text-xs uppercase hover:bg-[#06111B] hover:text-[#FFD27A] transition"
      >
        Add ao calendário
      </a>
    </div>
  );
}
