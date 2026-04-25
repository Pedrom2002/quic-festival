import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/scene", () => ({ default: () => <div data-test="scene" /> }));
vi.mock("@/components/rsvp-form", () => ({ default: () => <div data-test="form" /> }));
vi.mock("@/components/lineup", () => ({ default: () => <div data-test="lineup" /> }));

import HomePage from "@/app/page";

afterEach(() => vi.restoreAllMocks());

describe("HomePage", () => {
  it("monta sem rebentar e inclui scene/form/lineup", () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const { container } = render(<HomePage />);
    expect(container.querySelector('[data-test="scene"]')).toBeTruthy();
    expect(container.querySelector('[data-test="form"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-test="lineup"]').length).toBe(2);
    raf.mockRestore();
  });

  it("aplica classe 'in' após mounted", async () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const { container } = render(<HomePage />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector(".site-main.in")).toBeTruthy();
    raf.mockRestore();
  });
});
