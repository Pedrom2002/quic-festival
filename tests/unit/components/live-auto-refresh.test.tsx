import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import LiveAutoRefresh from "@/components/admin/live-auto-refresh";

describe("LiveAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("chama router.refresh no intervalo configurado", () => {
    render(<LiveAutoRefresh intervalMs={1000} />);
    expect(refreshMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it("pausa quando document.visibilityState=hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    render(<LiveAutoRefresh intervalMs={500} />);
    vi.advanceTimersByTime(500);
    expect(refreshMock).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("limpa interval ao desmontar", () => {
    const { unmount } = render(<LiveAutoRefresh intervalMs={500} />);
    unmount();
    vi.advanceTimersByTime(2000);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
