import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Lineup from "@/components/lineup";

describe("Lineup", () => {
  it("render imagem de lineup", () => {
    render(<Lineup />);
    const img = screen.getByAltText("Lineup QUIC Festival 2026");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/Design sem nome.png");
  });
});
