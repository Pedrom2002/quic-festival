import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.email) redirect("/admin/login");

  const admin = supabaseAdmin();
  const { data: isAdmin } = await admin
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!isAdmin) redirect("/admin/login?err=forbidden");

  return (
    <div className="min-h-dvh bg-[#06182A] text-[#F4EBD6]">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <a
          href="/admin"
          className="text-sm tracking-[.22em] uppercase text-[#FFD27A] hover:opacity-80"
        >
          QUIC · admin
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/admin/invites"
            className="text-xs tracking-[.18em] uppercase opacity-70 hover:opacity-100"
          >
            Convites
          </a>
          <a
            href="/admin/account"
            className="text-xs tracking-[.18em] uppercase opacity-70 hover:opacity-100"
          >
            Conta
          </a>
          <form action="/api/admin/signout" method="post">
            <button className="text-xs tracking-[.18em] uppercase opacity-70 hover:opacity-100">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
