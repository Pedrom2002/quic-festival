import { z } from "zod";
import { INVITE_CODE_RE } from "@/lib/invite-code";

const phonePT = /^(\+351\s?)?9\d{8}$/;
// Letras Unicode (p/ acentos), marcas combinatórias, espaços, apóstrofos, hífens, ponto.
// Bloqueia HTML, ASCII control, dígitos, símbolos exóticos.
const namePattern = /^[\p{L}\p{M}\s'.\-]{2,120}$/u;

export const rsvpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nome demasiado curto")
      .max(120)
      .regex(namePattern, "Nome contém caracteres inválidos"),
    email: z.string().trim().toLowerCase().email("Email inválido"),
    phone: z
      .string()
      .trim()
      .regex(phonePT, "Telefone PT inválido (9XXXXXXXX)"),
    acompanhante: z.enum(["sim", "nao"]),
    companion_nome: z.string().trim().max(120).optional().default(""),
    companion_tel: z
      .string()
      .trim()
      .refine((v) => v === "" || phonePT.test(v), "Telefone inválido")
      .optional()
      .default(""),
    companion_email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email inválido")
      .optional()
      .default(""),

    inviteCode: z
      .string()
      .trim()
      .regex(INVITE_CODE_RE, "Código de convite inválido")
      .optional(),
    captchaToken: z.string().max(2048).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.acompanhante === "sim") {
      if (!data.companion_nome || data.companion_nome.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_nome"],
          message: "Nome do acompanhante obrigatório",
        });
      } else if (!namePattern.test(data.companion_nome)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_nome"],
          message: "Nome do acompanhante contém caracteres inválidos",
        });
      }
      if (!data.companion_tel || !phonePT.test(data.companion_tel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_tel"],
          message: "Telefone do acompanhante inválido",
        });
      }
      if (!data.companion_email || !z.string().email().safeParse(data.companion_email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_email"],
          message: "Email do acompanhante obrigatório",
        });
      }
    }
  });

export type RsvpInput = z.infer<typeof rsvpSchema>;

// Admin: criar/editar invite_links.
export const inviteCreateSchema = z.object({
  label: z.string().trim().max(120).optional(),
  max_uses: z.number().int().min(1).max(1000),
  expires_at: z.string().datetime().optional(),
});
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const inviteArchiveSchema = z.object({
  archived: z.boolean(),
});
