import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, key: string) => {
      const Comp = (props: Record<string, unknown>) => {
        const { children, ...rest } = props;
        const Tag = key as keyof JSX.IntrinsicElements;
        const filtered: Record<string, unknown> = {};
        for (const k of Object.keys(rest)) {
          if (!/^(initial|animate|whileInView|whileHover|whileTap|exit|viewport|transition|variants|drag|layout|onAnimation|whileDrag|onDrag)/.test(k)) {
            filtered[k] = rest[k];
          }
        }
        return <Tag {...filtered}>{children as React.ReactNode}</Tag>;
      };
      return Comp;
    },
  }),
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Lineup from "@/components/lineup";

describe("Lineup", () => {
  it("render todos os artistas dos 2 dias", () => {
    render(<Lineup />);
    expect(screen.getByText("Nonstop")).toBeInTheDocument();
    expect(screen.getByText("Kiko is Hot")).toBeInTheDocument();
    expect(screen.getByText("DJ Marques")).toBeInTheDocument();
    expect(screen.getByText("Soraia Ramos")).toBeInTheDocument();
    expect(screen.getByText("Rony Fuego")).toBeInTheDocument();
    expect(screen.getByText("DJ Overule")).toBeInTheDocument();
  });

  it("render datas dos dias", () => {
    render(<Lineup />);
    expect(screen.getByText("8 de Maio")).toBeInTheDocument();
    expect(screen.getByText("9 de Maio")).toBeInTheDocument();
  });
});
