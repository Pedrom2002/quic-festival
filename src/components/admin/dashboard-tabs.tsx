"use client";

import { useState } from "react";
import GuestsTable from "@/components/admin/guests-table";
import AccreditationsTable from "@/components/admin/accreditations-table";

type Guest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  companion_count: number;
  companion_names: string[];
  token: string;
  checked_in_day1_at: string | null;
  checked_in_day2_at: string | null;
  email_sent_at: string | null;
  email_failed_at: string | null;
  email_attempts: number;
};

type Accreditation = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  media_company: string;
  token: string;
};

type GuestStats = {
  total: number;
  companions: number;
  checkedInDay1: number;
  checkedInDay2: number;
  pending: number;
  checkInRate: number;
  emailFailed: number;
  lastCheckIn: string | undefined;
};

type AccreditationStats = {
  total: number;
  companies: number;
};

type Tab = "convidados" | "acreditacoes";

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
}) {
  const border = accent
    ? "border-[#FFD27A] bg-[#FFD27A]/10"
    : warn
      ? "border-rose-400/60 bg-rose-900/20"
      : "border-white/15 bg-white/5";
  const valueColor = accent ? "text-[#FFD27A]" : warn ? "text-rose-300" : "";
  return (
    <div className={`rounded-2xl border-2 p-4 ${border}`}>
      <div className="text-xs tracking-[.18em] uppercase opacity-60">{label}</div>
      <div className={`text-3xl font-black font-serif mt-1 ${valueColor}`}>{value}</div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("pt-PT");
}

export default function DashboardTabs({
  guests,
  guestStats,
  accreditations,
  accreditationStats,
}: {
  guests: Guest[];
  guestStats: GuestStats;
  accreditations: Accreditation[];
  accreditationStats: AccreditationStats;
}) {
  const [tab, setTab] = useState<Tab>("convidados");

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-5 py-2 rounded-full text-xs tracking-[.18em] uppercase font-black transition border-2 ${
        tab === t
          ? "border-[#FFD27A] bg-[#FFD27A] text-[#06111B]"
          : "border-white/20 opacity-60 hover:opacity-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-2">
          {tabBtn("convidados", "Convidados")}
          {tabBtn("acreditacoes", "Acreditações Media")}
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === "convidados" && (
            <>
              <a
                href="/admin/scan"
                className="rounded-full border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-4 py-2 text-xs tracking-[.18em] uppercase hover:opacity-90 transition"
              >
                Scan QR
              </a>
              <a
                href="/admin/audit"
                className="rounded-full border-2 border-white/25 px-4 py-2 text-xs tracking-[.18em] uppercase hover:border-[#FFD27A] hover:text-[#FFD27A] transition"
              >
                Audit
              </a>
              <a
                href="/api/admin/export"
                className="rounded-full border-2 border-[#FFD27A] text-[#FFD27A] px-4 py-2 text-xs tracking-[.18em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition"
              >
                Export CSV
              </a>
            </>
          )}
          {tab === "acreditacoes" && (
            <a
              href="/admin/acreditacoes"
              className="rounded-full border-2 border-[#FFD27A] text-[#FFD27A] px-4 py-2 text-xs tracking-[.18em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition"
            >
              Gerir Links
            </a>
          )}
        </div>
      </div>

      {/* Convidados */}
      {tab === "convidados" && (
        <>
          <p className="text-sm opacity-60 mb-4">
            Total de inscrições + acompanhantes:{" "}
            {guestStats.total + guestStats.companions}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Inscritos" value={guestStats.total} />
            <Stat label="Acompanhantes" value={guestStats.companions} />
            <Stat label="Check-in Dia 1" value={guestStats.checkedInDay1} accent />
            <Stat label="Check-in Dia 2" value={guestStats.checkedInDay2} accent />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Pendentes" value={guestStats.pending} />
            <Stat label="Taxa de entrada" value={`${guestStats.checkInRate}%`} />
            <Stat
              label="Último scan"
              value={guestStats.lastCheckIn ? formatTimeAgo(guestStats.lastCheckIn) : "—"}
            />
            <Stat
              label="Emails falhados"
              value={guestStats.emailFailed}
              warn={guestStats.emailFailed > 0}
            />
          </div>
          <GuestsTable initial={guests} />
        </>
      )}

      {/* Acreditações */}
      {tab === "acreditacoes" && (
        <>
          <p className="text-sm opacity-60 mb-4">
            Total de acreditações media submetidas: {accreditationStats.total}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Acreditados" value={accreditationStats.total} accent />
            <Stat label="Empresas" value={accreditationStats.companies} />
          </div>
          <AccreditationsTable initial={accreditations} />
        </>
      )}
    </div>
  );
}
