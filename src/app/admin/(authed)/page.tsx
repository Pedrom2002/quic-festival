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

  const rows = guests ?? [];
  const total = rows.length;
  const companions = rows.reduce((s, g) => s + (g.companion_count ?? 0), 0);
  const checkedIn = rows.filter((g) => g.checked_in_at).length;
  const pending = total - checkedIn;
  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = rows.filter(
    (g) => g.checked_in_at && g.checked_in_at.slice(0, 10) === today,
  ).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-black leading-none">
            Convidados
          </h1>
          <p className="text-sm opacity-60 mt-1">
            Total de inscrições + acompanhantes: {total + companions}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/admin/scan"
            className="rounded-full border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-4 py-2 text-xs tracking-[.18em] uppercase hover:opacity-90 transition"
          >
            Scan QR
          </a>
          <a
            href="/admin/audit"
            className="rounded-full border-2 border-white/25 px-4 py-2 text-xs tracking-[.18em] uppercase hover:border-[#FFD27A] hover:text-[#FFD27A] transition"
          >
            Audit
          </a>
          <a
            href="/api/admin/export"
            className="rounded-full border-2 border-[#FFD27A] text-[#FFD27A] px-4 py-2 text-xs tracking-[.18em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Inscritos" value={total} />
        <Stat label="Acompanhantes" value={companions} />
        <Stat label="Check-ins hoje" value={checkedInToday} accent />
        <Stat label="Pendentes" value={pending} />
      </div>

      <GuestsTable initial={rows} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        accent
          ? "border-[#FFD27A] bg-[#FFD27A]/10"
          : "border-white/15 bg-white/5"
      }`}
    >
      <div className="text-xs tracking-[.18em] uppercase opacity-60">
        {label}
      </div>
      <div
        className={`text-3xl font-black font-serif mt-1 ${
          accent ? "text-[#FFD27A]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
