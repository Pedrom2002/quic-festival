import { afterEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { audit, ipFromHeaders } from "@/lib/audit";

afterEach(() => insertMock.mockClear());

describe("audit()", () => {
  it("insere row com defaults null", async () => {
    await audit({ action: "admin.signout" });
    expect(insertMock).toHaveBeenCalledWith({
      action: "admin.signout",
      actor_email: null,
      target_id: null,
      ip: null,
      meta: null,
    });
  });

  it("passa todos os campos quando fornecidos", async () => {
    await audit({
      action: "admin.checkin.ok",
      actorEmail: "a@b.pt",
      targetId: "t-1",
      ip: "1.2.3.4",
      meta: { foo: 1 },
    });
    expect(insertMock).toHaveBeenCalledWith({
      action: "admin.checkin.ok",
      actor_email: "a@b.pt",
      target_id: "t-1",
      ip: "1.2.3.4",
      meta: { foo: 1 },
    });
  });

  it("não rebenta quando insert falha", async () => {
    insertMock.mockRejectedValueOnce(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(audit({ action: "admin.export" })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("apanha valor não-Error", async () => {
    insertMock.mockRejectedValueOnce("string err");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await audit({ action: "admin.export" });
    expect(warn).toHaveBeenCalled();
  });
});

describe("ipFromHeaders", () => {
  it("usa primeiro x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    expect(ipFromHeaders(h)).toBe("1.1.1.1");
  });

  it("trim do x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "  3.3.3.3 " });
    expect(ipFromHeaders(h)).toBe("3.3.3.3");
  });

  it("fallback x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(ipFromHeaders(h)).toBe("9.9.9.9");
  });

  it("null sem headers", () => {
    expect(ipFromHeaders(new Headers())).toBeNull();
  });
});
