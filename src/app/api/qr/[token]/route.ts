import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";
import { verifyQrToken } from "@/lib/qr-token";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Aceita token assinado (preferido) ou UUID legacy se secret não definido.
  const verified = await verifyQrToken(token);
  if (!verified.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";
  // Anti enumeration / DoS: 60 pedidos/min por IP.
  const rl = await rateLimit(`qr:ip:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: rl.degraded ? 503 : 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("token")
    .eq("token", verified.uuid)
    .maybeSingle();

  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  // O conteúdo do QR é a string ORIGINAL (assinada) — o scanner valida
  // no /api/admin/checkin. Para tokens legacy (UUID puro), continua igual.
  const buffer = await QRCode.toBuffer(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#06111B", light: "#F4EBD6" },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // QR é credencial de entrada. Cache privada apenas, TTL curto.
      "Cache-Control": "private, max-age=60, must-revalidate",
      "Content-Disposition": 'inline; filename="quic-qr.png"',
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}
