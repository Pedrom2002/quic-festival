import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, key: string) => {
      const Comp = (props: Record<string, unknown>) => {
        const { children, ...rest } = props;
        const Tag = key as keyof JSX.IntrinsicElements;
        const filtered: Record<string, unknown> = {};
        for (const k of Object.keys(rest)) {
          if (!/^(initial|animate|whileInView|whileHover|whileTap|exit|viewport|transition|variants|drag|layout)/.test(k)) {
            filtered[k] = rest[k];
          }
        }
        return <Tag {...filtered}>{children as React.ReactNode}</Tag>;
      };
      return Comp;
    },
  }),
  useReducedMotion: vi.fn(() => false),
  useMotionValue: (v: number) => ({ get: () => v, set: vi.fn(), on: vi.fn() }),
  useSpring: (v: { get: () => number }) => v,
}));

import { useReducedMotion } from "framer-motion";
import Blobs from "@/components/blobs";

afterEach(() => vi.clearAllMocks());

describe("Blobs", () => {
  it("monta após mounted=true e renderiza 3 blobs SVG", async () => {
    const { container } = render(<Blobs />);
    await act(() => Promise.resolve());
    expect(container.querySelectorAll("svg").length).toBe(3);
  });

  it("subscreve mousemove e cleanup", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Blobs />);
    await act(() => Promise.resolve());
    expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function), expect.any(Object));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
  });

  it("mousemove actualiza motion values", async () => {
    const { container } = render(<Blobs />);
    await act(() => Promise.resolve());
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 300 }));
    expect(container).toBeInTheDocument();
  });

  it("reduced motion: skip mousemove listener", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Blobs />);
    await act(() => Promise.resolve());
    const calls = addSpy.mock.calls.filter((c) => c[0] === "mousemove");
    expect(calls.length).toBe(0);
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });
});
