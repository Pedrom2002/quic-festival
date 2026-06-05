"use client";

import type { CSSProperties } from "react";
import type { TeamMember } from "@/lib/team-members";
import Image from "next/image";

export default function CardView({ member }: { member: TeamMember }) {
  const cardUrl = `https://app.quic.pt/card/${member.slug}`;
  const vcfUrl = `/api/card/${member.slug}/vcf`;
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${member.name.split(" ").slice(1).join(" ")};${member.name.split(" ")[0]};;;`,
    `FN:${member.name}`,
    "ORG:QUIC",
    `TITLE:${member.role}`,
    member.phone ? `TEL;TYPE=CELL:${member.phone}` : null,
    `EMAIL:${member.email}`,
    `URL:${cardUrl}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(vcard)}`;

  return (
    <div style={{
      background: "#0a0a0a",
      color: "#f0f0f0",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <main style={{
        width: "100%",
        maxWidth: "360px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* Top accent */}
        <div style={{ width: 48, height: 2, background: "#fff", marginBottom: 36 }} />

        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <Image src="/logo.png" alt="QUIC" height={72} width={200} style={{ height: 72, width: "auto" }} priority />
        </div>

        {/* Identity */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.3px" }}>
            {member.name}
          </h1>
          <p style={{ fontSize: 12, color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: 6 }}>
            {member.role}
          </p>
        </div>

        {/* Divider */}
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e", width: "100%", margin: "28px 0" }} />

        {/* Contact rows */}
        <ul style={{ listStyle: "none", width: "100%", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, padding: 0 }}>
          {member.phone && (
            <li>
              <a href={`tel:${member.phone}`} style={contactRowStyle}>
                <span style={iconStyle}>
                  <svg viewBox="0 0 24 24" style={svgStyle}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                </span>
                <div style={contactTextStyle}>
                  <span style={labelStyle}>Telefone</span>
                  <span style={valueStyle}>{member.phone}</span>
                </div>
              </a>
            </li>
          )}
          <li>
            <a href={`mailto:${member.email}`} style={contactRowStyle}>
              <span style={iconStyle}>
                <svg viewBox="0 0 24 24" style={svgStyle}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </span>
              <div style={contactTextStyle}>
                <span style={labelStyle}>Email</span>
                <span style={valueStyle}>{member.email}</span>
              </div>
            </a>
          </li>
        </ul>

        {/* Save contact CTA */}
        <a href={vcfUrl} download style={{
          width: "100%",
          background: "#fff",
          color: "#0a0a0a",
          padding: "14px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          textAlign: "center",
          display: "block",
          marginBottom: 32,
        }}>
          Guardar Contacto
        </a>

        {/* QR Code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 10, color: "#333", textTransform: "uppercase", letterSpacing: "2px" }}>
            Partilhar este cartão
          </p>
          <div style={{ background: "#fff", borderRadius: 12, padding: 10, display: "inline-flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt={`QR code para partilhar o cartão de ${member.name}`} width={160} height={160} style={{ display: "block", borderRadius: 4 }} />
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ width: 48, height: 2, background: "#1e1e1e", marginTop: 36 }} />
      </main>
    </div>
  );
}

const contactRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  background: "#111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "13px 16px",
  textDecoration: "none",
};

const iconStyle: CSSProperties = {
  width: 36,
  height: 36,
  background: "#1a1a1a",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const svgStyle: CSSProperties = {
  width: 16,
  height: 16,
  stroke: "#888",
  fill: "none",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const contactTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontSize: 10,
  color: "#444",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const valueStyle: CSSProperties = {
  fontSize: 13,
  color: "#ccc",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
