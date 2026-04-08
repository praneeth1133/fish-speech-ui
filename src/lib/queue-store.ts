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

export interface QueueJob {
  id: string;
  text: string;
  voice_id: string | null;
  voice_name: string;
  format: string;
  /** JSON-stringified params used to recreate the request on retry */
  settings: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  /** id of the persisted history item once completed */
  history_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AddJobParams {
  text: string;
  voice_id?: string;
  voice_name?: string;
  format?: string;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
  max_new_tokens?: number;
  chunk_length?: number;
  seed?: number;
  normalize?: boolean;
}

interface QueueState {
  jobs: QueueJob[];
  /** True while a fetch to /api/tts is in flight. Single-job-at-a-time. */
  processing: boolean;
  /** Bumped after each job change so consumers can react. */
  version: number;

  addJob: (params: AddJobParams) => QueueJob;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  retryJob: (id: string) => void;
  /** Process the next pending job, if nothing else is in flight. */
  processNext: () => Promise<void>;
  /** Reset any "processing" jobs left over from a previous tab close. */
  resetStaleProcessing: () => void;
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
          settings: JSON.stringify(settings),
          status: "pending",
          error: null,
          history_id: null,
          created_at: nowIso(),
          started_at: null,
          completed_at: null,
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
        set((s) => {
          const hadStale = s.jobs.some((j) => j.status === "processing");
          if (!hadStale) return s;
          return {
            ...s,
            jobs: s.jobs.map((j) =>
              j.status === "processing"
                ? { ...j, status: "pending", started_at: null }
                : j
            ),
            version: s.version + 1,
          };
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
          const body: Record<string, unknown> = {
            text: next.text,
            format: next.format,
            ...settings,
          };
          if (next.voice_id) {
            body.reference_id = next.voice_id;
          }

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            let errorMessage = `HTTP ${res.status}`;
            try {
              const errBody = await res.json();
              if (errBody?.error) errorMessage = errBody.error;
            } catch {
              const text = await res.text().catch(() => "");
              if (text) errorMessage = text;
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
      partialize: (state) => ({ jobs: state.jobs }),
    }
  )
);
