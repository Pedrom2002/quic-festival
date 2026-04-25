import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Validação cedo para travar lookup à DB com input lixo.
  if (!UUID_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Anti enumeration / DoS: 60 pedidos/min por IP.
  const rl = await rateLimit(`qr:ip:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("token")
    .eq("token", token)
    .maybeSingle();

  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await QRCode.toBuffer(guest.token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#06111B", light: "#F4EBD6" },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // 1h public cache + 1h SWR. Curto o suficiente para que delete de guest
      // pare de servir QR num razoável horizonte. Não immutable porque
      // existência do guest pode mudar.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=3600",
      "Content-Disposition": 'inline; filename="quic-qr.png"',
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}
