import { supabaseAdmin } from "@/lib/supabase/admin";
import AcreditacoesPanel from "@/components/admin/acreditacoes-panel";

export const dynamic = "force-dynamic";

export default async function AdminAcreditacoesPage() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("accreditations")
    .select("id, name, email, phone, media_company, token, archived_at, created_at")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  const accreditations = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    media_company: row.media_company as string,
    token: row.token as string,
    archived_at: (row.archived_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));

  return <AcreditacoesPanel initialAccreditations={accreditations} />;
}
