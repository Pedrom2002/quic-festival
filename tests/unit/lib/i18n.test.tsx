import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useT } from "@/lib/i18n";

function Probe() {
  const { lang, setLang, t } = useT();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="title">{t("rsvp.title.em")}</span>
      <span data-testid="missing">{t("nope.key")}</span>
      <button onClick={() => setLang("en")}>to-en</button>
      <button onClick={() => setLang("pt")}>to-pt</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "";
});
afterEach(() => {
  window.localStorage.clear();
});

describe("i18n", () => {
  it("default sem provider devolve PT", () => {
    render(<Probe />);
    expect(screen.getByTestId("lang").textContent).toBe("pt");
    expect(screen.getByTestId("title").textContent).toBe("presença");
  });

  it("provider arranca em PT por defeito", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("pt");
    expect(screen.getByTestId("title").textContent).toBe("presença");
  });

  it("setLang('en') troca dicionário e persiste em localStorage + html.lang", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByText("to-en"));
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("title").textContent).toBe("attendance");
    expect(window.localStorage.getItem("quic-lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("setLang('pt') volta a PT e ajusta html.lang para pt-PT", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByText("to-en"));
    await userEvent.click(screen.getByText("to-pt"));
    expect(document.documentElement.lang).toBe("pt-PT");
    expect(window.localStorage.getItem("quic-lang")).toBe("pt");
  });

  it("hidrata a partir de localStorage no mount", async () => {
    window.localStorage.setItem("quic-lang", "en");
    await act(async () => {
      render(
        <I18nProvider>
          <Probe />
        </I18nProvider>,
      );
    });
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignora valor inválido no localStorage", async () => {
    window.localStorage.setItem("quic-lang", "fr");
    await act(async () => {
      render(
        <I18nProvider>
          <Probe />
        </I18nProvider>,
      );
    });
    expect(screen.getByTestId("lang").textContent).toBe("pt");
  });

  it("t(key) devolve a chave quando não existe tradução", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("missing").textContent).toBe("nope.key");
  });
});
