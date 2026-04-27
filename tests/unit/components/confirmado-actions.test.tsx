import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmadoActions from "@/components/confirmado-actions";

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

describe("ConfirmadoActions", () => {
  it("renderiza botão Guardar QR e link calendário", () => {
    render(<ConfirmadoActions qrDataUrl="data:fake" token="tok-1" name="Maria João" />);
    expect(screen.getByText("Guardar QR")).toBeInTheDocument();
    const icsLink = screen.getByText("Add ao calendário").closest("a")!;
    expect(icsLink.getAttribute("href")).toBe("/api/ics/tok-1");
  });

  it("downloadCard: desenha canvas e faz click no link de download", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    render(
      <ConfirmadoActions qrDataUrl="data:image/png;base64,abc" token="tok-1" name="Maria" />,
    );
    await userEvent.click(screen.getByText("Guardar QR"));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("downloadCard: nome é sanitizado no ficheiro de download", async () => {
    let downloadAttr = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadAttr = this.download;
    });

    render(
      <ConfirmadoActions
        qrDataUrl="data:image/png;base64,abc"
        token="tok-1"
        name="João & Maria!"
      />,
    );
    await userEvent.click(screen.getByText("Guardar QR"));
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadAttr).toMatch(/^quic-convite-.+\.png$/);
    expect(downloadAttr).not.toContain(" ");
    expect(downloadAttr).not.toContain("&");
  });

  it("downloadCard: roundRect chamado para bordas (beginPath + quadraticCurveTo + closePath)", async () => {
    render(
      <ConfirmadoActions qrDataUrl="data:image/png;base64,abc" token="tok-1" name="Test" />,
    );
    await userEvent.click(screen.getByText("Guardar QR"));
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
  });

  it("downloadCard: carrega as 3 fontes antes de desenhar", async () => {
    const loadSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "fonts", {
      value: { load: loadSpy },
      configurable: true,
    });

    render(
      <ConfirmadoActions qrDataUrl="data:image/png;base64,abc" token="tok-1" name="Ana" />,
    );
    await userEvent.click(screen.getByText("Guardar QR"));
    await new Promise((r) => setTimeout(r, 50));

    expect(loadSpy).toHaveBeenCalledTimes(3);
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("Big Shoulders Stencil"));
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("Fraunces"));
    expect(loadSpy).toHaveBeenCalledWith(expect.stringContaining("DM Sans"));
  });

  it("downloadCard: href do link é o dataURL do canvas", async () => {
    let hrefAttr = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      hrefAttr = this.href;
    });

    render(
      <ConfirmadoActions qrDataUrl="data:image/png;base64,abc" token="tok-1" name="Rui" />,
    );
    await userEvent.click(screen.getByText("Guardar QR"));
    await new Promise((r) => setTimeout(r, 50));

    expect(hrefAttr).toContain("data:image/png");
  });
});
