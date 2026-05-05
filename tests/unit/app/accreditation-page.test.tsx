import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/lib/invite-code", () => ({
  isValidInviteCode: (code: string) => /^[A-Z0-9]{12}$/.test(code),
}));

const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
}));

vi.mock("@/components/accreditation-client", () => ({
  default: (props: { code: string; label: string | null; expired: boolean; exhausted: boolean }) => (
    <div data-testid="acc-client"
      data-code={props.code}
      data-expired={String(props.expired)}
      data-exhausted={String(props.exhausted)}
      data-label={props.label ?? "null"}
    />
  ),
}));

beforeEach(() => {
  vi.resetModules();
  maybeSingleMock.mockReset();
  notFoundMock.mockReset().mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
});
afterEach(() => vi.restoreAllMocks());

const VALID_CODE = "ABCDEFGHJKMN";

async function callPage(code: string) {
  const { default: Page } = await import("@/app/a/[code]/page");
  const ui = await Page({ params: Promise.resolve({ code }) });
  return render(ui);
}

describe("AccreditationPage /a/[code]", () => {
  it("código inválido → notFound", async () => {
    await expect(callPage("bad")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("link não encontrado → notFound", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    await expect(callPage(VALID_CODE)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("link arquivado → notFound", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { label: "X", max_uses: 10, uses_count: 1, expires_at: null, archived_at: "2026-01-01" },
    });
    await expect(callPage(VALID_CODE)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("link válido → render AccreditationClient com props corretas", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { label: "RTP", max_uses: 20, uses_count: 5, expires_at: null, archived_at: null },
    });
    await callPage(VALID_CODE);
    const el = screen.getByTestId("acc-client");
    expect(el.dataset.code).toBe(VALID_CODE);
    expect(el.dataset.expired).toBe("false");
    expect(el.dataset.exhausted).toBe("false");
    expect(el.dataset.label).toBe("RTP");
  });

  it("link esgotado → exhausted=true", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { label: null, max_uses: 5, uses_count: 5, expires_at: null, archived_at: null },
    });
    await callPage(VALID_CODE);
    expect(screen.getByTestId("acc-client").dataset.exhausted).toBe("true");
  });

  it("link expirado → expired=true", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { label: null, max_uses: 5, uses_count: 0, expires_at: "2000-01-01T00:00:00Z", archived_at: null },
    });
    await callPage(VALID_CODE);
    expect(screen.getByTestId("acc-client").dataset.expired).toBe("true");
  });
});
