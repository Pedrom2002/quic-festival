import { describe, expect, it } from "vitest";
import { rsvpSchema } from "@/lib/validators";

const base = {
  name: "Maria João",
  email: "Maria@Example.PT",
  phone: "912345678",
  acompanhante: "nao" as const,
};

describe("rsvpSchema", () => {
  it("aceita payload mínimo válido e normaliza email lowercase", () => {
    const r = rsvpSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("maria@example.pt");
      expect(r.data.companion_nome).toBe("");
      expect(r.data.companion_tel).toBe("");
    }
  });

  it("rejeita nome curto", () => {
    const r = rsvpSchema.safeParse({ ...base, name: "A" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/curto/);
    }
  });

  it("rejeita nome com HTML/dígitos/símbolos", () => {
    for (const bad of ["<script>", "Maria123", "Maria@João", "Maria!"]) {
      expect(rsvpSchema.safeParse({ ...base, name: bad }).success).toBe(false);
    }
  });

  it("aceita nome 120 chars com acentos e apostrofo", () => {
    const name = "M".padEnd(118, "a") + "ão";
    expect(rsvpSchema.safeParse({ ...base, name }).success).toBe(true);
    expect(rsvpSchema.safeParse({ ...base, name: "O'Connor-Silva" }).success).toBe(true);
  });

  it("rejeita nome > 120 chars", () => {
    expect(rsvpSchema.safeParse({ ...base, name: "a".repeat(121) }).success).toBe(false);
  });

  it("aceita telefone PT em vários formatos", () => {
    for (const phone of ["912345678", "+351912345678", "+351 912345678"]) {
      expect(rsvpSchema.safeParse({ ...base, phone }).success).toBe(true);
    }
  });

  it("rejeita telefone inválido", () => {
    for (const phone of ["812345678", "12345", "+34912345678", "9123456789"]) {
      expect(rsvpSchema.safeParse({ ...base, phone }).success).toBe(false);
    }
  });

  it("rejeita email inválido", () => {
    expect(rsvpSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });

  it("acompanhante=sim sem companion_nome falha", () => {
    const r = rsvpSchema.safeParse({ ...base, acompanhante: "sim" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "companion_nome")).toBe(true);
      expect(r.error.issues.some((i) => i.path[0] === "companion_tel")).toBe(true);
    }
  });

  it("acompanhante=sim com nome inválido (regex) falha", () => {
    const r = rsvpSchema.safeParse({
      ...base,
      acompanhante: "sim",
      companion_nome: "Bob<>",
      companion_tel: "912345678",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/inválidos/);
    }
  });

  it("acompanhante=sim com tel inválido falha", () => {
    const r = rsvpSchema.safeParse({
      ...base,
      acompanhante: "sim",
      companion_nome: "Ana",
      companion_tel: "123",
    });
    expect(r.success).toBe(false);
  });

  it("acompanhante=sim válido completo passa", () => {
    expect(
      rsvpSchema.safeParse({
        ...base,
        acompanhante: "sim",
        companion_nome: "Ana Silva",
        companion_tel: "912345678",
      }).success,
    ).toBe(true);
  });

  it("companion_tel inválido com acompanhante=nao é rejeitado", () => {
    const r = rsvpSchema.safeParse({ ...base, companion_tel: "123" });
    expect(r.success).toBe(false);
  });
});
