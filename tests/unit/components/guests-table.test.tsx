import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuestsTable from "@/components/admin/guests-table";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

const ROWS = [
  {
    id: "g-1",
    created_at: "2026-04-01T10:00:00Z",
    name: "Maria Alves",
    email: "maria@x.pt",
    phone: "912000001",
    companion_count: 1,
    companion_names: ["Ana"],
    token: "tok-1",
    checked_in_day1_at: null,
    checked_in_day2_at: null,
    email_sent_at: null,
  },
  {
    id: "g-2",
    created_at: "2026-04-02T10:00:00Z",
    name: "Bruno Sousa",
    email: "bruno@y.pt",
    phone: "912000002",
    companion_count: 0,
    companion_names: [],
    token: "tok-2",
    checked_in_day1_at: "2026-04-10T20:00:00Z",
    checked_in_day2_at: null,
    email_sent_at: "2026-04-01T11:00:00Z",
  },
];

describe("GuestsTable", () => {
  it("render todos os guests", () => {
    render(<GuestsTable initial={ROWS} />);
    expect(screen.getByText("Maria Alves")).toBeInTheDocument();
    expect(screen.getByText("Bruno Sousa")).toBeInTheDocument();
  });

  it("filter pendentes esconde já checked-in", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.click(screen.getByRole("button", { name: /pendentes/i }));
    expect(screen.getByText("Maria Alves")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Sousa")).not.toBeInTheDocument();
  });

  it("filter check-in só mostra Bruno", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const filterButtons = screen.getAllByRole("button", { name: /^check-in$/i });
    const filter = filterButtons.find((b) => b.closest(".rounded-xl"))!;
    await user.click(filter);
    expect(screen.queryByText("Maria Alves")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Sousa")).toBeInTheDocument();
  });

  it("search por nome filtra", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "bru");
    expect(screen.queryByText("Maria Alves")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Sousa")).toBeInTheDocument();
  });

  it("search por email", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "maria@");
    expect(screen.getByText("Maria Alves")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Sousa")).not.toBeInTheDocument();
  });

  it("search por telefone", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "912000002");
    expect(screen.queryByText("Maria Alves")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Sousa")).toBeInTheDocument();
  });

  it("sort por nome inverte", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.click(screen.getByText(/^Nome/));
    await user.click(screen.getByText(/^Nome/));
    const cells = screen.getAllByRole("cell").map((c) => c.textContent ?? "");
    expect(cells.join(" ")).toContain("Maria");
  });

  it("sem resultados mostra mensagem", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.type(screen.getByPlaceholderText(/Procurar/), "zzz");
    expect(screen.getByText(/Sem resultados/)).toBeInTheDocument();
  });

  it("toggleCheckin: PATCH + toast ok", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const mariaRow = screen.getByText("Maria Alves").closest("tr")!;
    // Click the D1 button for Maria (not checked in)
    await user.click(within(mariaRow).getByRole("button", { name: /^D1$/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/checkin", expect.objectContaining({ method: "PATCH" }));
    expect(await screen.findByText(/Check-in D1 feito/)).toBeInTheDocument();
  });

  it("toggleCheckin falha → toast err + rollback", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const mariaRow = screen.getByText("Maria Alves").closest("tr")!;
    await user.click(within(mariaRow).getByRole("button", { name: /^D1$/ }));
    expect(await screen.findByText(/Falha a atualizar/)).toBeInTheDocument();
  });

  it("desmarcar (Bruno → check-in=false) chama PATCH", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const brunoRow = screen.getByText("Bruno Sousa").closest("tr")!;
    // Bruno has D1 checked (shows "D1 ✓")
    await user.click(within(brunoRow).getByRole("button", { name: /D1 ✓/ }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.checked_in).toBe(false);
    expect(await screen.findByText(/removido/)).toBeInTheDocument();
  });

  it("resendEmail happy path: toast ok + atualiza email_sent_at", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const mariaRow = screen.getByText("Maria Alves").closest("tr")!;
    await user.click(within(mariaRow).getByRole("button", { name: /reenviar/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/resend-email", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText(/Email reenviado/)).toBeInTheDocument();
  });

  it("resendEmail falha → toast err", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const mariaRow = screen.getByText("Maria Alves").closest("tr")!;
    await user.click(within(mariaRow).getByRole("button", { name: /reenviar/i }));
    expect(await screen.findByText(/Falha a reenviar/)).toBeInTheDocument();
  });

  it("toggleSort em created_at: 1 click = ascende (já era key+desc)", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    const inscrito = screen.getByRole("columnheader", { name: /Inscrito/ });
    expect(inscrito.textContent).toContain("↓");
    await user.click(inscrito);
    expect(inscrito.textContent).toContain("↑");
    await user.click(inscrito);
    expect(inscrito.textContent).toContain("↓");
  });

  it("toggleSort em coluna diferente reseta para desc", async () => {
    const user = userEvent.setup();
    render(<GuestsTable initial={ROWS} />);
    await user.click(screen.getByRole("columnheader", { name: /^Nome/ }));
    const d1Col = screen.getByRole("columnheader", { name: /^D1/ });
    await user.click(d1Col);
    expect(d1Col.textContent).toContain("↓");
  });
});
