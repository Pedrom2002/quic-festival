export type CsvRow = Record<string, string | number | null | undefined>;

export function toCsv(rows: CsvRow[], headers: string[]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows
    .map((r) => headers.map((h) => csvCell(r[h])).join(","))
    .join("\r\n");
  return `﻿${head}\r\n${body}`;
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
