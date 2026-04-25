import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmadoActions from "@/components/confirmado-actions";

describe("ConfirmadoActions", () => {
  it("renderiza ambos os links com hrefs correctos", () => {
    render(<ConfirmadoActions qrDataUrl="data:fake" token="tok-1" name="Maria João" />);
    const qrLink = screen.getByText("Guardar QR").closest("a")!;
    const icsLink = screen.getByText("Add ao calendário").closest("a")!;
    expect(qrLink.getAttribute("href")).toBe("data:fake");
    expect(qrLink.getAttribute("download")).toBe("quic-qr-maria-jo-o.png");
    expect(icsLink.getAttribute("href")).toBe("/api/ics/tok-1");
  });

  it("safeName remove caracteres especiais", () => {
    render(<ConfirmadoActions qrDataUrl="d" token="t" name='<script>"a&b"' />);
    const link = screen.getByText("Guardar QR").closest("a")!;
    expect(link.getAttribute("download")).toMatch(/^quic-qr-[a-z0-9-]+\.png$/);
  });

  it("safeName lowercase", () => {
    render(<ConfirmadoActions qrDataUrl="d" token="t" name="ABC" />);
    expect(screen.getByText("Guardar QR").closest("a")!.getAttribute("download")).toBe("quic-qr-abc.png");
  });
});
