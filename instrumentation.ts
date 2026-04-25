// Next.js instrumentation hook — corre uma vez antes da app, em cada runtime.
// Carrega o config Sentry adequado conforme NEXT_RUNTIME.
//
// Sem DSN definida, o init é no-op e o overhead é mínimo.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
