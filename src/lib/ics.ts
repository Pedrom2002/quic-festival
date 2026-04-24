function fmt(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildFestivalIcs(guestName: string): string {
  const start = new Date("2026-05-08T17:00:00Z");
  const end = new Date("2026-05-10T02:00:00Z");
  const uid = `quic-festival-2026@quic.pt`;
  const summary = "QUIC Festival 2026";
  const location = "Monsanto Open Air, Lisboa";
  const description =
    `Olá ${guestName}, mostra o teu QR à entrada. 8 e 9 de Maio.`.replace(
      /,/g,
      "\\,",
    );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QUIC//Festival//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
