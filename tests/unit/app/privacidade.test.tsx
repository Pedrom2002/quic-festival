import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import PrivacidadePage, { metadata } from "@/app/privacidade/page";

describe("/privacidade", () => {
  it("renderiza secções RGPD chave", () => {
    const { getByText, container } = render(<PrivacidadePage />);
    expect(getByText("Privacidade")).toBeTruthy();
    expect(container.textContent).toContain("Dados recolhidos");
    expect(container.textContent).toContain("Sub-processadores");
    expect(container.textContent).toContain("Retenção");
    expect(container.textContent).toContain("Direitos RGPD");
  });

  it("exporta metadata correcta", () => {
    expect(metadata.title).toContain("Privacidade");
    expect(metadata.description).toBeTruthy();
  });
});
