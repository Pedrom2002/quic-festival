import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startMock = vi.fn(async () => {});
const stopMock = vi.fn(async () => {});
const clearMock = vi.fn();
const getCamerasMock = vi.fn(async () => [{ id: "cam-1", label: "Back camera" }]);

const ctorMock = vi.fn();
class FakeHtml5Qrcode {
  start = startMock;
  stop = stopMock;
  clear = clearMock;
  constructor(id: string, opts: unknown) {
    ctorMock(id, opts);
  }
  static getCameras = getCamerasMock;
}

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: FakeHtml5Qrcode,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  startMock.mockClear();
  stopMock.mockClear();
  clearMock.mockClear();
  getCamerasMock.mockClear();
  getCamerasMock.mockResolvedValue([{ id: "cam-1", label: "Back camera" }]);
  ctorMock.mockClear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

const VALID_TOKEN = "11111111-1111-1111-1111-111111111111";

describe("QrScanner", () => {
  it("inicia scanner ao montar (escolhe back camera)", async () => {
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(getCamerasMock).toHaveBeenCalled();
    expect(startMock).toHaveBeenCalled();
  });

  it("fallback para primeira câmara se nenhuma 'back'", async () => {
    getCamerasMock.mockResolvedValueOnce([{ id: "cam-front", label: "Front" }]);
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(startMock).toHaveBeenCalledWith("cam-front", expect.anything(), expect.any(Function), expect.any(Function));
  });

  it("sem câmaras → mensagem 'Sem câmaras'", async () => {
    getCamerasMock.mockResolvedValueOnce([]);
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(await screen.findByText(/Sem câmaras/)).toBeInTheDocument();
  });

  it("getCameras throw → cameraError", async () => {
    getCamerasMock.mockRejectedValueOnce(new Error("denied"));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(await screen.findByText("denied")).toBeInTheDocument();
  });

  it("getCameras throw com non-Error → cameraError String", async () => {
    getCamerasMock.mockRejectedValueOnce("string err");
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(await screen.findByText(/string err/)).toBeInTheDocument();
  });

  it("manual: token UUID → POST checkin + record ok", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, guest: { name: "Maria", companion_count: 1 } }), { status: 200 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    const input = screen.getByPlaceholderText(/UUID do token/);
    await user.type(input, VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/checkin", expect.objectContaining({ method: "PATCH" }));
    expect((await screen.findAllByText("Maria")).length).toBeGreaterThan(0);
  });

  it("manual: input não-UUID ignorado", async () => {
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), "not-uuid");
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manual: input vazio early return", async () => {
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API 404 → not_found", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 404 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect(await screen.findByText(/QR não reconhecido/)).toBeInTheDocument();
  });

  it("API erro 500 → kind=error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect((await screen.findAllByText("boom")).length).toBeGreaterThan(0);
  });

  it("API erro sem error message → fallback 'Erro'", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect((await screen.findAllByText("Erro.")).length).toBeGreaterThan(0);
  });

  it("duplicate → ⚠ kind", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ was_already_checked_in: true, guest: { name: "Bruno", companion_count: 0 } }), { status: 200 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect(await screen.findByText(/Já tinha check-in/)).toBeInTheDocument();
  });

  it("network error → kind=error com mensagem", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("net"));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    expect((await screen.findAllByText("net")).length).toBeGreaterThan(0);
  });

  it("vibrate API chamada quando disponível", async () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrateMock });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, guest: { name: "M", companion_count: 0 } }), { status: 200 }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Inserir token manualmente/));
    await user.type(screen.getByPlaceholderText(/UUID do token/), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: /^check-in$/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(vibrateMock).toHaveBeenCalledWith(120);
  });
});
