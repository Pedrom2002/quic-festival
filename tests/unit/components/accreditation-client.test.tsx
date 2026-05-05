import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/scene", () => ({ default: () => null }));
vi.mock("@/components/lineup", () => ({ default: () => null }));
vi.mock("@/components/lang-switcher", () => ({ default: () => null }));
vi.mock("@/components/accreditation-form", () => ({
  default: ({ accreditationCode }: { accreditationCode: string }) => (
    <div data-testid="acc-form">{accreditationCode}</div>
  ),
}));

afterEach(() => vi.restoreAllMocks());

async function renderClient(props: {
  code: string;
  label: string | null;
  expired: boolean;
  exhausted: boolean;
}) {
  const { default: AccreditationClient } = await import(
    "@/components/accreditation-client"
  );
  render(<AccreditationClient {...props} />);
}

describe("AccreditationClient", () => {
  it("render form quando não blocked", async () => {
    await renderClient({ code: "ABC", label: null, expired: false, exhausted: false });
    expect(screen.getByTestId("acc-form")).toBeInTheDocument();
  });

  it("expired → alerta visível, form ausente", async () => {
    await renderClient({ code: "ABC", label: null, expired: true, exhausted: false });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("acc-form")).not.toBeInTheDocument();
  });

  it("exhausted (não expirado) → alerta visível, form ausente", async () => {
    await renderClient({ code: "ABC", label: null, expired: false, exhausted: true });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("acc-form")).not.toBeInTheDocument();
  });

  it("label visível quando fornecido", async () => {
    await renderClient({ code: "ABC", label: "RTP Especial", expired: false, exhausted: false });
    expect(screen.getByText(/RTP Especial/i)).toBeInTheDocument();
  });

  it("sem label → banner tag visível mas sem 'para'", async () => {
    await renderClient({ code: "ABC", label: null, expired: false, exhausted: false });
    expect(screen.queryByText(/para/i)).not.toBeInTheDocument();
  });
});
