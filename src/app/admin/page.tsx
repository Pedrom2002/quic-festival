import { supabaseAdmin } from "@/lib/supabase/admin";
import GuestsTable from "@/components/admin/guests-table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = supabaseAdmin();
  const { data: guests } = await admin
    .from("guests")
    .select(
      "id,created_at,name,email,phone,companion_count,companion_names,token,checked_in_at,email_sent_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl font-black leading-none">
            Convidados
          </h1>
          <p className="text-sm opacity-60 mt-1">
            {guests?.length ?? 0} inscrições
          </p>
        </div>
        <a
          href="/api/admin/export"
          className="rounded-full border-2 border-[#FFD27A] text-[#FFD27A] px-4 py-2 text-xs tracking-[.18em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition"
        >
          Export CSV
        </a>
      </div>

      <GuestsTable initial={guests ?? []} />
    </div>
  );
}
