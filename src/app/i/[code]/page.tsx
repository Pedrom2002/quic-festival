import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";
import InviteClient from "@/components/invite-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Convite · QUIC Festival 2026",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidInviteCode(code)) notFound();

  const admin = supabaseAdmin();
  const { data: invite } = await admin
    .from("invite_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.archived_at) notFound();

  const expired =
    !!invite.expires_at && new Date(invite.expires_at) < new Date();
  const remaining = Math.max(0, invite.max_uses - invite.uses_count);
  const exhausted = remaining === 0;

  return (
    <InviteClient
      code={code}
      label={(invite.label as string | null) ?? null}
      remaining={remaining}
      total={invite.max_uses as number}
      expired={expired}
      exhausted={exhausted}
    />
  );
}
