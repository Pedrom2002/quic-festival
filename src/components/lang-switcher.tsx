"use client";

import { useT, type Lang } from "@/lib/i18n";

export default function LangSwitcher() {
  const { lang, setLang } = useT();

  const make = (code: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(code)}
      className={`lang-btn${lang === code ? " active" : ""}`}
      aria-pressed={lang === code}
      aria-label={code === "pt" ? "Português" : "English"}
    >
      {label}
    </button>
  );

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {make("pt", "PT")}
      <span aria-hidden="true" className="lang-sep">
        /
      </span>
      {make("en", "EN")}
    </div>
  );
}
