import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// framer-motion: render children directly
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, ...rest }: Record<string, unknown>) => {
          const React = require("react");
          return React.createElement(tag, rest, children);
        },
    },
  ),
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  pushMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

async function renderForm() {
  const { default: AccreditationForm } = await import(
    "@/components/accreditation-form"
  );
  const { I18nProvider } = await import("@/lib/i18n");
  const { render: r, screen: s } = await import("@testing-library/react");
  const React = await import("react");
  r(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AccreditationForm, { accreditationCode: "ABCDEFGHJKMN" }),
    ),
  );
  return s;
}

describe("AccreditationForm", () => {
  it("render: campos nome, telefone, email, empresa", async () => {
    await renderForm();
    expect(screen.getByLabelText(/Nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telemóvel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Empresa/i)).toBeInTheDocument();
  });

  it("submit válido → POST + redirect", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "tok-abc" }), { status: 201 }),
    );
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Nome/i), "João Silva");
    await user.type(screen.getByLabelText(/Telemóvel/i), "912345678");
    await user.type(screen.getByLabelText(/Email/i), "joao@rtp.pt");
    await user.type(screen.getByLabelText(/Empresa/i), "RTP");
    await user.click(screen.getByRole("button", { name: /SOLICITAR/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/acreditado/tok-abc"));
  });

  it("API error → mostra server error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Esgotado." }), { status: 409 }),
    );
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Nome/i), "Ana Costa");
    await user.type(screen.getByLabelText(/Telemóvel/i), "912345678");
    await user.type(screen.getByLabelText(/Email/i), "ana@sic.pt");
    await user.type(screen.getByLabelText(/Empresa/i), "SIC");
    await user.click(screen.getByRole("button", { name: /SOLICITAR/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Esgotado/);
  });

  it("network error → mostra erro genérico", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText(/Nome/i), "Rui Matos");
    await user.type(screen.getByLabelText(/Telemóvel/i), "912345678");
    await user.type(screen.getByLabelText(/Email/i), "rui@cm.pt");
    await user.type(screen.getByLabelText(/Empresa/i), "CM");
    await user.click(screen.getByRole("button", { name: /SOLICITAR/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
