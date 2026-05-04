import { supabaseAdmin } from "@/lib/supabase/admin";
import GuestsTable from "@/components/admin/guests-table";
import LiveAutoRefresh from "@/components/admin/live-auto-refresh";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = supabaseAdmin();
  const { data: guests } = await admin
    .from("guests")
    .select(
      "id,created_at,name,email,phone,companion_count,companion_names,token,checked_in_day1_at,checked_in_day2_at,email_sent_at,email_failed_at,email_attempts",
    )
    .order("created_at", { ascending: false });

  const rows = guests ?? [];
  const total = rows.length;
  const companions = rows.reduce((s, g) => s + (g.companion_count ?? 0), 0);
  const checkedInDay1 = rows.filter((g) => g.checked_in_day1_at).length;
  const checkedInDay2 = rows.filter((g) => g.checked_in_day2_at).length;
  const checkedInEither = rows.filter((g) => g.checked_in_day1_at || g.checked_in_day2_at).length;
  const pending = total - checkedInEither;
  const totalSeats = total + companions;
  const checkInRate = totalSeats > 0 ? Math.round((checkedInEither / totalSeats) * 100) : 0;
  const emailFailed = rows.filter((g) => g.email_failed_at).length;
  const lastCheckIn = rows
    .flatMap((g) => [g.checked_in_day1_at, g.checked_in_day2_at].filter(Boolean) as string[])
    .sort()
    .at(-1);

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

      <LiveAutoRefresh intervalMs={30_000} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat label="Inscritos" value={total} />
        <Stat label="Acompanhantes" value={companions} />
        <Stat label="Check-in Dia 1" value={checkedInDay1} accent />
        <Stat label="Check-in Dia 2" value={checkedInDay2} accent />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Pendentes" value={pending} />
        <Stat label="Taxa de entrada" value={`${checkInRate}%`} />
        <Stat
          label="Último scan"
          value={lastCheckIn ? formatTimeAgo(lastCheckIn) : "—"}
        />
        <Stat
          label="Emails falhados"
          value={emailFailed}
          warn={emailFailed > 0}
        />
      </div>

      <GuestsTable initial={rows} />
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("pt-PT");
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
}) {
  const border = accent
    ? "border-[#FFD27A] bg-[#FFD27A]/10"
    : warn
      ? "border-rose-400/60 bg-rose-900/20"
      : "border-white/15 bg-white/5";
  const valueColor = accent
    ? "text-[#FFD27A]"
    : warn
      ? "text-rose-300"
      : "";
  return (
    <div className={`rounded-2xl border-2 p-4 ${border}`}>
      <div className="text-xs tracking-[.18em] uppercase opacity-60">
        {label}
      </div>
      <div className={`text-3xl font-black font-serif mt-1 ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
