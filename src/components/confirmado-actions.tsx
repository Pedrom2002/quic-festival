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

  async function downloadCard() {
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

    // ── Header ──────────────────────────────────────
    ctx.textAlign = "center";

    // Stars
    ctx.fillStyle = "rgba(255,210,122,0.55)";
    ctx.font = "13px sans-serif";
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
    const qrSize = 480;
    const qrBoxPad = 24;
    const qrBoxW = qrSize + qrBoxPad * 2;
    const qrBoxH = qrSize + qrBoxPad * 2;
    const qrBoxX = (W - qrBoxW) / 2;
    const qrBoxY = 262;

    // Cream card behind QR
    ctx.fillStyle = "#F4EBD6";
    roundRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 18);
    ctx.fill();

    // QR image
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((res) => {
      qrImg.onload = () => res();
    });
    ctx.drawImage(qrImg, qrBoxX + qrBoxPad, qrBoxY + qrBoxPad, qrSize, qrSize);

    // ── Guest info ───────────────────────────────────
    const infoY = qrBoxY + qrBoxH + 44;

    // Name
    ctx.fillStyle = "#F4EBD6";
    ctx.font = '700 38px "Fraunces", serif';
    ctx.fillText(name, W / 2, infoY);

    // Tag line
    ctx.fillStyle = "rgba(244,235,214,0.5)";
    ctx.font = '500 12px "DM Sans", sans-serif';
    ctx.fillText("C O N V I T E   P E S S O A L   ·   I N T R A N S M I S S Í V E L", W / 2, infoY + 32);

    // Gold rule
    ctx.fillStyle = "#FFD27A";
    ctx.fillRect(W / 2 - 60, infoY + 52, 120, 1.5);

    // Date + venue
    ctx.fillStyle = "#FFD27A";
    ctx.font = '700 15px "DM Sans", sans-serif';
    ctx.fillText("8 & 9 MAIO 2026", W / 2, infoY + 84);

    ctx.fillStyle = "rgba(244,235,214,0.6)";
    ctx.font = '500 13px "DM Sans", sans-serif';
    ctx.fillText("Monsanto Open Air, Lisboa", W / 2, infoY + 108);

    // Bottom stars
    ctx.fillStyle = "rgba(255,210,122,0.35)";
    ctx.font = "11px sans-serif";
    ctx.fillText("★   ★   ★", W / 2, H - 46);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `quic-convite-${safeName}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-5">
      <button
        onClick={() => void downloadCard()}
        className="flex-1 rounded-full border-2 border-[#06111B] bg-[#06111B] text-[#FFD27A] px-4 py-3 font-black tracking-[.14em] text-xs uppercase hover:bg-[#F2A93C] hover:text-[#06111B] transition cursor-pointer"
      >
        Guardar QR
      </button>
      <a
        href={`/api/ics/${token}`}
        className="flex-1 rounded-full border-2 border-[#06111B] text-[#06111B] px-4 py-3 font-black tracking-[.14em] text-xs uppercase hover:bg-[#06111B] hover:text-[#FFD27A] transition"
      >
        Add ao calendário
      </a>
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
