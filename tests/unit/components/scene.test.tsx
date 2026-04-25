import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Scene from "@/components/scene";

beforeEach(() => {
  // jsdom não implementa SVG geom. Patch via Element.prototype para apanhar
  // querySelector que devolve elemento generic.
  const protos: object[] = [];
  const SVGPath = (globalThis as { SVGPathElement?: { prototype: object } }).SVGPathElement;
  if (SVGPath) protos.push(SVGPath.prototype);
  protos.push(Element.prototype);
  for (const proto of protos) {
    Object.defineProperty(proto, "getTotalLength", {
      configurable: true,
      value: function () { return 1000; },
    });
    Object.defineProperty(proto, "getPointAtLength", {
      configurable: true,
      value: function (t: number) { return { x: t, y: t / 2 }; },
    });
  }
});
afterEach(() => vi.restoreAllMocks());

describe("Scene", () => {
  it("monta sem rebentar e gera estrelas + bulbs", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    const { container } = render(<Scene />);
    expect(container.querySelectorAll(".s").length).toBeGreaterThan(0);
    expect(container.querySelector(".scene")).toBeInTheDocument();
  });

  it("mobile: menos estrelas (innerWidth < 600)", () => {
    Object.defineProperty(window, "innerWidth", { value: 400, writable: true });
    const { container } = render(<Scene />);
    expect(container.querySelectorAll(".s").length).toBe(40);
  });

  it("resize handler debounce + cleanup", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    const { unmount } = render(<Scene />);
    window.dispatchEvent(new Event("resize"));
    expect(() => unmount()).not.toThrow();
  });

  it("renderBulbs sai cedo se path ausente", () => {
    Object.defineProperty(SVGElement.prototype, "querySelector", {
      configurable: true,
      value: () => null,
    });
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    expect(() => render(<Scene />)).not.toThrow();
  });
});
