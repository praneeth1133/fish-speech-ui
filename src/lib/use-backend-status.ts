"use client";

/**
 * Shared hook for the "Server Status" indicator.
 *
 * Polls `/api/health` on an interval and returns a tri-state value so the UI
 * can render the right color: green (connected), red (disconnected), or grey
 * (first load, still checking). The hook re-checks when the tab regains
 * focus so leaving and returning to the app gives an immediate fresh read.
 */

import { useEffect, useState, useRef } from "react";

export type BackendStatus = "checking" | "connected" | "disconnected";

interface UseBackendStatusOptions {
  /** Poll interval in milliseconds. Defaults to 20 seconds. */
  intervalMs?: number;
}

export function useBackendStatus(
  options: UseBackendStatusOptions = {}
): BackendStatus {
  const { intervalMs = 20_000 } = options;
  const [status, setStatus] = useState<BackendStatus>("checking");
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          // 6s client-side timeout — the route itself uses 5s
          signal: AbortSignal.timeout(8_000),
        });
        if (cancelled || !mountedRef.current) return;
        if (!res.ok) {
          setStatus("disconnected");
          return;
        }
        const data = (await res.json().catch(() => null)) as
          | { status?: string }
          | null;
        if (cancelled || !mountedRef.current) return;
        setStatus(data?.status === "connected" ? "connected" : "disconnected");
      } catch {
        if (cancelled || !mountedRef.current) return;
        setStatus("disconnected");
      }
    };

    check();
    const interval = setInterval(check, intervalMs);

    // Re-check when the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return status;
}
