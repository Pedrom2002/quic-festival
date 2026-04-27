import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmadoActions from "@/components/confirmado-actions";

describe("ConfirmadoActions", () => {
  it("renderiza botão Guardar QR e link calendário", () => {
    render(<ConfirmadoActions qrDataUrl="data:fake" token="tok-1" name="Maria João" />);
    expect(screen.getByText("Guardar QR")).toBeInTheDocument();
    const icsLink = screen.getByText("Add ao calendário").closest("a")!;
    expect(icsLink.getAttribute("href")).toBe("/api/ics/tok-1");
  });
});
