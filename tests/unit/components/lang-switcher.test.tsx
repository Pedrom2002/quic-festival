import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LangSwitcher from "@/components/lang-switcher";
import { I18nProvider } from "@/lib/i18n";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("LangSwitcher", () => {
  it("renderiza dois botões PT e EN com PT activo por defeito", () => {
    render(
      <I18nProvider>
        <LangSwitcher />
      </I18nProvider>,
    );
    const pt = screen.getByRole("button", { name: /Português/ });
    const en = screen.getByRole("button", { name: /English/ });
    expect(pt).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar EN muda o estado active", async () => {
    render(
      <I18nProvider>
        <LangSwitcher />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /English/ }));
    expect(screen.getByRole("button", { name: /English/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Português/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicar PT depois de EN volta ao estado inicial", async () => {
    render(
      <I18nProvider>
        <LangSwitcher />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /English/ }));
    await userEvent.click(screen.getByRole("button", { name: /Português/ }));
    expect(screen.getByRole("button", { name: /Português/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
