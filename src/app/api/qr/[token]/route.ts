import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("token")
    .eq("token", token)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": 'inline; filename="quic-qr.png"',
    },
  });
}
