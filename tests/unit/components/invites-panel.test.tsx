import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvitesPanel from "@/components/admin/invites-panel";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

const SAMPLE = [
  {
    id: "i1",
    code: "ABCDEFGHJKMN",
    label: "Sonae",
    max_uses: 40,
    uses_count: 12,
    expires_at: null,
    archived_at: null,
    created_at: "2026-04-26T10:00:00Z",
  },
];

describe("InvitesPanel", () => {
  it("render: lista invites + estado activo", () => {
    render(<InvitesPanel initialInvites={SAMPLE} />);
    expect(screen.getByText("Sonae")).toBeInTheDocument();
    expect(screen.getByText("12 / 40")).toBeInTheDocument();
    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
  });

  it("estado vazio", () => {
    render(<InvitesPanel initialInvites={[]} />);
    expect(screen.getByText(/Nenhum convite ainda/)).toBeInTheDocument();
  });

  it("create flow: POST + refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "new", code: "XYZABCDEFGHJ" }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invites: [...SAMPLE] }), { status: 200 }),
      );
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={[]} />);
    await user.type(screen.getByPlaceholderText(/Etiqueta/), "Test Co");
    await user.click(screen.getByRole("button", { name: /Gerar/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /Convite criado/,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/invites",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("create flow: max_uses inválido → erro client-side", async () => {
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={[]} />);
    const input = screen.getByLabelText(/Número de vagas/);
    await user.clear(input);
    await user.type(input, "5000");
    await user.click(screen.getByRole("button", { name: /Gerar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/entre 1 e 1000/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("create flow: API error → mostra mensagem", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Boom" }), { status: 500 }),
    );
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={[]} />);
    await user.click(screen.getByRole("button", { name: /Gerar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Boom/);
  });

  it("archive flow: PATCH + refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invites: SAMPLE }), { status: 200 }),
      );
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Arquivar/i }));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/invites/${SAMPLE[0]!.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("archive flow: erro → mensagem", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Arquivar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/actualizar/);
  });

  it("copy link button mostra status sem rebentar quando clipboard ausente", async () => {
    const user = userEvent.setup();
    render(<InvitesPanel initialInvites={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Copiar link/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Link copiado/);
  });
});
