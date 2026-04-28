"use client";

import { useEffect, useRef, useState } from "react";

type ScanResult =
  | { kind: "ok"; name: string; companions: number; token: string }
  | { kind: "duplicate"; name: string; token: string }
  | { kind: "not_found"; token: string }
  | { kind: "error"; message: string };

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[0-9]+\.[A-Za-z0-9_-]+)?$/i;

const COOLDOWN_MS = 2500;
const AUTO_CLOSE_MS = 3500;

export default function QrScanner() {
  const containerId = "qr-reader";
  const [scanning, setScanning] = useState(false);
  const [modal, setModal] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const scannerRef = useRef<unknown>(null);
  const busyRef = useRef(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    let scanner: unknown;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const inst = new Html5Qrcode(containerId, { verbose: false });
        scanner = inst;
        scannerRef.current = inst;

        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decoded) => onDecode(decoded),
          /* v8 ignore next */
          () => {},
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCameraError(msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      const inst = scanner as
        | { stop: () => Promise<void>; clear: () => void }
        | undefined;
      if (inst) inst.stop().then(() => inst.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  function dismiss() {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    setModal(null);
  }

  async function onDecode(raw: string) {
    const token = raw.trim();
    if (!TOKEN_RE.test(token)) return;

    const now = Date.now();
    const prev = lastTokenRef.current;
    if (prev && prev.token === token && now - prev.at < COOLDOWN_MS) return;
    lastTokenRef.current = { token, at: now };

    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      const res = await fetch("/api/admin/checkin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, checked_in: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        guest?: { name: string; companion_count: number };
        was_already_checked_in?: boolean;
        error?: string;
      };

      let result: ScanResult;
      if (res.status === 404) {
        result = { kind: "not_found", token };
      } else if (!res.ok) {
        result = { kind: "error", message: json.error ?? "Erro." };
      } else if (json.was_already_checked_in) {
        result = { kind: "duplicate", name: json.guest?.name ?? "?", token };
      } else {
        result = {
          kind: "ok",
          name: json.guest?.name ?? "?",
          companions: json.guest?.companion_count ?? 0,
          token,
        };
      }

      setModal(result);
      setHistory((h) => [result, ...h].slice(0, 8));
      buzz();

    } catch (e) {
      const result: ScanResult = {
        kind: "error",
        message: e instanceof Error ? e.message : "Falha de rede.",
      };
      setModal(result);
      setHistory((h) => [result, ...h].slice(0, 8));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function buzz() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(120);
    }
  }

  return (
    <>
      {/* ── Result modal ─────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(6,17,27,0.80)", backdropFilter: "blur(6px)" }}
          onClick={dismiss}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-2 p-8 text-center shadow-2xl"
            style={modalStyle(modal)}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div
              className="mx-auto mb-5 w-20 h-20 rounded-full border-2 grid place-items-center text-4xl font-black"
              style={iconStyle(modal)}
            >
              {modal.kind === "ok" ? "✓" : modal.kind === "duplicate" ? "⚠" : "✗"}
            </div>

            {/* Status label */}
            <p className="text-xs tracking-[.22em] uppercase opacity-80 mb-2">
              {modal.kind === "ok" && "Entrada confirmada"}
              {modal.kind === "duplicate" && "Já tinha check-in"}
              {modal.kind === "not_found" && "QR não reconhecido"}
              {modal.kind === "error" && "Erro"}
            </p>

            {/* Name / detail */}
            {(modal.kind === "ok" || modal.kind === "duplicate") && (
              <p className="font-serif text-3xl font-black leading-tight mb-1">
                {modal.name}
              </p>
            )}
            {modal.kind === "ok" && modal.companions > 0 && (
              <p className="text-sm opacity-80 mt-2">
                + {modal.companions} acompanhante{modal.companions > 1 ? "s" : ""}
              </p>
            )}
            {modal.kind === "not_found" && (
              <p className="text-xs opacity-60 break-all mt-1">{modal.token}</p>
            )}
            {modal.kind === "error" && (
              <p className="text-sm opacity-80 mt-1">{modal.message}</p>
            )}

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="mt-7 w-full rounded-full border-2 border-current py-3 text-xs tracking-[.18em] uppercase font-black opacity-90 hover:opacity-100 transition"
            >
              {modal.kind === "ok" ? "Próximo" : "Fechar"}
            </button>

          </div>
        </div>
      )}

      {/* ── Scanner layout ───────────────────────────── */}
      <div className="grid gap-5 max-w-xl mx-auto">
        <div className="rounded-2xl overflow-hidden border-2 border-[#FFD27A]/40 bg-black aspect-square relative">
          <div id={containerId} className="absolute inset-0" />
          {!scanning && (
            <div className="absolute inset-0 grid place-items-center bg-black/80">
              <button
                onClick={() => setScanning(true)}
                className="rounded-full border-2 border-[#FFD27A] text-[#FFD27A] px-8 py-4 text-sm tracking-[.18em] uppercase font-black hover:bg-[#FFD27A] hover:text-[#06111B] transition"
              >
                Iniciar Scanner
              </button>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="w-10 h-10 rounded-full border-4 border-[#FFD27A]/30 border-t-[#FFD27A] animate-spin" />
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 grid place-items-center text-center p-6 text-sm">
              <div>
                <p className="text-rose-300 font-bold mb-2">Câmara indisponível</p>
                <p className="opacity-70">{cameraError}</p>
                <p className="opacity-60 mt-3 text-xs">
                  Verifica permissões do browser e que estás em HTTPS.
                </p>
              </div>
            </div>
          )}
        </div>

        <details className="rounded-xl border border-white/15 bg-white/5">
          <summary className="cursor-pointer px-4 py-3 text-xs tracking-[.18em] uppercase opacity-80 hover:opacity-100">
            Inserir token manualmente
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = manual.trim();
              if (!v) return;
              setManual("");
              void onDecode(v);
            }}
            className="flex gap-2 p-3 pt-0"
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="UUID do token"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="flex-1 min-w-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono outline-none focus:border-[#FFD27A]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border-2 border-[#FFD27A] text-[#FFD27A] px-3 py-2 text-xs tracking-[.16em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] disabled:opacity-50 transition"
            >
              Check-in
            </button>
          </form>
        </details>

        {history.length > 0 && (
          <div>
            <p className="text-xs tracking-[.22em] uppercase opacity-60 mb-2">Últimos</p>
            <ul className="grid gap-1 text-sm">
              {history.map((r, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    r.kind === "ok"
                      ? "border-emerald-500/40 text-emerald-200"
                      : r.kind === "duplicate"
                        ? "border-amber-500/40 text-amber-200"
                        : "border-rose-500/40 text-rose-200"
                  }`}
                >
                  <span className="text-base">
                    {r.kind === "ok" ? "✓" : r.kind === "duplicate" ? "⚠" : "✗"}
                  </span>
                  <span className="flex-1 truncate">
                    {r.kind === "ok" || r.kind === "duplicate"
                      ? r.name
                      : r.kind === "not_found"
                        ? "Token desconhecido"
                        : r.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function modalStyle(r: ScanResult): React.CSSProperties {
  if (r.kind === "ok")
    return { background: "#064e3b", borderColor: "#34d399", color: "#ecfdf5" };
  if (r.kind === "duplicate")
    return { background: "#78350f", borderColor: "#fbbf24", color: "#fffbeb" };
  return { background: "#7f1d1d", borderColor: "#f87171", color: "#fef2f2" };
}

function iconStyle(r: ScanResult): React.CSSProperties {
  if (r.kind === "ok") return { borderColor: "#34d399", background: "#065f46" };
  if (r.kind === "duplicate") return { borderColor: "#fbbf24", background: "#92400e" };
  return { borderColor: "#f87171", background: "#991b1b" };
}
