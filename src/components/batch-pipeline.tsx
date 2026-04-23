"use client";

/**
 * n8n-style pipeline visualization for multi-voice batch generation.
 *
 * When the user submits a script through Identify Characters → Generate
 * Multi-Voice Audio, we queue N segments sharing a `batch_id`. This
 * component finds the active (or most recently finished) batch in the queue
 * and renders it as a vertical flow of nodes connected by short lines, with
 * a final "Merge" node at the bottom that becomes interactive (with a
 * Download button) once all segments are complete and the queue provider
 * has concatenated them.
 */

import { useEffect, useMemo, useState } from "react";
import { useQueueStore, type QueueJob } from "@/lib/queue-store";
import { getHistoryAudioUrl } from "@/lib/idb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Play,
  Pause,
  X,
  Waypoints,
  GitMerge,
} from "lucide-react";
import { toast } from "sonner";

interface BatchView {
  id: string;
  jobs: QueueJob[];
  size: number;
  completedCount: number;
  failedCount: number;
  processingCount: number;
  pendingCount: number;
  mergedHistoryId: string | null;
  mergedAt: string | null;
  /** Max created_at so we can sort by recency */
  lastTouched: number;
}

function pickBatch(
  jobs: QueueJob[],
  batchResults: Record<
    string,
    { mergedHistoryId: string; completedAt: string; segmentCount: number }
  >
): BatchView | null {
  const grouped = new Map<string, QueueJob[]>();
  for (const j of jobs) {
    if (!j.batch_id) continue;
    const arr = grouped.get(j.batch_id) || [];
    arr.push(j);
    grouped.set(j.batch_id, arr);
  }
  if (grouped.size === 0) return null;

  const batches: BatchView[] = [];
  for (const [id, batchJobs] of grouped) {
    const sorted = batchJobs
      .slice()
      .sort((a, b) => (a.batch_order ?? 0) - (b.batch_order ?? 0));
    const size = batchJobs[0]?.batch_size || batchJobs.length;
    const completedCount = batchJobs.filter((j) => j.status === "completed").length;
    const failedCount = batchJobs.filter((j) => j.status === "failed").length;
    const processingCount = batchJobs.filter((j) => j.status === "processing").length;
    const pendingCount = batchJobs.filter((j) => j.status === "pending").length;
    const result = batchResults[id];
    const lastTouched = Math.max(
      ...batchJobs.map((j) =>
        Math.max(
          new Date(j.created_at).getTime(),
          j.completed_at ? new Date(j.completed_at).getTime() : 0,
          j.started_at ? new Date(j.started_at).getTime() : 0
        )
      )
    );
    batches.push({
      id,
      jobs: sorted,
      size,
      completedCount,
      failedCount,
      processingCount,
      pendingCount,
      mergedHistoryId: result?.mergedHistoryId ?? null,
      mergedAt: result?.completedAt ?? null,
      lastTouched,
    });
  }

  // Active batches (anything not finished) sort to top, then by recency
  batches.sort((a, b) => {
    const aActive = a.processingCount > 0 || a.pendingCount > 0 ? 1 : 0;
    const bActive = b.processingCount > 0 || b.pendingCount > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.lastTouched - a.lastTouched;
  });

  return batches[0];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Color a character consistently based on its name
function characterColorClass(name: string): string {
  const palette = [
    "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    "bg-rose-500/15 text-rose-400 border-rose-500/30",
    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    "bg-pink-500/15 text-pink-400 border-pink-500/30",
    "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function ElapsedSince({ iso }: { iso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return <>{mins}:{s.toString().padStart(2, "0")}</>;
}

function SegmentNode({
  job,
  index,
  isLast,
}: {
  job: QueueJob;
  index: number;
  isLast: boolean;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Lazy-load the audio URL from IDB when the segment is completed
  useEffect(() => {
    if (job.status !== "completed" || !job.history_id) return;
    let cancelled = false;
    let created: string | null = null;
    getHistoryAudioUrl(job.history_id).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      created = url;
      setAudioUrl(url);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setAudioUrl(null);
    };
  }, [job.status, job.history_id]);

  const handlePlayToggle = () => {
    if (!audioUrl) return;
    const el = document.getElementById(
      `batch-seg-audio-${job.id}`
    ) as HTMLAudioElement | null;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      // Pause any other segments first
      document
        .querySelectorAll<HTMLAudioElement>("audio[data-batch-seg]")
        .forEach((a) => {
          if (a !== el) a.pause();
        });
      el.play().catch(() => {});
    }
  };

  const charClass = characterColorClass(job.character || job.voice_name || "?");

  // Determine border + background per status
  let statusBorder = "border-border";
  let statusBg = "bg-card";
  if (job.status === "processing") {
    statusBorder = "border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]";
    statusBg = "bg-blue-500/5";
  } else if (job.status === "completed") {
    statusBorder = "border-green-500/40";
    statusBg = "bg-green-500/5";
  } else if (job.status === "failed") {
    statusBorder = "border-destructive/60";
    statusBg = "bg-destructive/5";
  }

  return (
    <div className="relative flex flex-col items-stretch">
      <div
        className={`relative flex items-start gap-3 p-3 rounded-lg border ${statusBorder} ${statusBg} transition-all`}
      >
        {/* Step number + status */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${charClass} text-[11px] font-semibold`}
            title={job.character || "Segment"}
          >
            {initials(job.character || `#${index + 1}`)}
          </div>
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {index + 1}/{job.batch_size ?? "?"}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {job.character || "Narrator"}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-normal">
              {job.voice_name}
            </Badge>
            {job.status === "processing" && job.started_at && (
              <span className="text-[10px] text-blue-400 tabular-nums">
                <ElapsedSince iso={job.started_at} /> elapsed
              </span>
            )}
            {job.status === "failed" && job.error && (
              <span className="text-[10px] text-destructive truncate max-w-[160px]">
                {job.error}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
            {job.text}
          </p>

          {job.status === "completed" && audioUrl && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePlayToggle}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <Pause className="h-3 w-3" fill="currentColor" />
                ) : (
                  <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
                )}
              </button>
              <audio
                id={`batch-seg-audio-${job.id}`}
                data-batch-seg=""
                src={audioUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
              <span className="text-[10px] text-muted-foreground">
                segment ready
              </span>
            </div>
          )}
        </div>

        {/* Status icon on the right */}
        <div className="shrink-0 mt-0.5">
          {job.status === "pending" && (
            <Clock className="h-4 w-4 text-muted-foreground/60" />
          )}
          {job.status === "processing" && (
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
          )}
          {job.status === "completed" && (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          )}
          {job.status === "failed" && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      {/* Connector to next node */}
      {!isLast && (
        <div className="flex flex-col items-center py-1">
          <div
            className={`w-0.5 h-4 ${
              job.status === "completed"
                ? "bg-green-500/60"
                : job.status === "processing"
                  ? "bg-blue-500/60"
                  : "bg-border"
            }`}
          />
        </div>
      )}
    </div>
  );
}

function MergeNode({ batch }: { batch: BatchView }) {
  const allDone = batch.completedCount === batch.size && batch.failedCount === 0;
  const hasMerged = !!batch.mergedHistoryId;
  const hasFailure = batch.failedCount > 0;
  const waiting = !allDone && !hasFailure;

  const handleDownload = async () => {
    if (!batch.mergedHistoryId) return;
    const url = await getHistoryAudioUrl(batch.mergedHistoryId);
    if (!url) {
      toast.error("Merged audio file not found");
      return;
    }
    // Prefer the story title captured when the batch was queued
    const title = batch.jobs[0]?.batch_title?.trim();
    const fileName = title ? `${title}.wav` : `fish-speech-multi-${batch.id.slice(0, 8)}.wav`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  let borderClass = "border-border";
  let bgClass = "bg-card";
  if (hasMerged) {
    borderClass = "border-green-500/60 shadow-[0_0_0_1px_rgba(34,197,94,0.3)]";
    bgClass = "bg-green-500/10";
  } else if (hasFailure) {
    borderClass = "border-destructive/60";
    bgClass = "bg-destructive/5";
  } else if (allDone) {
    borderClass = "border-blue-500/60";
    bgClass = "bg-blue-500/10";
  }

  return (
    <div className={`relative flex items-center gap-4 p-4 rounded-xl border-2 ${borderClass} ${bgClass} transition-all`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/50 border border-border">
        <GitMerge className="h-5 w-5 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Merge & Combine
          </span>
          {hasMerged && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400 border-green-500/40">
              Ready
            </Badge>
          )}
          {!hasMerged && allDone && !hasFailure && (
            <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/40">
              Merging…
            </Badge>
          )}
          {hasFailure && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0"
            >
              Blocked
            </Badge>
          )}
          {waiting && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Waiting
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {hasMerged
            ? `All ${batch.size} segments combined into one file`
            : hasFailure
              ? `${batch.failedCount} segment${batch.failedCount === 1 ? "" : "s"} failed — fix or retry to enable merge`
              : allDone
                ? "All segments generated — combining audio now…"
                : `${batch.completedCount}/${batch.size} segments complete`}
        </p>
      </div>
      {hasMerged && (
        <Button onClick={handleDownload} size="sm" className="shrink-0 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      )}
      {!hasMerged && allDone && !hasFailure && (
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
      )}
    </div>
  );
}

export function BatchPipeline() {
  const jobs = useQueueStore((s) => s.jobs);
  const batchResults = useQueueStore((s) => s.batchResults);
  const clearBatch = useQueueStore((s) => s.clearBatch);

  const batch = useMemo(() => pickBatch(jobs, batchResults), [jobs, batchResults]);

  if (!batch) return null;

  const progressPercent = Math.round(
    ((batch.completedCount + batch.failedCount) / batch.size) * 100
  );

  return (
    <div className="mt-5 mb-4 rounded-xl border border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Waypoints className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Multi-Voice Pipeline
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 tabular-nums">
              {batch.completedCount}/{batch.size}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {batch.pendingCount > 0 || batch.processingCount > 0
              ? `${batch.processingCount > 0 ? "Generating" : "Queued"} · ${batch.pendingCount} waiting`
              : batch.mergedHistoryId
                ? "Complete — download the merged audio below"
                : batch.failedCount > 0
                  ? `${batch.failedCount} failed`
                  : "All segments ready — merging…"}
          </p>
        </div>
        {batch.mergedHistoryId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => clearBatch(batch.id)}
            title="Clear pipeline"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className={`h-full transition-[width] duration-300 ${
            batch.mergedHistoryId
              ? "bg-green-500"
              : batch.failedCount > 0
                ? "bg-destructive"
                : "bg-blue-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Node list (scrollable if long) */}
      <div className="p-4 space-y-0 max-h-[50vh] overflow-y-auto">
        {batch.jobs.map((job, i) => (
          <SegmentNode
            key={job.id}
            job={job}
            index={i}
            isLast={i === batch.jobs.length - 1}
          />
        ))}

        {/* Connector from the last segment to the merge node */}
        <div className="flex flex-col items-center py-1">
          <div
            className={`w-0.5 h-4 ${
              batch.completedCount === batch.size && batch.failedCount === 0
                ? "bg-green-500/60"
                : "bg-border"
            }`}
          />
        </div>

        {/* Merge node */}
        <MergeNode batch={batch} />
      </div>
    </div>
  );
}
