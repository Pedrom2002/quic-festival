import { z } from "zod";

const phonePT = /^(\+351\s?)?9\d{8}$/;

export const rsvpSchema = z
  .object({
    name: z.string().trim().min(2, "Nome demasiado curto").max(120),
    email: z.string().trim().toLowerCase().email("Email inválido"),
    phone: z
      .string()
      .trim()
      .regex(phonePT, "Telefone PT inválido (9XXXXXXXX)"),
    acompanhante: z.enum(["sim", "nao"]),
    companion_nome: z.string().trim().max(120).optional().default(""),
    companion_tel: z.string().trim().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.acompanhante === "sim") {
      if (!data.companion_nome || data.companion_nome.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_nome"],
          message: "Nome do acompanhante obrigatório",
        });
      }
      if (!data.companion_tel || !phonePT.test(data.companion_tel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companion_tel"],
          message: "Telefone do acompanhante inválido",
        });
      }
    }
  });

export type RsvpInput = z.infer<typeof rsvpSchema>;
