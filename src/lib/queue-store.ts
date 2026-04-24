/**
 * Browser-only TTS queue.
 *
 * The old version polled a SQLite-backed `/api/queue` endpoint every 3s. With
 * Vercel deployment we can't run a stateful queue server-side, so the queue
 * lives entirely in the browser:
 *   - state persisted to localStorage via Zustand `persist` middleware
 *   - audio blobs (large) live in IndexedDB via lib/idb.ts, NOT in localStorage
 *   - one job processed at a time via `processNext()`, kicked off by
 *     queue-provider.tsx whenever the store updates
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addHistoryItem } from "@/lib/idb";

/**
 * Which TTS engine to route this job through.
 * - "fish-speech": /api/tts (Fish Speech S2 Pro, multilingual)
 * - "indic-parler": /api/v1/telugu/tts (Indic Parler-TTS, Telugu-only)
 * Kept in sync with EngineId in tts-settings-store but declared here so the
 * queue has no dependency on the settings store.
 */
export type JobEngine = "fish-speech" | "indic-parler";

export interface QueueJob {
  id: string;
  text: string;
  voice_id: string | null;
  voice_name: string;
  format: string;
  /** Engine the job runs on. Defaults to "fish-speech" for back-compat with
   * jobs persisted before this field existed. */
  engine: JobEngine;
  /** JSON-stringified params used to recreate the request on retry */
  settings: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  /** id of the persisted history item once completed */
  history_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** Optional batch id for multi-voice scripts. All segments of the same script
   * share the same batch_id so the UI can group them and auto-concat when done. */
  batch_id: string | null;
  /** Position of this job within its batch (0-indexed). Null when not in a batch. */
  batch_order: number | null;
  /** Total number of jobs in the batch. Null when not in a batch. */
  batch_size: number | null;
  /** Character label for this segment (e.g., "Alice", "Narrator"). */
  character: string | null;
  /** Optional story title — derived from the first few words of the script.
   * Used as the default download filename for the merged audio. */
  batch_title: string | null;
  /** When true, merged audio applies RMS normalization across segments so
   * characters speak at comparable loudness. */
  batch_normalize: boolean;
}

export interface AddJobParams {
  text: string;
  voice_id?: string;
  voice_name?: string;
  format?: string;
  /** Engine to run this job on. Defaults to "fish-speech". */
  engine?: JobEngine;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
  max_new_tokens?: number;
  chunk_length?: number;
  seed?: number;
  normalize?: boolean;
  batch_id?: string;
  batch_order?: number;
  batch_size?: number;
  character?: string;
  batch_title?: string;
  batch_normalize?: boolean;
}

export interface BatchResult {
  /** IndexedDB history id of the merged WAV */
  mergedHistoryId: string;
  /** ISO timestamp when the merge completed */
  completedAt: string;
  /** Number of segments that were merged */
  segmentCount: number;
}

interface QueueState {
  jobs: QueueJob[];
  /** True while a fetch to /api/tts is in flight. Single-job-at-a-time. */
  processing: boolean;
  /** Bumped after each job change so consumers can react. */
  version: number;
  /** Merged-audio result per batch_id. Populated by queue-provider after concat. */
  batchResults: Record<string, BatchResult>;

  addJob: (params: AddJobParams) => QueueJob;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  retryJob: (id: string) => void;
  /** Process the next pending job, if nothing else is in flight. */
  processNext: () => Promise<void>;
  /** Reset any "processing" jobs left over from a previous tab close. */
  resetStaleProcessing: () => void;
  /** Record a batch's merged history id so the pipeline view can show Download */
  setBatchResult: (batchId: string, result: BatchResult) => void;
  /** Drop a batch and all of its jobs from the queue */
  clearBatch: (batchId: string) => void;
}

