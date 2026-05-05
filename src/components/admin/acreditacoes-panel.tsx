"use client";

import { useState, useTransition } from "react";

type Accreditation = {
  id: string;
  name: string;
  email: string;
  phone: string;
  media_company: string;
  token: string;
  archived_at: string | null;
  created_at: string;
};

export default function AcreditacoesPanel({
  initialAccreditations,
}: {
  initialAccreditations: Accreditation[];
}) {
  const [accreditations, setAccreditations] = useState<Accreditation[]>(initialAccreditations);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mediaCompany, setMediaCompany] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/acreditacoes", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      accreditations?: Accreditation[];
    };
    if (json.accreditations) setAccreditations(json.accreditations);
  }

  async function createAccreditation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/acreditacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          media_company: mediaCompany.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Falha a criar.");
        return;
      }
      setSuccess("Acreditação criada com sucesso.");
      setName("");
      setEmail("");
      setPhone("");
      setMediaCompany("");
      await refresh();
    });
  }

  async function toggleArchive(acc: Accreditation) {
    const archived = !acc.archived_at;
    startTransition(async () => {
      const res = await fetch(`/api/admin/acreditacoes/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) {
        setError("Falha a actualizar estado.");
        return;
      }
      await refresh();
    });
  }

  async function downloadCard(acc: Accreditation) {
    const QRCode = (await import("qrcode")).default;

    const W = 800;
    const H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    await document.fonts.load('900 100px "Big Shoulders Stencil"');
    await document.fonts.load('700 40px "Fraunces"');
    await document.fonts.load('500 18px "DM Sans"');

    // Background
    ctx.fillStyle = "#06111B";
    ctx.fillRect(0, 0, W, H);

    // Outer gold border
    ctx.strokeStyle = "#FFD27A";
    ctx.lineWidth = 3;
    roundRect(ctx, 22, 22, W - 44, H - 44, 20);
    ctx.stroke();

    // Inner faint border
    ctx.strokeStyle = "rgba(242,169,60,0.25)";
    ctx.lineWidth = 1;
    roundRect(ctx, 34, 34, W - 68, H - 68, 14);
    ctx.stroke();

    ctx.textAlign = "center";

    // Stars
    ctx.fillStyle = "rgba(255,210,122,0.55)";
    ctx.font = '500 13px "DM Sans", sans-serif';
    ctx.fillText("★   ★   ★", W / 2, 88);

    // QUIC
    ctx.fillStyle = "#FFD27A";
    ctx.font = '900 108px "Big Shoulders Stencil", sans-serif';
    ctx.fillText("QUIC", W / 2, 188);

    // FESTIVAL 2026
    ctx.fillStyle = "#F4EBD6";
    ctx.font = '500 15px "DM Sans", sans-serif';
    ctx.fillText("F E S T I V A L   2 0 2 6", W / 2, 222);

    // Gold rule
    ctx.fillStyle = "#FFD27A";
    ctx.fillRect(W / 2 - 80, 240, 160, 2);

    // ── QR box ──────────────────────────────────────
    const qrSize = 380;
    const qrBoxPad = 24;
    const qrBoxW = qrSize + qrBoxPad * 2;
    const qrBoxH = qrSize + qrBoxPad * 2;
    const qrBoxX = (W - qrBoxW) / 2;
    const qrBoxY = 262;

    // Cream card behind QR
    ctx.fillStyle = "#F4EBD6";
    roundRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 18);
    ctx.fill();

    // "ACREDITAÇÃO MEDIA" badge inside cream box
    ctx.font = '700 11px "DM Sans", sans-serif';
    const badgeLabel = "ACREDITAÇÃO MEDIA";
    const badgeW = ctx.measureText(badgeLabel).width + 16;
    const badgeX = qrBoxX + qrBoxW - badgeW - 12;
    const badgeY = qrBoxY + 12;
    ctx.fillStyle = "#06111B";
    roundRect(ctx, badgeX, badgeY, badgeW, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#FFD27A";
    ctx.fillText(badgeLabel, badgeX + badgeW / 2, badgeY + 15);

    // QR image from token
    const qrDataUrl = await QRCode.toDataURL(acc.token, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#06111B", light: "#F4EBD6" },
    });
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((res) => {
      qrImg.onload = () => res();
    });
    ctx.drawImage(qrImg, qrBoxX + qrBoxPad, qrBoxY + qrBoxPad, qrSize, qrSize);

    // ── Info section ────────────────────────────────
    const infoY = qrBoxY + qrBoxH + 44;

    // Name
    ctx.fillStyle = "#F4EBD6";
    ctx.font = '700 38px "Fraunces", serif';
    ctx.fillText(acc.name, W / 2, infoY);

    // Media company
    ctx.fillStyle = "#FFD27A";
    ctx.font = '500 18px "DM Sans", sans-serif';
    ctx.fillText(acc.media_company, W / 2, infoY + 38);

    // Tag line
    ctx.fillStyle = "rgba(244,235,214,0.5)";
    ctx.font = '500 12px "DM Sans", sans-serif';
    ctx.fillText("A C R E D I T A Ç Ã O   M E D I A", W / 2, infoY + 72);

    // Gold rule
    ctx.fillStyle = "#FFD27A";
    ctx.fillRect(W / 2 - 60, infoY + 92, 120, 1.5);

    // Date + venue
    ctx.fillStyle = "#FFD27A";
    ctx.font = '700 15px "DM Sans", sans-serif';
    ctx.fillText("8 & 9 MAIO 2026", W / 2, infoY + 124);

    ctx.fillStyle = "rgba(244,235,214,0.6)";
    ctx.font = '500 13px "DM Sans", sans-serif';
    ctx.fillText("Monsanto Open Air, Lisboa", W / 2, infoY + 148);

    // Bottom stars
    ctx.fillStyle = "rgba(255,210,122,0.35)";
    ctx.font = '500 11px "DM Sans", sans-serif';
    ctx.fillText("★   ★   ★", W / 2, H - 46);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `quic-acreditacao-${acc.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="grid gap-8 max-w-5xl">
      <section className="rounded-2xl border-2 border-[#FFD27A]/40 bg-[#06111B]/40 p-6">
        <h1 className="font-serif text-3xl font-black mb-1">
          Acreditações <em className="not-italic text-[#F2A93C]">Media</em>
        </h1>
        <p className="text-sm opacity-70 mb-4">
          Regista acreditações de media para o festival. Gera o card de cada acreditado.
        </p>

        <form
          onSubmit={createAccreditation}
          noValidate
          className="grid gap-3 sm:grid-cols-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            maxLength={120}
            required
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="Telemóvel (9XXXXXXXX)"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            required
          />
          <input
            value={mediaCompany}
            onChange={(e) => setMediaCompany(e.target.value)}
            placeholder="Empresa de media"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            maxLength={120}
            required
          />
          <button
            type="submit"
            disabled={isPending}
            className="sm:col-span-2 rounded-lg border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-3 py-2 text-xs tracking-[.16em] uppercase font-black hover:bg-[#F2A93C] disabled:opacity-50 transition"
          >
            {isPending ? "..." : "Criar Acreditação"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="mt-3 text-sm text-emerald-300" role="status">
            {success}
          </p>
        )}
      </section>

      <section>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.16em] opacity-60">
            <tr className="text-left">
              <th className="py-2">Nome</th>
              <th className="py-2">Email</th>
              <th className="py-2">Telemóvel</th>
              <th className="py-2">Empresa</th>
              <th className="py-2">Estado</th>
              <th className="py-2 text-right">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {accreditations.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center opacity-60">
                  Nenhuma acreditação ainda.
                </td>
              </tr>
            )}
            {accreditations.map((acc) => {
              const archived = !!acc.archived_at;
              return (
                <tr key={acc.id} className={archived ? "opacity-50" : ""}>
                  <td className="py-3 pr-3">
                    <div className="font-bold">{acc.name}</div>
                    <div className="text-xs opacity-60">
                      {new Date(acc.created_at).toLocaleString("pt-PT")}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs">{acc.email}</td>
                  <td className="py-3 pr-3 text-xs">{acc.phone}</td>
                  <td className="py-3 pr-3">
                    <div className="text-xs font-medium">{acc.media_company}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[.12em] bg-blue-700/40 text-blue-200">
                      MEDIA
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[.16em] ${
                        archived
                          ? "bg-white/15 text-white/70"
                          : "bg-emerald-700/40 text-emerald-200"
                      }`}
                    >
                      {archived ? "ARQUIVADO" : "ACTIVO"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => void downloadCard(acc)}
                        className="rounded border border-white/20 px-2 py-1 text-[11px] tracking-[.16em] uppercase hover:border-[#FFD27A] hover:text-[#FFD27A]"
                      >
                        Gerar Card
                      </button>
                      <button
                        onClick={() => toggleArchive(acc)}
                        disabled={isPending}
                        className="rounded border border-white/20 px-2 py-1 text-[11px] tracking-[.16em] uppercase hover:border-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        {archived ? "Reactivar" : "Arquivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
