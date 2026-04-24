function fmt(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// RFC 5545 escape: backslash, semicolon, comma, newlines.
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

// RFC 5545 line folding: linhas > 75 octetos partem com CRLF + espaço.
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
    i += 74;
  }
  return out.join("\r\n");
}

export function buildFestivalIcs(guestName: string): string {
  const start = new Date("2026-05-08T17:00:00Z");
  const end = new Date("2026-05-10T02:00:00Z");
  const uid = "quic-festival-2026@quic.pt";
  const summary = icsEscape("QUIC Festival 2026");
  const location = icsEscape("QUIC Festival 2026, Lisboa");
  const description = icsEscape(
    `Olá ${guestName}, mostra o teu QR à entrada. 8 e 9 de Maio.`,
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QUIC//Festival//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    fold(`SUMMARY:${summary}`),
    fold(`LOCATION:${location}`),
    fold(`DESCRIPTION:${description}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
