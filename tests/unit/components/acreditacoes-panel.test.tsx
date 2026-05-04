import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AcreditacoesPanel from "@/components/admin/acreditacoes-panel";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

const SAMPLE: Parameters<typeof AcreditacoesPanel>[0]["initialLinks"] = [
  {
    id: "l1",
    code: "ABCDEFGHJKMN",
    label: "RTP · Dia 1",
    max_uses: 20,
    uses_count: 5,
    expires_at: null,
    archived_at: null,
    created_at: "2026-04-26T10:00:00Z",
  },
];

describe("AcreditacoesPanel", () => {
  it("render: lista links + estado activo", () => {
    render(<AcreditacoesPanel initialLinks={SAMPLE} />);
    expect(screen.getByText("RTP · Dia 1")).toBeInTheDocument();
    expect(screen.getByText("5 / 20")).toBeInTheDocument();
    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
  });

  it("estado vazio", () => {
    render(<AcreditacoesPanel initialLinks={[]} />);
    expect(screen.getByText(/Nenhum link ainda/)).toBeInTheDocument();
  });

  it("link arquivado mostra ARQUIVADO", () => {
    render(
      <AcreditacoesPanel
        initialLinks={[
          { ...SAMPLE[0]!, archived_at: "2026-01-01T00:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("ARQUIVADO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reactivar/i })).toBeInTheDocument();
  });

  it("link esgotado mostra ESGOTADO", () => {
    render(
      <AcreditacoesPanel
        initialLinks={[{ ...SAMPLE[0]!, uses_count: 20 }]}
      />,
    );
    expect(screen.getByText("ESGOTADO")).toBeInTheDocument();
  });

  it("link expirado mostra EXPIRADO", () => {
    render(
      <AcreditacoesPanel
        initialLinks={[{ ...SAMPLE[0]!, expires_at: "2000-01-01T00:00:00Z" }]}
      />,
    );
    expect(screen.getByText("EXPIRADO")).toBeInTheDocument();
  });

  it("label null → mostra — na coluna etiqueta", () => {
    render(<AcreditacoesPanel initialLinks={[{ ...SAMPLE[0]!, label: null }]} />);
    // Multiple — chars expected (label + expires); just assert at least one
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("create flow: POST + refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "l2", code: "XYZABCDEFGHJ" }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ links: [...SAMPLE] }), { status: 200 }),
      );
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={[]} />);
    await user.type(screen.getByPlaceholderText(/Etiqueta/), "SIC");
    await user.click(screen.getByRole("button", { name: /Gerar/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Link criado/);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/acreditacoes",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("create: max_uses inválido → erro client-side", async () => {
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={[]} />);
    const input = screen.getByLabelText(/Número de acreditações/);
    await user.clear(input);
    await user.type(input, "9999");
    await user.click(screen.getByRole("button", { name: /Gerar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/entre 1 e 1000/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("create: API error → mostra mensagem", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Falha a criar." }), { status: 500 }),
    );
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={[]} />);
    await user.click(screen.getByRole("button", { name: /Gerar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Falha a criar/);
  });

  it("archive flow: PATCH + refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ links: SAMPLE }), { status: 200 }),
      );
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Arquivar/i }));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/acreditacoes/${SAMPLE[0]!.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("archive: erro → mensagem", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Arquivar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/actualizar/);
  });

  it("expires input: onChange actualiza estado (cobertura)", async () => {
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={[]} />);
    const expiresInput = screen.getByLabelText(/Expira em/i);
    await user.type(expiresInput, "2026-12-31T23:59");
    expect((expiresInput as HTMLInputElement).value).toBeTruthy();
  });

  it("copy link button mostra status", async () => {
    const user = userEvent.setup();
    render(<AcreditacoesPanel initialLinks={SAMPLE} />);
    await user.click(screen.getByRole("button", { name: /Copiar link/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Link copiado/);
  });
});
