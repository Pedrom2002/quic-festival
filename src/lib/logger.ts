// Structured logger with two backends:
//   - Node runtime (`runtime = "nodejs"`): pino, JSON in prod / pretty in dev.
//   - Edge runtime (`runtime = "edge"`): tiny console-based JSON, no pino dep.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info({ event: "rsvp.received", email_hash }, "RSVP submitted");
//
// Request-scoped logger: pass an `x-request-id` header through middleware,
// then create a child logger inside the route:
//   const log = logger.child({ req_id: req.headers.get("x-request-id") });
//
// Sentry: when SENTRY_DSN is set the server-side @sentry/nextjs SDK already
// captures `error`-level logs via its native Pino integration. No extra
// wiring required here.

type LogContext = Record<string, unknown>;

interface MinimalLogger {
  trace(ctx: LogContext, msg?: string): void;
  debug(ctx: LogContext, msg?: string): void;
  info(ctx: LogContext, msg?: string): void;
  warn(ctx: LogContext, msg?: string): void;
  error(ctx: LogContext, msg?: string): void;
  fatal(ctx: LogContext, msg?: string): void;
  child(bindings: LogContext): MinimalLogger;
}

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");

// Edge runtime detection: `EdgeRuntime` global is defined by Next on Edge.
// In test/Node runtime it's undefined. We pin pino to nodejs callers only.
const isEdge =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";

function buildEdgeLogger(bindings: LogContext = {}): MinimalLogger {
  const emit = (lvl: string, ctx: LogContext, msg?: string) => {
    const line = JSON.stringify({
      level: lvl,
      time: Date.now(),
      ...bindings,
      ...ctx,
      ...(msg ? { msg } : {}),
    });
    if (lvl === "error" || lvl === "fatal") console.error(line);
    else if (lvl === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    trace: (c, m) => emit("trace", c, m),
    debug: (c, m) => emit("debug", c, m),
    info: (c, m) => emit("info", c, m),
    warn: (c, m) => emit("warn", c, m),
    error: (c, m) => emit("error", c, m),
    fatal: (c, m) => emit("fatal", c, m),
    child: (b) => buildEdgeLogger({ ...bindings, ...b }),
  };
}

function buildNodeLogger(): MinimalLogger {
  // Lazy import so the Edge bundle never pulls pino.
  /* v8 ignore next 3 */
  if (isEdge) {
    return buildEdgeLogger();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pino = require("pino");
  const transport = !isProd
    ? { target: "pino-pretty", options: { colorize: true, singleLine: true } }
    : undefined;
  return pino({
    level,
    base: { app: "quic-festival" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
        "*.captchaToken",
        "*.email", // hash externamente quando precisar de log linkable
      ],
      remove: true,
    },
    transport,
  });
}

export const logger: MinimalLogger = isEdge ? buildEdgeLogger() : buildNodeLogger();

export function requestLogger(headers: Headers): MinimalLogger {
  const id = headers.get("x-request-id") ?? crypto.randomUUID();
  return logger.child({ req_id: id });
}
