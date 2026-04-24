"use client";

import { useQueueStore, type QueueJob } from "@/lib/queue-store";
import { getHistoryAudioUrl } from "@/lib/idb";
import { AudioPlayer } from "./audio-player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  X,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListOrdered,
  Download,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { getVoiceDisplayInfo } from "@/lib/voice-names";
import { makeDownloadName } from "@/lib/download-name";

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Estimate how long generation will take based on text length. The Fish
 * Speech model runs at roughly real-time on a 5060 Ti, and generated audio
 * runs ~15 chars/sec. We add a 5-second base for warmup/overhead and cap at
 * 120s (the longest we've observed under 200 chars). The progress curve
 * never visually reaches 100% until the job actually completes, so users
 * don't stare at a full bar waiting.
 */
function estimatedDurationSeconds(text: string): number {
  const raw = text.length * 0.4 + 5;
  return Math.max(10, Math.min(120, raw));
}

/**
 * Thin progress indicator for a job in the "processing" state. Smoothly
 * ticks once per 250ms so the bar animates even while waiting on a single
 * blocking /api/tts call.
 */
function ProcessingProgress({
  startedAt,
  text,
}: {
  startedAt: string | null;
  text: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed((Date.now() - start) / 1000);
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return null;

  const estimated = estimatedDurationSeconds(text);
  // Cap at 95% so we never claim "done" before the network response arrives
  const progress = Math.min(0.95, elapsed / estimated);
  const percent = Math.floor(progress * 100);
  const remaining = Math.max(0, estimated - elapsed);

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-blue-400 transition-[width] duration-200 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{formatClock(elapsed)} elapsed</span>
        <span>{percent}%</span>
        <span>~{formatClock(remaining)} left</span>
      </div>
    </div>
  );
}

/**
 * For completed jobs, fetch the audio blob from IndexedDB and create an
 * object URL. The URL is revoked when the component unmounts to avoid leaks.
 */
function useAudioObjectUrl(historyId: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!historyId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    getHistoryAudioUrl(historyId).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      createdUrl = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [historyId]);

  return url;
}

function CompletedJobAudio({ job }: { job: QueueJob }) {
  const url = useAudioObjectUrl(job.history_id);
  if (!url) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1">
        <AudioPlayer src={url} compact />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 shrink-0"
        onClick={() => {
          const a = document.createElement("a");
          a.href = url;
          a.download = makeDownloadName(
            job.text,
            job.format,
            job.completed_at || undefined
          );
          a.click();
        }}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}

async function copyJobText(job: QueueJob) {
  try {
    await navigator.clipboard.writeText(job.text);
    toast.success("Text copied to clipboard");
  } catch {
    toast.error("Couldn't copy — browser blocked clipboard access");
  }
}

function JobItem({
  job,
  onRemove,
  onRetry,
}: {
  job: QueueJob;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      {/* Status icon */}
      <div className="mt-0.5">
        {job.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
        {job.status === "processing" && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
        {job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        {job.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm line-clamp-2">
          {job.character && (
            <span className="font-semibold text-primary/80 mr-1">
              {job.character}:
            </span>
          )}
          {job.text}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {job.batch_id && job.batch_size ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Segment {(job.batch_order ?? 0) + 1}/{job.batch_size}
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {getVoiceDisplayInfo(job.voice_name)?.displayName ||
              getVoiceDisplayInfo(job.voice_id || "")?.displayName ||
              job.voice_name}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
            {job.format}
          </Badge>

          {job.status === "failed" && job.error && (
            <span className="text-xs text-destructive truncate max-w-[200px]">
              {job.error}
            </span>
          )}
        </div>

        {job.status === "processing" && (
          <ProcessingProgress startedAt={job.started_at} text={job.text} />
        )}

        {job.status === "completed" && <CompletedJobAudio job={job} />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => copyJobText(job)}
          title="Copy text"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {job.status === "failed" && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRetry}
            title="Retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        {(job.status === "pending" ||
          job.status === "completed" ||
          job.status === "failed") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function QueuePanel() {
  const jobs = useQueueStore((s) => s.jobs);
  const removeJob = useQueueStore((s) => s.removeJob);
  const clearCompleted = useQueueStore((s) => s.clearCompleted);
  const retryJob = useQueueStore((s) => s.retryJob);

  const processingJobs = jobs.filter((j) => j.status === "processing");
  const pendingJobs = jobs.filter((j) => j.status === "pending");
  const completedJobs = jobs.filter((j) => j.status === "completed").slice(0, 5);
  const failedJobs = jobs.filter((j) => j.status === "failed");

  const activeCount = processingJobs.length + pendingJobs.length;
  const hasCompletedOrFailed = completedJobs.length > 0 || failedJobs.length > 0;

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <ListOrdered className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No generations yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Create your first one from the editor
        </p>
      </div>
    );
  }

  const handleRetry = (job: QueueJob) => {
    retryJob(job.id);
    toast.success("Re-queued for generation");
  };

  return (
    <div className="space-y-2 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Queue</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {activeCount} active
            </Badge>
          )}
        </div>
        {hasCompletedOrFailed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              clearCompleted();
              toast.success("Cleared completed jobs");
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Processing */}
      {processingJobs.map((job) => (
        <JobItem key={job.id} job={job} onRemove={() => {}} />
      ))}

      {/* Pending */}
      {pendingJobs.map((job) => (
        <JobItem key={job.id} job={job} onRemove={() => removeJob(job.id)} />
      ))}

      {/* Failed */}
      {failedJobs.map((job) => (
        <JobItem
          key={job.id}
          job={job}
          onRemove={() => removeJob(job.id)}
          onRetry={() => handleRetry(job)}
        />
      ))}

      {/* Completed */}
      {completedJobs.map((job) => (
        <JobItem key={job.id} job={job} onRemove={() => removeJob(job.id)} />
      ))}
    </div>
  );
}