function genId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      jobs: [],
      processing: false,
      version: 0,
      batchResults: {},

      setBatchResult: (batchId, result) => {
        set((s) => ({
          batchResults: { ...s.batchResults, [batchId]: result },
          version: s.version + 1,
        }));
      },

      clearBatch: (batchId) => {
        set((s) => {
          const { [batchId]: _dropped, ...restResults } = s.batchResults;
          void _dropped;
          return {
            jobs: s.jobs.filter((j) => j.batch_id !== batchId),
            batchResults: restResults,
            version: s.version + 1,
          };
        });
      },

      addJob: (params) => {
        const settings = {
          temperature: params.temperature,
          top_p: params.top_p,
          repetition_penalty: params.repetition_penalty,
          max_new_tokens: params.max_new_tokens,
          chunk_length: params.chunk_length,
          seed: params.seed,
          normalize: params.normalize,
        };
        const job: QueueJob = {
          id: genId(),
          text: params.text,
          voice_id: params.voice_id || null,
          voice_name: params.voice_name || "Default",
          format: params.format || "wav",
          engine: params.engine || "fish-speech",
          settings: JSON.stringify(settings),
          status: "pending",
          error: null,
          history_id: null,
          created_at: nowIso(),
          started_at: null,
          completed_at: null,
          batch_id: params.batch_id || null,
          batch_order: params.batch_order ?? null,
          batch_size: params.batch_size ?? null,
          character: params.character || null,
          batch_title: params.batch_title || null,
          batch_normalize: params.batch_normalize ?? true,
        };
        set((s) => ({ jobs: [...s.jobs, job], version: s.version + 1 }));
        return job;
      },

      removeJob: (id) => {
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
          version: s.version + 1,
        }));
      },

      clearCompleted: () => {
        set((s) => ({
          jobs: s.jobs.filter((j) => j.status !== "completed" && j.status !== "failed"),
          version: s.version + 1,
        }));
      },

      retryJob: (id) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: "pending",
                  error: null,
                  started_at: null,
                  completed_at: null,
                  history_id: null,
                }
              : j
          ),
          version: s.version + 1,
        }));
      },

      resetStaleProcessing: () => {
        // On mount: reconcile the persisted queue state with reality.
        // - Jobs stuck in "processing" from a closed tab → reset to "pending"
        //   so they resume, IF they're still recent (< 30 min).
        // - Very old pending/processing jobs are PURGED from the queue
        //   entirely. They'd otherwise try to re-hit the backend with stale
        //   settings and produce a "fetch failed" toast the user can't stop.
        const STALE_MS = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        set((s) => {
          let changed = false;
          const jobs: QueueJob[] = [];
          for (const j of s.jobs) {
            const createdMs = Date.parse(j.created_at);
            const isOld = isFinite(createdMs) && now - createdMs > STALE_MS;
            if (isOld && (j.status === "pending" || j.status === "processing")) {
              // Drop stale in-flight jobs so they don't auto-resume
              changed = true;
              continue;
            }
            if (j.status === "processing") {
              changed = true;
              jobs.push({ ...j, status: "pending", started_at: null });
            } else {
              jobs.push(j);
            }
          }
          if (!changed) return s;
          return { ...s, jobs, version: s.version + 1 };
        });
      },

      processNext: async () => {
        if (get().processing) return;
        const next = get().jobs.find((j) => j.status === "pending");
        if (!next) return;

        // Mark in-flight + processing
        set((s) => ({
          processing: true,
          jobs: s.jobs.map((j) =>
            j.id === next.id
              ? { ...j, status: "processing", started_at: nowIso() }
              : j
          ),
          version: s.version + 1,
        }));

        try {
          const settings = next.settings ? JSON.parse(next.settings) : {};
          const jobEngine: JobEngine = next.engine || "fish-speech";

          // Pick the right proxy endpoint + body shape per engine. The Telugu
          // API expects `voice` (not `reference_id`) and restricts output
          // format to wav/mp3.
          let endpoint = "/api/tts";
          let body: Record<string, unknown>;
          if (jobEngine === "indic-parler") {
            endpoint = "/api/v1/telugu/tts";
            body = {
              text: next.text,
              format: next.format === "opus" ? "wav" : next.format,
              voice: next.voice_id || undefined,
              temperature: settings.temperature,
              top_p: settings.top_p,
              max_new_tokens: settings.max_new_tokens,
              chunk_length: settings.chunk_length,
            };
          } else {
            body = {
              text: next.text,
              format: next.format,
              ...settings,
            };
            if (next.voice_id) body.reference_id = next.voice_id;
          }

          // Per-job timeout — if the backend tunnel is hung we'd rather see a
          // clear "TTS generation timed out" in the queue row than a request
          // that blocks forever. Matches the /api/tts route's own Vercel
          // maxDuration (300 s via Fluid Compute) + a small buffer so we
          // never abort earlier than the server would.
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 310_000);
          let res: Response;
          try {
            res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
          } catch (fetchErr) {
            clearTimeout(timer);
            if ((fetchErr as Error)?.name === "AbortError") {
              throw new Error(
                "TTS generation timed out after 5 minutes — the backend is likely offline or overloaded. Check /api/health and restart your local Fish Speech server if needed."
              );
            }
            throw new Error(
              `Could not reach ${endpoint}: ${
                fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
              }`
            );
          }
          clearTimeout(timer);

          if (!res.ok) {
            let errorMessage = `HTTP ${res.status}`;
            try {
              const errBody = await res.json();
              if (errBody?.error) errorMessage = errBody.error;
            } catch {
              const text = await res.text().catch(() => "");
              // Don't dump raw HTML error pages into the queue UI — they
              // usually mean the proxy layer (ngrok, Vercel) intercepted the
              // request, not our app. Show a cleaner message instead.
              if (text) {
                const looksHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(text);
                errorMessage = looksHtml
                  ? `Backend returned an HTML error page (HTTP ${res.status}). The tunnel or proxy likely timed out or rejected the request.`
                  : text.length > 200
                    ? text.slice(0, 200).trim() + "…"
                    : text;
              }
            }
            throw new Error(errorMessage);
          }

          const blob = await res.blob();
          if (blob.size === 0) {
            throw new Error("Empty audio response from backend");
          }

          // Persist to IndexedDB
          const historyItem = await addHistoryItem({
            id: genId(),
            text: next.text,
            voice_id: next.voice_id,
            voice_name: next.voice_name,
            format: next.format,
            settings: next.settings,
            created_at: nowIso(),
            blob,
          });

          set((s) => ({
            processing: false,
            jobs: s.jobs.map((j) =>
              j.id === next.id
                ? {
                    ...j,
                    status: "completed",
                    history_id: historyItem.id,
                    completed_at: nowIso(),
                  }
                : j
            ),
            version: s.version + 1,
          }));
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error during generation";
          set((s) => ({
            processing: false,
            jobs: s.jobs.map((j) =>
              j.id === next.id
                ? {
                    ...j,
                    status: "failed",
                    error: message,
                    completed_at: nowIso(),
                  }
                : j
            ),
            version: s.version + 1,
          }));
        }
      },
    }),
    {
      name: "fish-speech-queue",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR — no-op storage
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        jobs: state.jobs,
        batchResults: state.batchResults,
      }),
    }
  )
);
