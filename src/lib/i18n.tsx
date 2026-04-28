"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "pt" | "en";

type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = {
  pt: {
    "rsvp.title.before": "Confirma a tua ",
    "rsvp.title.em": "presença",
    "rsvp.title.after": ".",
    "rsvp.subtitle": "Precisamos só de alguns dados para te pôr na lista.",
    "rsvp.name": "Nome completo",
    "rsvp.phone": "Telefone",
    "rsvp.email": "Email",
    "rsvp.email.placeholder": "tu@exemplo.pt",
    "rsvp.companion.q": "Levas acompanhante?",
    "rsvp.yes": "SIM",
    "rsvp.no": "NÃO",
    "rsvp.companion.name": "Nome do acompanhante",
    "rsvp.companion.phone": "Telefone do acompanhante",
    "rsvp.companion.email": "Email do acompanhante",
    "rsvp.submit": "CONFIRMAR PRESENÇA",
    "rsvp.submitting": "A CONFIRMAR…",
    "rsvp.error.captcha": "Resolve o captcha primeiro.",
    "rsvp.error.generic": "Algo correu mal. Tenta novamente.",
    "rsvp.error.network": "Sem ligação. Verifica a internet e tenta outra vez.",
    "rsvp.info.received": "Inscrição recebida. Vê o teu email para o QR de entrada.",
    "rsvp.fineprint":
      "Ao confirmar autorizas o tratamento dos teus dados (nome, email, telefone) apenas para gestão da entrada e comunicação relativa ao QUIC Festival 2026, conforme RGPD. Não partilhamos com terceiros. Para análise de tráfego usamos Vercel Analytics (estatística agregada, sem cookies de marketing). Detalhes em ",
    "rsvp.fineprint.delete": ". Pedidos de eliminação: ",
    "home.invite.title": "Acesso por ",
    "home.invite.title.em": "convite",
    "home.invite.title.after": ".",
    "home.invite.subtitle": "Este evento é fechado. Para confirmar presença precisas de um link de convite enviado pela organização.",
    "invite.banner.tag": "Convite Pessoal",
    "invite.banner.for": "Para",
  },
  en: {
    "rsvp.title.before": "Confirm your ",
    "rsvp.title.em": "attendance",
    "rsvp.title.after": ".",
    "rsvp.subtitle": "We just need a few details to add you to the list.",
    "rsvp.name": "Full name",
    "rsvp.phone": "Phone",
    "rsvp.email": "Email",
    "rsvp.email.placeholder": "you@example.com",
    "rsvp.companion.q": "Bringing a companion?",
    "rsvp.yes": "YES",
    "rsvp.no": "NO",
    "rsvp.companion.name": "Companion's name",
    "rsvp.companion.phone": "Companion's phone",
    "rsvp.companion.email": "Companion's email",
    "rsvp.submit": "CONFIRM ATTENDANCE",
    "rsvp.submitting": "CONFIRMING…",
    "rsvp.error.captcha": "Solve the captcha first.",
    "rsvp.error.generic": "Something went wrong. Try again.",
    "rsvp.error.network": "No connection. Check your internet and retry.",
    "rsvp.info.received": "Registration received. Check your email for the entry QR.",
    "rsvp.fineprint":
      "By confirming you authorise processing of your data (name, email, phone) solely to manage entry and communications related to QUIC Festival 2026, in line with GDPR. We do not share with third parties. For traffic analysis we use Vercel Analytics (aggregate, no marketing cookies). Details at ",
    "rsvp.fineprint.delete": ". Deletion requests: ",
    "home.invite.title": "Access by ",
    "home.invite.title.em": "invitation",
    "home.invite.title.after": ".",
    "home.invite.subtitle": "This is a closed event. To confirm attendance you need an invitation link sent by the organisation.",
    "invite.banner.tag": "Personal Invite",
    "invite.banner.for": "For",
  },
};

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
};

const I18nContext = createContext<I18nValue>({
  lang: "pt",
  setLang: () => {},
  t: (k) => dictionaries.pt[k] ?? k,
});

const STORAGE_KEY = "quic-lang";

function readSavedLang(): Lang {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    /* localStorage unavailable */
  }
  return "pt";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readSavedLang);

  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        try {
          window.localStorage.setItem(STORAGE_KEY, l);
          document.documentElement.lang = l === "pt" ? "pt-PT" : "en";
        } catch {
          /* localStorage unavailable */
        }
      },
      t: (k: string) => dictionaries[lang][k] ?? dictionaries.pt[k] ?? k,
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
