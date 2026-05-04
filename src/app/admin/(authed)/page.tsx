import { supabaseAdmin } from "@/lib/supabase/admin";
import DashboardTabs from "@/components/admin/dashboard-tabs";
import LiveAutoRefresh from "@/components/admin/live-auto-refresh";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = supabaseAdmin();

  const [{ data: guests }, { data: accreditationsData }] = await Promise.all([
    admin
      .from("guests")
      .select(
        "id,created_at,name,email,phone,companion_count,companion_names,token,checked_in_day1_at,checked_in_day2_at,email_sent_at,email_failed_at,email_attempts,is_vip",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("accreditations")
      .select("id,created_at,name,email,phone,media_company,token")
      .order("created_at", { ascending: false }),
  ]);

  const rows = guests ?? [];
  const accRows = accreditationsData ?? [];

  const companions = rows.reduce((s, g) => s + (g.companion_count ?? 0), 0);
  const vipCount = rows.filter((g) => g.is_vip).length;
  const checkedInDay1 = rows.filter((g) => g.checked_in_day1_at).length;
  const checkedInDay2 = rows.filter((g) => g.checked_in_day2_at).length;
  const checkedInEither = rows.filter(
    (g) => g.checked_in_day1_at || g.checked_in_day2_at,
  ).length;
  const totalSeats = rows.length + companions;
  const lastCheckIn = rows
    .flatMap((g) => [g.checked_in_day1_at, g.checked_in_day2_at].filter(Boolean) as string[])
    .sort()
    .at(-1);

  const companies = new Set(accRows.map((a) => a.media_company)).size;

  return (
    <div>
      <LiveAutoRefresh intervalMs={30_000} />
      <DashboardTabs
        guests={rows.map((g) => ({
          id: g.id as string,
          created_at: g.created_at as string,
          name: g.name as string,
          email: g.email as string,
          phone: g.phone as string,
          companion_count: (g.companion_count as number) ?? 0,
          companion_names: (g.companion_names as string[]) ?? [],
          token: g.token as string,
          checked_in_day1_at: (g.checked_in_day1_at as string | null) ?? null,
          checked_in_day2_at: (g.checked_in_day2_at as string | null) ?? null,
          email_sent_at: (g.email_sent_at as string | null) ?? null,
          email_failed_at: (g.email_failed_at as string | null) ?? null,
          email_attempts: (g.email_attempts as number) ?? 0,
          is_vip: (g.is_vip as boolean) ?? false,
        }))}
        guestStats={{
          total: rows.length,
          companions,
          checkedInDay1,
          checkedInDay2,
          pending: rows.length - checkedInEither,
          checkInRate: totalSeats > 0 ? Math.round((checkedInEither / totalSeats) * 100) : 0,
          emailFailed: rows.filter((g) => g.email_failed_at).length,
          lastCheckIn,
          vipCount,
        }}
        accreditations={accRows.map((a) => ({
          id: a.id as string,
          created_at: a.created_at as string,
          name: a.name as string,
          email: a.email as string,
          phone: a.phone as string,
          media_company: a.media_company as string,
          token: a.token as string,
        }))}
        accreditationStats={{ total: accRows.length, companies }}
      />
    </div>
  );
}
