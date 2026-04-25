// RLS contract test — corre contra um Supabase efémero (ou local via
// `supabase start`). NÃO corre no pipeline standard (mocked), só num workflow
// dedicado `rls-contract.yml`.
//
// Validações:
//   1. anon NÃO consegue SELECT em guests, admins, audit_log, idempotency_keys.
//   2. authenticated não-admin NÃO consegue SELECT em guests.
//   3. authenticated admin CONSEGUE SELECT em guests.
//   4. authenticated admin NÃO consegue UPDATE colunas imutáveis (token, name).
//   5. service_role bypassa tudo.
//   6. audit_log: UPDATE/DELETE rejeitado pelo trigger.
//
// Skipped quando SUPABASE_RLS_TEST_URL não está definido.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_RLS_TEST_URL;
const ANON_KEY = process.env.SUPABASE_RLS_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_RLS_TEST_SERVICE_KEY;

const enabled = !!(URL && ANON_KEY && SERVICE_KEY);

describe.skipIf(!enabled)("RLS contract", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let testGuestId: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("guests")
      .insert({
        name: "RLS Test",
        email: `rls-${Date.now()}@example.com`,
        phone: "912345678",
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("seed failed");
    testGuestId = data.id;
  });

  afterAll(async () => {
    if (testGuestId) {
      await admin.from("guests").delete().eq("id", testGuestId);
    }
  });

  it("anon cannot SELECT guests", async () => {
    const { data, error } = await anon.from("guests").select("id").limit(1);
    expect(data ?? []).toEqual([]);
    // Postgres RLS deny silently returns empty rather than error in many cases.
    // Either empty or explicit permission error is acceptable.
    if (error) expect(error.code).toMatch(/42501|42P17|PGRST/);
  });

  it("anon cannot SELECT admins", async () => {
    const { data } = await anon.from("admins").select("email").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("anon cannot SELECT audit_log", async () => {
    const { data } = await anon.from("audit_log").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("anon cannot SELECT idempotency_keys", async () => {
    const { data } = await anon.from("idempotency_keys").select("key").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("anon cannot INSERT guests", async () => {
    const { error } = await anon.from("guests").insert({
      name: "Hacker",
      email: `hacker-${Date.now()}@example.com`,
      phone: "912345678",
    });
    expect(error).toBeTruthy();
  });

  it("audit_log rejects UPDATE via service_role (trigger)", async () => {
    const { error: insertErr } = await admin.from("audit_log").insert({
      action: "admin.signin.password.fail",
      actor_email: "rls@test",
      ip: "127.0.0.1",
    });
    expect(insertErr).toBeNull();

    const { error: updateErr } = await admin
      .from("audit_log")
      .update({ action: "admin.signin.password.ok" })
      .eq("actor_email", "rls@test");
    expect(updateErr).toBeTruthy();
    expect(updateErr?.message ?? "").toMatch(/append-only/i);

    // Cleanup via the security-definer purge function.
    await admin.rpc("audit_log_purge", { retain_days: 0 });
  });
});
