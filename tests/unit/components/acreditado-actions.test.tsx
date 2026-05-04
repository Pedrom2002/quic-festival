import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AcreditadoActions from "@/components/acreditado-actions";

const mockCtx = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  textAlign: "center" as CanvasTextAlign,
  font: "",
  fillRect: vi.fn(),
  fillText: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  drawImage: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
};

beforeEach(() => {
  Object.values(mockCtx).forEach((v) => typeof v === "function" && (v as ReturnType<typeof vi.fn>).mockClear());

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    mockCtx as unknown as RenderingContext,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,fake",
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  Object.defineProperty(document, "fonts", {
    value: { load: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  vi.stubGlobal(
    "Image",
    class {
      src = "";
      set onload(fn: () => void) {
        fn();
      }
    },
  );
});

afterEach(() => vi.restoreAllMocks());

const PROPS = {
  qrDataUrl: "data:image/png;base64,abc",
  name: "João Silva",
  mediaCompany: "RTP",
  token: "tok-1",
};

describe("AcreditadoActions", () => {
  it("renderiza botão Guardar Card", () => {
    render(<AcreditadoActions {...PROPS} />);
    expect(screen.getByRole("button", { name: /Guardar Card/i })).toBeInTheDocument();
  });

  it("downloadCard: desenha canvas e faz click no link de download", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    render(<AcreditadoActions {...PROPS} />);
    await userEvent.click(screen.getByRole("button", { name: /Guardar Card/i }));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("downloadCard: nome sanitizado no ficheiro de download", async () => {
    let downloadAttr = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadAttr = this.download;
    });

    render(<AcreditadoActions {...PROPS} name="Álvaro & Filha!" />);
    await userEvent.click(screen.getByRole("button", { name: /Guardar Card/i }));
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadAttr).toMatch(/^quic-acreditacao-.+\.png$/);
    expect(downloadAttr).not.toContain("&");
  });

  it("downloadCard: roundRect usa beginPath + quadraticCurveTo + closePath", async () => {
    render(<AcreditadoActions {...PROPS} />);
    await userEvent.click(screen.getByRole("button", { name: /Guardar Card/i }));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
  });

  it("downloadCard: carrega 3 fontes", async () => {
    const loadSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "fonts", {
      value: { load: loadSpy },
      configurable: true,
    });

    render(<AcreditadoActions {...PROPS} />);
    await userEvent.click(screen.getByRole("button", { name: /Guardar Card/i }));
    await new Promise((r) => setTimeout(r, 50));

    expect(loadSpy).toHaveBeenCalledTimes(3);
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("Big Shoulders Stencil"));
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("Fraunces"));
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("DM Sans"));
  });
});
