"use client";

import { useEffect, useRef } from "react";
import { useQueueStore, type QueueJob } from "@/lib/queue-store";
import { getHistoryAudioUrl } from "@/lib/idb";
import { toast } from "sonner";

/**
 * Drives the client-side queue:
 *   - resets stale "processing" jobs from a previous tab close on mount
 *   - kicks `processNext()` whenever the jobs list changes and there's a
 *     pending job with nothing in flight
 *   - fires Sonner toast + Browser Notification on completion / failure
 */
export function QueueProvider() {
  const jobs = useQueueStore((s) => s.jobs);
  const processing = useQueueStore((s) => s.processing);
  const processNext = useQueueStore((s) => s.processNext);
  const resetStaleProcessing = useQueueStore((s) => s.resetStaleProcessing);
  const prevJobsRef = useRef<QueueJob[]>([]);

  // Mount-only setup: reset stale + ask for notification permission
  useEffect(() => {
    resetStaleProcessing();
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, [resetStaleProcessing]);

  // Whenever jobs change, try to start the next one (the store guards against double-start)
  useEffect(() => {
    if (processing) return;
    const hasPending = jobs.some((j) => j.status === "pending");
    if (hasPending) {
      processNext();
    }
  }, [jobs, processing, processNext]);

  // Detect transitions and fire notifications
  useEffect(() => {
    const prev = prevJobsRef.current;

    for (const job of jobs) {
      const before = prev.find((j) => j.id === job.id);
      if (!before) continue;

      if (before.status !== "completed" && job.status === "completed") {
        // Toast with download action backed by IndexedDB blob
        toast.success("Audio ready", {
          description: `"${job.text.slice(0, 60)}${job.text.length > 60 ? "..." : ""}"`,
          duration: 10000,
          action: job.history_id
            ? {
                label: "Download",
                onClick: async () => {
                  const url = await getHistoryAudioUrl(job.history_id!);
                  if (!url) return;
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `fish-speech-${job.id.slice(0, 8)}.${job.format}`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                },
              }
            : undefined,
        });

        // Browser notification if tab is hidden
        if (
          typeof document !== "undefined" &&
          document.hidden &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Audio Ready!", {
              body: `"${job.text.slice(0, 80)}${job.text.length > 80 ? "..." : ""}" is ready to play`,
              icon: "/favicon.ico",
            });
          } catch {}
        }
      }

      if (before.status !== "failed" && job.status === "failed") {
        toast.error("Generation failed", {
          description: job.error || "Unknown error",
          duration: 8000,
        });
      }
    }

    prevJobsRef.current = jobs;
  }, [jobs]);

  return null;
}
