"use client";

import { useEffect, useRef, useState } from "react";

type ScanResult =
  | { kind: "ok"; name: string; companions: number; token: string }
  | { kind: "duplicate"; name: string; token: string }
  | { kind: "not_found"; token: string }
  | { kind: "error"; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COOLDOWN_MS = 2500;

export default function QrScanner() {
  const containerId = "qr-reader";
  const [last, setLast] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const scannerRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let scanner: unknown;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (cancelled) return;

        const cams = await Html5Qrcode.getCameras();
        if (!cams || cams.length === 0) {
          setCameraError("Sem câmaras disponíveis.");
          return;
        }

        const back =
          cams.find((c) => /back|rear|environment/i.test(c.label)) ?? cams[0];

        const inst = new Html5Qrcode(containerId, { verbose: false });
        scanner = inst;
        scannerRef.current = inst;

        await inst.start(
          back.id,
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decoded) => onDecode(decoded),
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
      if (inst) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDecode(raw: string) {
    const token = raw.trim();
    if (!UUID_RE.test(token)) return;

    const now = Date.now();
    const prev = lastTokenRef.current;
    if (prev && prev.token === token && now - prev.at < COOLDOWN_MS) return;
    lastTokenRef.current = { token, at: now };

    if (busy) return;
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

      if (res.status === 404) {
        record({ kind: "not_found", token });
      } else if (!res.ok) {
        record({ kind: "error", message: json.error ?? "Erro." });
      } else if (json.was_already_checked_in) {
        record({ kind: "duplicate", name: json.guest?.name ?? "?", token });
      } else {
        record({
          kind: "ok",
          name: json.guest?.name ?? "?",
          companions: json.guest?.companion_count ?? 0,
          token,
        });
      }

      buzz();
    } catch (e) {
      record({
        kind: "error",
        message: e instanceof Error ? e.message : "Falha de rede.",
      });
    } finally {
      setBusy(false);
    }
  }

  function record(r: ScanResult) {
    setLast(r);
    setHistory((h) => [r, ...h].slice(0, 8));
  }

  function buzz() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(120);
    }
  }

  const lastBg =
    last?.kind === "ok"
      ? "bg-emerald-600 border-emerald-300"
      : last?.kind === "duplicate"
        ? "bg-amber-600 border-amber-300"
        : last?.kind === "not_found"
          ? "bg-rose-700 border-rose-300"
          : last?.kind === "error"
            ? "bg-rose-800 border-rose-300"
            : "bg-white/5 border-white/15";

  return (
    <div className="grid gap-5 max-w-xl mx-auto">
      <div className="rounded-2xl overflow-hidden border-2 border-[#FFD27A]/40 bg-black aspect-square relative">
        <div id={containerId} className="absolute inset-0" />
        {cameraError && (
          <div className="absolute inset-0 grid place-items-center text-center p-6 text-sm">
            <div>
              <p className="text-rose-300 font-bold mb-2">
                Câmara indisponível
              </p>
              <p className="opacity-70">{cameraError}</p>
              <p className="opacity-60 mt-3 text-xs">
                Verifica permissões do browser e que estás em HTTPS.
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className={`rounded-2xl border-2 p-5 text-white transition ${lastBg}`}
      >
        {!last && (
          <p className="text-sm tracking-[.18em] uppercase opacity-70">
            Aponta a câmara ao QR…
          </p>
        )}
        {last?.kind === "ok" && (
          <>
            <p className="text-xs tracking-[.22em] uppercase opacity-90">
              ✓ Entrada confirmada
            </p>
            <p className="font-serif text-2xl font-black mt-1">{last.name}</p>
            {last.companions > 0 && (
              <p className="text-sm opacity-90 mt-1">
                + {last.companions} acompanhante{last.companions > 1 ? "s" : ""}
              </p>
            )}
          </>
        )}
        {last?.kind === "duplicate" && (
          <>
            <p className="text-xs tracking-[.22em] uppercase opacity-90">
              ⚠ Já tinha check-in
            </p>
            <p className="font-serif text-2xl font-black mt-1">{last.name}</p>
          </>
        )}
        {last?.kind === "not_found" && (
          <>
            <p className="text-xs tracking-[.22em] uppercase opacity-90">
              ✗ QR não reconhecido
            </p>
            <p className="text-xs opacity-70 mt-1 break-all">{last.token}</p>
          </>
        )}
        {last?.kind === "error" && (
          <>
            <p className="text-xs tracking-[.22em] uppercase opacity-90">
              ✗ Erro
            </p>
            <p className="text-sm mt-1">{last.message}</p>
          </>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs tracking-[.22em] uppercase opacity-60 mb-2">
            Últimos
          </p>
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
                  {r.kind === "ok"
                    ? "✓"
                    : r.kind === "duplicate"
                      ? "⚠"
                      : "✗"}
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
  );
}
