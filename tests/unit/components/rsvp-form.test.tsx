import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, key: string) => {
      const Comp = (props: Record<string, unknown>) => {
        const { children, ...rest } = props;
        const Tag = key as keyof JSX.IntrinsicElements;
        const filtered: Record<string, unknown> = {};
        for (const k of Object.keys(rest)) {
          if (!/^(initial|animate|whileInView|whileHover|whileTap|exit|viewport|transition|variants|drag|layout)/.test(k)) {
            filtered[k] = rest[k];
          }
        }
        return <Tag {...filtered}>{children as React.ReactNode}</Tag>;
      };
      return Comp;
    },
  }),
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RsvpForm from "@/components/rsvp-form";

const fetchMock = vi.fn();

beforeEach(() => {
  pushMock.mockClear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

async function fillBasic(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
  await user.type(document.getElementById("tel") as HTMLInputElement, "912345678");
  await user.type(screen.getByLabelText(/Email/), "maria@test.pt");
}

describe("RsvpForm", () => {
  it("submit válido → fetch /api/rsvp + router.push /confirmado/{token}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ token: "tok-1" }), { status: 200 }));
    const user = userEvent.setup();
    render(<RsvpForm />);
    await fillBasic(user);
    await user.click(screen.getByLabelText(/^NÃO$/));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/rsvp", expect.objectContaining({ method: "POST" }));
    expect(pushMock).toHaveBeenCalledWith("/confirmado/tok-1");
  });

  it("submit com resposta {ok:true} (dedup) → mostra mensagem genérica", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<RsvpForm />);
    await fillBasic(user);
    await user.click(screen.getByLabelText(/^NÃO$/));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Inscrição recebida/);
  });

  it("API error com message → banner alert", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Limite" }), { status: 429 }));
    const user = userEvent.setup();
    render(<RsvpForm />);
    await fillBasic(user);
    await user.click(screen.getByLabelText(/^NÃO$/));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite");
  });

  it("API error sem JSON → fallback genérico", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const user = userEvent.setup();
    render(<RsvpForm />);
    await fillBasic(user);
    await user.click(screen.getByLabelText(/^NÃO$/));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/correu mal/);
  });

  it("network error → 'Sem ligação'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("net"));
    const user = userEvent.setup();
    render(<RsvpForm />);
    await fillBasic(user);
    await user.click(screen.getByLabelText(/^NÃO$/));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sem ligação/);
  });

  it("acompanhante=sim revela campos extra (inert removido + tabIndex=0)", async () => {
    const user = userEvent.setup();
    render(<RsvpForm />);
    await user.click(screen.getByLabelText(/^SIM$/));
    const companion = screen
      .getByLabelText(/Nome do acompanhante/)
      .closest(".companion");
    // `inert` ausente quando bringsCompanion=true.
    expect(companion?.hasAttribute("inert")).toBe(false);
    // Inputs reais entram no fluxo de Tab.
    expect(
      screen.getByLabelText(/Nome do acompanhante/).getAttribute("tabindex"),
    ).toBe("0");
  });

  it("acompanhante=nao mantém companion inert + tabIndex=-1", async () => {
    const user = userEvent.setup();
    render(<RsvpForm />);
    await user.click(screen.getByLabelText(/^NÃO$/));
    const companion = screen
      .getByLabelText(/Nome do acompanhante/)
      .closest(".companion");
    expect(companion?.hasAttribute("inert")).toBe(true);
    expect(
      screen.getByLabelText(/Nome do acompanhante/).getAttribute("tabindex"),
    ).toBe("-1");
  });

  it("validação client-side: nome curto", async () => {
    const user = userEvent.setup();
    render(<RsvpForm />);
    await user.type(screen.getByLabelText(/Nome completo/), "x");
    await user.tab();
    expect(await screen.findByText(/curto|inválidos/i)).toBeInTheDocument();
  });
});
