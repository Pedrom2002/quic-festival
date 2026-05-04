// Centralised tunables. Change here, redeploy.
export const LIMITS = {
  rsvp: {
    perIp: { max: 100, windowMs: 60_000 },
    perIpEmail: { max: 20, windowMs: 60_000 },
    perEmailGlobal: { max: 50, windowMs: 60 * 60_000 },
  },
  qr: { perIp: { max: 60, windowMs: 60_000 } },
  ics: { perIp: { max: 30, windowMs: 60_000 } },
  signin: {
    perIp: { max: 5, windowMs: 5 * 60_000 },
    perIpEmail: { max: 5, windowMs: 5 * 60_000 },
    perEmailGlobal: { max: 20, windowMs: 60 * 60_000 },
  },
  otp: { perIp: { max: 3, windowMs: 10 * 60_000 } },
  pwchange: {
    perIpUser: { max: 5, windowMs: 10 * 60_000 },
    perUserGlobal: { max: 10, windowMs: 60 * 60_000 },
  },
  guestDelete: { perIpUser: { max: 5, windowMs: 60 * 60_000 } },
  adminCheckin: { perAdmin: { max: 300, windowMs: 5 * 60_000 } },
  adminResendEmail: { perAdmin: { max: 20, windowMs: 60 * 60_000 } },
  adminExport: { perAdmin: { max: 10, windowMs: 60 * 60_000 } },
  adminGuestExport: { perAdmin: { max: 30, windowMs: 60 * 60_000 } },
} as const;

export const MAX_BODY_BYTES = 64 * 1024;
export const UPSTASH_TIMEOUT_MS = 800;
export const RSVP_OPEN = process.env.RSVP_OPEN !== "false";
