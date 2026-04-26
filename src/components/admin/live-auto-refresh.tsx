"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the (server) page on a fixed interval. Used in /admin so the
// stats card stays current during the festival without manual reload.
// Pauses when the tab is hidden (browser visibilityState) to avoid burning
// quota on idle tabs.
export default function LiveAutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
