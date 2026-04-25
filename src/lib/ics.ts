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

// RFC 5545 §3.1: linhas > 75 octetos partem com CRLF + SPACE. Tem de ser por
// octetos (UTF-8), não por characters JS (UTF-16 code units), senão acentos
// PT (`á`, `ç`) podem ficar partidos a meio do code-point e o parser do
// calendário rejeita ou corrompe a string.
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: false });

function fold(line: string): string {
  const bytes = ENCODER.encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  // Primeira linha: 75 octetos. Subsequentes: SPACE + 74 octetos = 75.
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Recua até não estarmos a meio de um code-point UTF-8.
    // Bytes 0x80-0xBF são continuation bytes; queremos parar antes deles.
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    chunks.push((offset === 0 ? "" : " ") + DECODER.decode(bytes.subarray(offset, end)));
    offset = end;
    limit = 74; // espaço inicial conta para os 75.
  }
  return chunks.join("\r\n");
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
