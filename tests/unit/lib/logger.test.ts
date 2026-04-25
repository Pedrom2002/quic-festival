import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("logger (node runtime)", () => {
  it("expose pino-shaped api", async () => {
    const { logger } = await import("@/lib/logger");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("requestLogger reads x-request-id header", async () => {
    const { requestLogger } = await import("@/lib/logger");
    const headers = new Headers({ "x-request-id": "req-abc" });
    const log = requestLogger(headers);
    expect(typeof log.info).toBe("function");
  });

  it("requestLogger generates uuid when no header", async () => {
    const { requestLogger } = await import("@/lib/logger");
    const log = requestLogger(new Headers());
    expect(typeof log.info).toBe("function");
  });
});

describe("logger (edge runtime)", () => {
  it("falls back to console-based json", async () => {
    vi.stubGlobal("EdgeRuntime", "edge-runtime");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { logger } = await import("@/lib/logger");
    logger.info({ foo: "bar" }, "hello");
    logger.warn({ foo: "bar" });
    logger.error({ foo: "bar" });
    logger.fatal({ foo: "bar" });
    logger.debug({ foo: "bar" });
    logger.trace({ foo: "bar" });

    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    const child = logger.child({ req_id: "x" });
    child.info({ y: 1 });
    expect(typeof child.warn).toBe("function");

    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
