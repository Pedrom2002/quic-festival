import { supabaseAdmin } from "@/lib/supabase/admin";
import AcreditacoesPanel from "@/components/admin/acreditacoes-panel";

export const dynamic = "force-dynamic";

export default async function AdminAcreditacoesPage() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("accreditation_links")
    .select("id, code, label, max_uses, uses_count, expires_at, archived_at, created_at")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  const links = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    label: (row.label as string | null) ?? null,
    max_uses: row.max_uses as number,
    uses_count: row.uses_count as number,
    expires_at: (row.expires_at as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));

  return <AcreditacoesPanel initialLinks={links} />;
}
