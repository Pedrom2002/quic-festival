import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditAction =
  | "admin.signin.password.ok"
  | "admin.signin.password.fail"
  | "admin.signin.otp.sent"
  | "admin.signin.otp.fail"
  | "admin.signout"
  | "admin.checkin.ok"
  | "admin.checkin.duplicate"
  | "admin.checkin.not_found"
  | "admin.checkin.uncheck"
  | "admin.resend_email.ok"
  | "admin.resend_email.fail"
  | "admin.export"
  | "admin.password.changed"
  | "admin.guest.deleted"
  | "admin.invite.created"
  | "admin.invite.archived"
  | "admin.invite.unarchived";

export async function audit(args: {
  action: AuditAction;
  actorEmail?: string | null;
  targetId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = supabaseAdmin();
    await admin.from("audit_log").insert({
      action: args.action,
      actor_email: args.actorEmail ?? null,
      target_id: args.targetId ?? null,
      ip: args.ip ?? null,
      meta: args.meta ?? null,
    });
  } catch (e) {
    // Audit nunca deve quebrar o request principal.
    console.warn("[audit]", args.action, e instanceof Error ? e.message : e);
  }
}

export function ipFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}
