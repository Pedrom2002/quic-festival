import AccountForm from "@/components/admin/account-form";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-black leading-none">Conta</h1>
          <p className="text-sm opacity-60 mt-1">{user?.email ?? "—"}</p>
        </div>
        <a
          href="/admin"
          className="rounded-full border-2 border-white/25 px-4 py-2 text-xs tracking-[.18em] uppercase hover:border-[#FFD27A] hover:text-[#FFD27A] transition"
        >
          ← Tabela
        </a>
      </div>

      <section className="rounded-2xl border-2 border-white/15 bg-white/5 p-6">
        <h2 className="font-serif text-xl font-black mb-1">Mudar password</h2>
        <p className="text-sm opacity-70 mb-4">
          Mínimo 10 caracteres. Recomenda-se gerador de passwords ou
          passphrase.
        </p>
        <AccountForm />
      </section>
    </div>
  );
}
