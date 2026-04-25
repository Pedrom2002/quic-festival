import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountForm from "@/components/admin/account-form";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function ok(body: object = { ok: true }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function bad(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("AccountForm", () => {
  it("erro: nova password < 10 chars", async () => {
    const user = userEvent.setup();
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-password-123");
    await user.type(screen.getByLabelText("Nova password"), "short");
    await user.type(screen.getByLabelText("Confirmar nova"), "short");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/≥ 10 chars/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("erro: confirmação não bate", async () => {
    const user = userEvent.setup();
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-pw-1234");
    await user.type(screen.getByLabelText("Nova password"), "new-pw-1234567");
    await user.type(screen.getByLabelText("Confirmar nova"), "different-1234");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Confirmação/);
  });

  it("erro: nova igual à atual", async () => {
    const user = userEvent.setup();
    render(<AccountForm />);
    const same = "same-password-12";
    await user.type(screen.getByLabelText("Password atual"), same);
    await user.type(screen.getByLabelText("Nova password"), same);
    await user.type(screen.getByLabelText("Confirmar nova"), same);
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/diferente/);
  });

  it("happy path: 200 → mensagem ok + reset campos", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(ok());
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-pw-1234");
    await user.type(screen.getByLabelText("Nova password"), "new-pw-1234567");
    await user.type(screen.getByLabelText("Confirmar nova"), "new-pw-1234567");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/atualizada/i);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/account/password", expect.objectContaining({ method: "POST" }));
    expect((screen.getByLabelText("Password atual") as HTMLInputElement).value).toBe("");
  });

  it("API error com error message → alert", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(bad(401, { error: "Errado" }));
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-pw-1234");
    await user.type(screen.getByLabelText("Nova password"), "new-pw-1234567");
    await user.type(screen.getByLabelText("Confirmar nova"), "new-pw-1234567");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Errado");
  });

  it("API error sem JSON → fallback Falha", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-pw-1234");
    await user.type(screen.getByLabelText("Nova password"), "new-pw-1234567");
    await user.type(screen.getByLabelText("Confirmar nova"), "new-pw-1234567");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Falha/);
  });

  it("network error → 'Sem ligação'", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new TypeError("net"));
    render(<AccountForm />);
    await user.type(screen.getByLabelText("Password atual"), "old-pw-1234");
    await user.type(screen.getByLabelText("Nova password"), "new-pw-1234567");
    await user.type(screen.getByLabelText("Confirmar nova"), "new-pw-1234567");
    await user.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sem ligação/);
  });
});
