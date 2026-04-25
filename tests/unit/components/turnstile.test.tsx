import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type TurnstileApi = {
  render: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const renderMock = vi.fn(() => "wid-1");
const removeMock = vi.fn();

function installApi() {
  window.turnstile = {
    render: renderMock,
    reset: vi.fn(),
    remove: removeMock,
  };
}

beforeEach(() => {
  vi.resetModules();
  renderMock.mockClear();
  removeMock.mockClear();
  document.head.innerHTML = "";
  delete window.turnstile;
});
afterEach(() => vi.restoreAllMocks());

describe("Turnstile", () => {
  it("usa window.turnstile já carregado", async () => {
    installApi();
    const onToken = vi.fn();
    const { default: Turnstile } = await import("@/components/turnstile");
    render(<Turnstile sitekey="key-1" onToken={onToken} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(renderMock).toHaveBeenCalledOnce();
    const opts = renderMock.mock.calls[0]![1] as { sitekey: string; theme: string; callback: (t: string) => void };
    expect(opts.sitekey).toBe("key-1");
    expect(opts.theme).toBe("light");
    opts.callback("tok-abc");
    expect(onToken).toHaveBeenCalledWith("tok-abc");
  });

  it("expired-callback → onToken(null)", async () => {
    installApi();
    const onToken = vi.fn();
    const { default: Turnstile } = await import("@/components/turnstile");
    render(<Turnstile sitekey="k" onToken={onToken} />);
    await new Promise((r) => setTimeout(r, 0));
    const opts = renderMock.mock.calls[0]![1] as { "expired-callback": () => void; "error-callback": () => void };
    opts["expired-callback"]();
    expect(onToken).toHaveBeenLastCalledWith(null);
    opts["error-callback"]();
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("cleanup chama remove()", async () => {
    installApi();
    const onToken = vi.fn();
    const { default: Turnstile } = await import("@/components/turnstile");
    const { unmount } = render(<Turnstile sitekey="k" onToken={onToken} />);
    await new Promise((r) => setTimeout(r, 0));
    unmount();
    expect(removeMock).toHaveBeenCalledWith("wid-1");
  });

  it("remove a falhar é engolido", async () => {
    installApi();
    removeMock.mockImplementation(() => { throw new Error("x"); });
    const { default: Turnstile } = await import("@/components/turnstile");
    const { unmount } = render(<Turnstile sitekey="k" onToken={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(() => unmount()).not.toThrow();
  });

  it("carrega script externo se window.turnstile ausente", async () => {
    const onToken = vi.fn();
    const { default: Turnstile } = await import("@/components/turnstile");
    const { unmount } = render(<Turnstile sitekey="k" onToken={onToken} />);
    const script = document.head.querySelector("script");
    expect(script?.getAttribute("src")).toContain("turnstile/v0/api.js");
    unmount();
  });

  it("usa nonce do <meta name='csp-nonce'>", async () => {
    document.head.innerHTML = '<meta name="csp-nonce" content="abc123" />';
    const { default: Turnstile } = await import("@/components/turnstile");
    const { unmount } = render(<Turnstile sitekey="k" onToken={vi.fn()} />);
    const script = document.head.querySelector("script")!;
    expect(script.getAttribute("nonce")).toBe("abc123");
    unmount();
  });

  it("script onerror não rebenta promise (catch silent)", async () => {
    const { default: Turnstile } = await import("@/components/turnstile");
    const { unmount } = render(<Turnstile sitekey="k" onToken={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    const script = document.head.querySelector("script");
    if (script?.onerror) {
      expect(() => script.onerror!.call(script, new Event("error"))).not.toThrow();
    }
    unmount();
  });

  it("script existing reusa via addEventListener", async () => {
    const existing = document.createElement("script");
    existing.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    document.head.appendChild(existing);
    const { default: Turnstile } = await import("@/components/turnstile");
    render(<Turnstile sitekey="k" onToken={vi.fn()} />);
    expect(document.head.querySelectorAll("script").length).toBe(1);
  });
});
