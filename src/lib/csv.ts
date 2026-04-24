export type CsvRow = Record<string, string | number | null | undefined>;

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function toCsv(rows: CsvRow[], headers: string[]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows
    .map((r) => headers.map((h) => csvCell(r[h])).join(","))
    .join("\r\n");
  return `﻿${head}\r\n${body}`;
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Defesa contra CSV formula injection (Excel/LibreOffice executam =, +, -, @ no início).
  if (s.length > 0 && FORMULA_PREFIXES.includes(s[0]!)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
