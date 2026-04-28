import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ messageId: "<msg-1@brevo>" }),
    text: async () => "",
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  vi.stubEnv("BREVO_API_KEY", "key_test");
  vi.stubEnv("EMAIL_FROM", "QUIC <test@quic.pt>");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type BrevoBody = {
  sender: { name?: string; email: string };
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
};

function bodyOf(call: number): BrevoBody {
  const init = fetchMock.mock.calls[call]![1] as { body: string };
  return JSON.parse(init.body) as BrevoBody;
}

describe("sendRsvpEmail (Brevo)", () => {
  it("envia com sender/to/subject/html/text correctos", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    const out = await sendRsvpEmail({ to: "u@u.pt", name: "Maria", token: "tok-1" });
    expect(out).toEqual({ messageId: "<msg-1@brevo>" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init as { headers: Record<string, string> }).headers["api-key"]).toBe("key_test");

    const body = bodyOf(0);
    expect(body.sender).toEqual({ name: "QUIC", email: "test@quic.pt" });
    expect(body.to).toEqual([{ email: "u@u.pt", name: "Maria" }]);
    expect(body.subject).toMatch(/QUIC Festival 2026/);
    expect(body.htmlContent).toContain("https://quic.pt/api/qr/tok-1");
    expect(body.htmlContent).toContain("https://quic.pt/confirmado/tok-1");
    expect(body.htmlContent).toContain("https://quic.pt/datas.png");
    expect(body.htmlContent).toContain("Maria");
    expect(body.textContent).toContain("Maria");
    expect(body.textContent).toContain("https://quic.pt/confirmado/tok-1");
  });

  it("escapa HTML no nome", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: '<script>alert(1)</script>&"\'', token: "tok" });
    const body = bodyOf(0);
    expect(body.htmlContent).not.toContain("<script>alert(1)</script>");
    expect(body.htmlContent).toContain("&lt;script&gt;");
    expect(body.htmlContent).toContain("&amp;");
    expect(body.htmlContent).toContain("&quot;");
    expect(body.htmlContent).toContain("&#39;");
  });

  it("textSafe colapsa CR/LF para impedir injecção de linhas", async () => {
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: "Maria\r\nBcc: evil@x.com\nFoo", token: "tok" });
    const body = bodyOf(0);
    const olaIdx = body.textContent.indexOf("Olá ");
    const afterOla = body.textContent.slice(olaIdx, body.textContent.indexOf("\n", olaIdx));
    expect(afterOla).not.toMatch(/[\r\n]/);
    expect(afterOla).toContain("Maria Bcc: evil@x.com Foo");
  });

  it("usa defaults quando EMAIL_FROM/SITE_URL ausentes", async () => {
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_FROM;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "u@u.pt", name: "M", token: "tok" });
    const body = bodyOf(0);
    expect(body.sender).toEqual({ name: "QUIC Festival", email: "noreply@quic.pt" });
    expect(body.htmlContent).toContain("/api/qr/tok");
  });

  it("rebenta em produção quando EMAIL_FROM ausente", async () => {
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_FROM;
    vi.stubEnv("NODE_ENV", "production");
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(
      sendRsvpEmail({ to: "u@u.pt", name: "M", token: "tok" }),
    ).rejects.toThrow(/EMAIL_FROM/);
  });

  it("rebenta quando Brevo devolve não-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => '{"message":"boom"}',
      json: async () => ({}),
    });
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(sendRsvpEmail({ to: "u@u.pt", name: "M", token: "t" })).rejects.toThrow(/Brevo 422/);
  });

  it("throw quando BREVO_API_KEY ausente", async () => {
    delete process.env.BREVO_API_KEY;
    const { sendRsvpEmail } = await import("@/lib/email");
    await expect(sendRsvpEmail({ to: "u@u.pt", name: "M", token: "t" })).rejects.toThrow(/BREVO_API_KEY/);
  });

  it("EMAIL_FROM sem display name → só email", async () => {
    vi.stubEnv("EMAIL_FROM", "noreply@quic.pt");
    const { sendRsvpEmail } = await import("@/lib/email");
    await sendRsvpEmail({ to: "a@a.pt", name: "A", token: "t" });
    const body = bodyOf(0);
    expect(body.sender).toEqual({ email: "noreply@quic.pt" });
  });
});
