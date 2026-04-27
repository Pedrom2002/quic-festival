import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/components/turnstile", () => ({
  default: ({ onToken }: { onToken: (t: string | null) => void }) => (
    <button data-testid="captcha" onClick={() => onToken("cap-tok")}>
      Solve
    </button>
  ),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  pushMock.mockClear();
  refreshMock.mockClear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
});
afterEach(() => vi.restoreAllMocks());

describe("AdminLoginPage", () => {
  it("password mode happy: POST sign-in + push /admin", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    await user.click(screen.getByRole("button", { name: /^ENTRAR$/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/sign-in", expect.objectContaining({ method: "POST" }));
    expect(pushMock).toHaveBeenCalledWith("/admin");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("password mode error com message", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Bad" }), { status: 401 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    await user.click(screen.getByRole("button", { name: /^ENTRAR$/i }));
    expect(await screen.findByText("Bad")).toBeInTheDocument();
  });

  it("password mode error sem message → 'Erro de rede.'", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    await user.click(screen.getByRole("button", { name: /^ENTRAR$/i }));
    expect(await screen.findByText(/Erro de rede/)).toBeInTheDocument();
  });

  it("network reject → 'Erro de rede.'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("net"));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    await user.click(screen.getByRole("button", { name: /^ENTRAR$/i }));
    expect(await screen.findByText(/Erro de rede/)).toBeInTheDocument();
  });

  it("magic link mode: POST otp + status sent", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Magic Link/i }));
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.click(screen.getByRole("button", { name: /ENVIAR MAGIC LINK/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/sign-in/otp", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText(/Se o email existir/)).toBeInTheDocument();
  });

  it("magic link error com message", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Boom" }), { status: 502 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Magic Link/i }));
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.click(screen.getByRole("button", { name: /ENVIAR MAGIC LINK/i }));
    expect(await screen.findByText("Boom")).toBeInTheDocument();
  });

  it("magic link error sem message → 'Erro a enviar magic link.'", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Magic Link/i }));
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.click(screen.getByRole("button", { name: /ENVIAR MAGIC LINK/i }));
    expect(await screen.findByText(/Erro a enviar magic link/)).toBeInTheDocument();
  });

  it("captcha required: bloqueia submit sem token", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "k1";
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    expect(screen.getByRole("button", { name: /^ENTRAR$/i })).toBeDisabled();
  });

  it("clicar 'Password' volta ao modo password depois de magic link", async () => {
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Magic Link/i }));
    expect(screen.getByRole("button", { name: /ENVIAR MAGIC LINK/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Password$/i }));
    expect(screen.getByRole("button", { name: /^ENTRAR$/i })).toBeInTheDocument();
  });

  it("captcha solved → permite submit", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "k1";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { default: Page } = await import("@/app/admin/login/page");
    render(<Page />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.type(screen.getByPlaceholderText("••••••••"), "pw1234567890");
    await user.click(screen.getByTestId("captcha"));
    await user.click(screen.getByRole("button", { name: /^ENTRAR$/i }));
    expect(fetchMock).toHaveBeenCalled();
  });
});
