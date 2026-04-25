import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn(async () => ({ data: { id: "msg-1" }, error: null }));
const ResendCtor = vi.fn();
class FakeResend {
  emails = { send: sendMock };
  constructor(key: string) {
    ResendCtor(key);
  }
}
vi.mock("resend", () => ({
  Resend: FakeResend,
}));

beforeEach(() => {
  sendMock.mockClear();
  ResendCtor.mockClear();
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "QUIC <test@quic.pt>");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
});
afterEach(() => vi.unstubAllEnvs());

describe("sendRsvpEmail", () => {
  it("envia com from/to/subject/html/text correctos", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    const out = await sendRsvpEmail({ to: "u@u.pt", name: "Maria", token: "tok-1" });
    expect(out).toEqual({ id: "msg-1" });
    expect(sendMock).toHaveBeenCalledOnce();
    const args = sendMock.mock.calls[0]![0] as {
      from: string; to: string; subject: string; html: string; text: string;
    };
    expect(args.from).toBe("QUIC <test@quic.pt>");
    expect(args.to).toBe("u@u.pt");
    expect(args.subject).toMatch(/QUIC Festival 2026/);
    expect(args.html).toContain("https://quic.pt/api/qr/tok-1");
    expect(args.html).toContain("https://quic.pt/confirmado/tok-1");
    expect(args.html).toContain("https://quic.pt/datas.png");
    expect(args.html).toContain("Maria");
    expect(args.text).toContain("Maria");
    expect(args.text).toContain("https://quic.pt/confirmado/tok-1");
  });

  it("escapa HTML no nome", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: '<script>alert(1)</script>&"\'', token: "tok" });
    const args = sendMock.mock.calls[0]![0] as { html: string };
    expect(args.html).not.toContain("<script>alert(1)</script>");
    expect(args.html).toContain("&lt;script&gt;");
    expect(args.html).toContain("&amp;");
    expect(args.html).toContain("&quot;");
    expect(args.html).toContain("&#39;");
  });

  it("textSafe colapsa CR/LF para impedir injecção de linhas", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: "Maria\r\nBcc: evil@x.com\nFoo", token: "tok" });
    const args = sendMock.mock.calls[0]![0] as { text: string };
    const olaIdx = args.text.indexOf("Olá ");
    const afterOla = args.text.slice(olaIdx, args.text.indexOf("\n", olaIdx));
    expect(afterOla).not.toMatch(/[\r\n]/);
    expect(afterOla).toContain("Maria Bcc: evil@x.com Foo");
  });

  it("usa defaults quando RESEND_FROM/SITE_URL ausentes", async () => {
    delete process.env.RESEND_FROM;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: "M", token: "tok" });
    const args = sendMock.mock.calls[0]![0] as { from: string; html: string };
    expect(args.from).toBe("QUIC Festival <onboarding@resend.dev>");
    expect(args.html).toContain("http://localhost:3000/api/qr/tok");
  });

  it("rebenta em produção quando RESEND_FROM ausente", async () => {
    delete process.env.RESEND_FROM;
    vi.stubEnv("NODE_ENV", "production");
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(
      sendRsvpEmail({ to: "u@u.pt", name: "M", token: "tok" }),
    ).rejects.toThrow(/RESEND_FROM/);
  });

  it("rebenta quando Resend devolve error", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(sendRsvpEmail({ to: "u@u.pt", name: "M", token: "t" })).rejects.toThrow("boom");
  });

  it("usa default fallback message quando error sem message", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: {} } as never);
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(sendRsvpEmail({ to: "u@u.pt", name: "M", token: "t" })).rejects.toThrow(/Falha/);
  });

  it("lazy-init: throw quando API key ausente", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(sendRsvpEmail({ to: "u@u.pt", name: "M", token: "t" })).rejects.toThrow(/RESEND_API_KEY/);
  });

  it("client cache: 2 chamadas instanciam Resend uma vez", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "a@a.pt", name: "A", token: "t1" });
    await sendRsvpEmail({ to: "b@b.pt", name: "B", token: "t2" });
    expect(ResendCtor).toHaveBeenCalledTimes(1);
    expect(ResendCtor).toHaveBeenCalledWith("re_test");
  });
});
