import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";
import AccreditationClient from "@/components/accreditation-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acreditação Media · QUIC Festival 2026",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function AccreditationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidInviteCode(code)) notFound();

  const admin = supabaseAdmin();
  const { data: link } = await admin
    .from("accreditation_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.archived_at) notFound();

  const expired = !!link.expires_at && new Date(link.expires_at) < new Date();
  const exhausted = link.uses_count >= link.max_uses;

  return (
    <AccreditationClient
      code={code}
      label={(link.label as string | null) ?? null}
      expired={expired}
      exhausted={exhausted}
    />
  );
}
