import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

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

vi.mock("@/lib/qr", () => ({
  generateQrDataUrl: vi.fn(async () => "data:image/png;base64,fakeqr"),
}));

vi.mock("@/components/acreditado-actions", () => ({
  default: ({ name }: { name: string }) => <div data-testid="acc-actions">{name}</div>,
}));

beforeEach(() => {
  vi.resetModules();
  maybeSingleMock.mockReset();
  notFoundMock.mockReset().mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
});
afterEach(() => vi.restoreAllMocks());

async function callPage(token: string) {
  const { default: Page } = await import("@/app/acreditado/[token]/page");
  const ui = await Page({ params: Promise.resolve({ token }) });
  return render(ui);
}

describe("AcreditadoPage /acreditado/[token]", () => {
  it("acc não encontrado → notFound", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    await expect(callPage("tok-abc")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("acc encontrado → render nome e empresa", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { name: "João Silva", email: "j@rtp.pt", phone: "912000001", media_company: "RTP", token: "tok-abc" },
    });
    await callPage("tok-abc");
    expect(screen.getAllByText("João Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RTP").length).toBeGreaterThan(0);
    expect(screen.getByAltText("QR Acreditação")).toBeInTheDocument();
    expect(screen.getByTestId("acc-actions")).toBeInTheDocument();
  });
});
