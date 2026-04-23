"use client";

import { useEffect, useRef } from "react";
import { useQueueStore, type QueueJob } from "@/lib/queue-store";
import {
  addHistoryItem,
  getHistoryAudioUrl,
  getHistoryItem,
} from "@/lib/idb";
import { concatAudioBlobs } from "@/lib/wav-concat";
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
  /** Track batch_ids that have already been concatenated to avoid re-doing work */
  const concatenatedBatchesRef = useRef<Set<string>>(new Set());

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

  // Watch for batches that have just finished (all jobs completed) and
  // concatenate their audio into a single history entry.
  useEffect(() => {
    // Group jobs by batch_id
    const batches = new Map<string, QueueJob[]>();
    for (const job of jobs) {
      if (!job.batch_id) continue;
      const list = batches.get(job.batch_id) || [];
      list.push(job);
      batches.set(job.batch_id, list);
    }

    for (const [batchId, batchJobs] of batches) {
      if (concatenatedBatchesRef.current.has(batchId)) continue;

      const size = batchJobs[0]?.batch_size || batchJobs.length;
      const allDone =
        batchJobs.length === size &&
        batchJobs.every((j) => j.status === "completed" && j.history_id);

      if (!allDone) continue;

      // Mark as in-progress immediately so concurrent renders don't double-run
      concatenatedBatchesRef.current.add(batchId);

      // Sort by batch_order
      const ordered = [...batchJobs].sort(
        (a, b) => (a.batch_order ?? 0) - (b.batch_order ?? 0)
      );

      (async () => {
        try {
          // Load each segment's blob from IDB
          const blobs: Blob[] = [];
          for (const j of ordered) {
            if (!j.history_id) continue;
            const item = await getHistoryItem(j.history_id);
            if (item?.blob) blobs.push(item.blob);
          }
          if (blobs.length === 0) return;

          // Respect the per-batch normalize flag so users can opt out of
          // automatic level-matching if they want raw per-character audio.
          const normalize = ordered[0]?.batch_normalize ?? true;
          const combined = await concatAudioBlobs(blobs, {
            gapSeconds: 0.35,
            normalizeVolume: normalize,
          });

          // Build a human-readable preview text
          const combinedText = ordered
            .map((j) => `${j.character ? j.character + ": " : ""}${j.text}`)
            .join("\n");

          // Prefer the title baked in by generateMultiVoice; fall back to the
          // batch id if some old job is missing it.
          const storyTitle = ordered[0]?.batch_title?.trim()
            || `multi-voice-${batchId.slice(0, 8)}`;

          const newId = crypto.randomUUID();
          await addHistoryItem({
            id: newId,
            text: combinedText.slice(0, 500),
            voice_id: null,
            voice_name: storyTitle,
            format: "wav",
            settings: null,
            created_at: new Date().toISOString(),
            blob: combined,
          });

          // Record the merged history id so the pipeline view can offer download
          useQueueStore.getState().setBatchResult(batchId, {
            mergedHistoryId: newId,
            completedAt: new Date().toISOString(),
            segmentCount: ordered.length,
          });

          toast.success("Multi-voice audio ready", {
            description: `${ordered.length} segments combined into one file`,
            duration: 12000,
            action: {
              label: "Download",
              onClick: async () => {
                const url = await getHistoryAudioUrl(newId);
                if (!url) return;
                const a = document.createElement("a");
                a.href = url;
                a.download = `${storyTitle}.wav`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              },
            },
          });
        } catch (err) {
          console.error("Batch concat failed:", err);
          toast.error("Failed to combine multi-voice audio", {
            description:
              err instanceof Error ? err.message : "Unknown error",
          });
          // Allow a future retry by removing from the seen set
          concatenatedBatchesRef.current.delete(batchId);
        }
      })();
    }
  }, [jobs]);

  return null;
}
