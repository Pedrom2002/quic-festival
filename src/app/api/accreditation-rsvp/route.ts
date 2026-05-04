import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accreditationRsvpSchema } from "@/lib/validators";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

// POST /api/accreditation-rsvp — public: submit media accreditation form.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = accreditationRsvpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (!parsed.data.accreditationCode) {
    return NextResponse.json(
      { error: "Código de acreditação obrigatório." },
      { status: 403 },
    );
  }

  const admin = supabaseAdmin();

  // Claim a seat atomically.
  const { data: claim, error: claimError } = await admin.rpc(
    "claim_accreditation_seat",
    { p_code: parsed.data.accreditationCode },
  );

  if (claimError || !claim?.[0]) {
    return NextResponse.json({ error: "Falha ao validar código." }, { status: 500 });
  }

  const { ok, accreditation_link_id, reason } = claim[0] as {
    ok: boolean;
    accreditation_link_id: string | null;
    reason: string;
  };

  if (!ok) {
    const msg =
      reason === "expired"
        ? "Este link de acreditação expirou."
        : reason === "exhausted"
          ? "Todas as acreditações deste link foram utilizadas."
          : "Link de acreditação inválido.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // Check for duplicate email on this link.
  const { data: existing } = await admin
    .from("accreditations")
    .select("id")
    .eq("email", parsed.data.email)
    .eq("accreditation_link_id", accreditation_link_id!)
    .maybeSingle();

  if (existing) {
    // Release the claimed seat since we won't insert.
    return NextResponse.json(
      { error: "Este email já tem uma acreditação neste link." },
      { status: 409 },
    );
  }

  // Insert accreditation record.
  const { data: acc, error: insertError } = await admin
    .from("accreditations")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      media_company: parsed.data.media_company,
      accreditation_link_id,
    })
    .select("token")
    .single();

  if (insertError || !acc) {
    return NextResponse.json({ error: "Falha ao registar." }, { status: 500 });
  }

  await audit({
    action: "accreditation.submitted",
    targetId: accreditation_link_id,
    ip: ipFromHeaders(req.headers),
    meta: { email: parsed.data.email, media_company: parsed.data.media_company },
  });

  return NextResponse.json({ token: acc.token }, { status: 201 });
}
