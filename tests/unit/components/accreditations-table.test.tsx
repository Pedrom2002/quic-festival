import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccreditationsTable from "@/components/admin/accreditations-table";

afterEach(() => vi.restoreAllMocks());

const ROWS = [
  {
    id: "a-1",
    created_at: "2026-04-01T10:00:00Z",
    name: "João Silva",
    email: "joao@rtp.pt",
    phone: "912000001",
    media_company: "RTP",
    token: "tok-1",
  },
  {
    id: "a-2",
    created_at: "2026-04-02T10:00:00Z",
    name: "Ana Costa",
    email: "ana@sic.pt",
    phone: "912000002",
    media_company: "SIC",
    token: "tok-2",
  },
];

describe("AccreditationsTable", () => {
  it("render todas as acreditações", () => {
    render(<AccreditationsTable initial={ROWS} />);
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Ana Costa")).toBeInTheDocument();
    expect(screen.getByText("RTP")).toBeInTheDocument();
    expect(screen.getByText("SIC")).toBeInTheDocument();
  });

  it("estado vazio mostra 'Sem resultados'", () => {
    render(<AccreditationsTable initial={[]} />);
    expect(screen.getByText(/Sem resultados/)).toBeInTheDocument();
  });

  it("search por nome filtra", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "joão");
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.queryByText("Ana Costa")).not.toBeInTheDocument();
  });

  it("search por email filtra", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "sic.pt");
    expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Costa")).toBeInTheDocument();
  });

  it("search por empresa filtra", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "rtp");
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.queryByText("Ana Costa")).not.toBeInTheDocument();
  });

  it("search por telefone filtra", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "912000002");
    expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Costa")).toBeInTheDocument();
  });

  it("search sem match → Sem resultados", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "zzz");
    expect(screen.getByText(/Sem resultados/)).toBeInTheDocument();
  });

  it("search case insensitive", async () => {
    const user = userEvent.setup();
    render(<AccreditationsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "JOÃO");
    expect(screen.getByText("João Silva")).toBeInTheDocument();
  });
});
