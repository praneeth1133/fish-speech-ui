"use client";

/**
 * In-browser voice recorder for registering custom voices with Fish Speech.
 *
 * Flow:
 *  1. User picks one of the preset scripts
 *  2. Clicks the big record button → browser prompts for mic permission
 *  3. Reads the script aloud while MediaRecorder captures audio/webm
 *  4. Clicks stop → the webm is decoded via Web Audio API and re-encoded as
 *     mono 16-bit WAV so the Fish Speech backend can always read it
 *  5. User previews playback, optionally re-records
 *  6. When a finished recording + selected script exist, the parent reads the
 *     state via the `onReady` callback and can submit via POST /api/voices
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Square, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RECORDING_SCRIPTS,
  DEFAULT_SCRIPT_ID,
  type RecordingScript,
} from "@/lib/recording-scripts";
import { audioBufferToWav } from "@/lib/wav-encoder";

type Status =
  | "idle"
  | "requesting-mic"
  | "recording"
  | "processing"
  | "ready"
  | "error";

export interface VoiceRecorderState {
  wavBlob: Blob | null;
  referenceText: string;
  durationSeconds: number;
}

interface VoiceRecorderProps {
  /** Fires whenever the recording state changes so the parent can enable/disable submit */
  onChange: (state: VoiceRecorderState) => void;
}

function formatClock(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ onChange }: VoiceRecorderProps) {
  const [scriptId, setScriptId] = useState<string>(DEFAULT_SCRIPT_ID);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const script: RecordingScript =
    RECORDING_SCRIPTS.find((s) => s.id === scriptId) ?? RECORDING_SCRIPTS[0];

  // Notify parent whenever the state that matters changes
  useEffect(() => {
    onChange({
      wavBlob: audioBlob,
      referenceText: script.text,
      durationSeconds: Math.round(elapsedMs / 1000),
    });
  }, [audioBlob, script.text, elapsedMs, onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setElapsedMs(0);
    setStatus("idle");
    setErrorMessage(null);
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setStatus("requesting-mic");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Prefer webm/opus which is universally supported in MediaRecorder
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "",
      ];
      const mimeType = mimeCandidates.find(
        (m) => m === "" || MediaRecorder.isTypeSupported(m)
      );

      const recorder =
        mimeType !== undefined && mimeType !== ""
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setStatus("processing");
        // Stop the mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        try {
          const rawBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const arrayBuffer = await rawBlob.arrayBuffer();
          const audioCtx = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)();
          const decoded = await audioCtx.decodeAudioData(
            arrayBuffer.slice(0)
          );
          await audioCtx.close();

          const wav = audioBufferToWav(decoded);
          const url = URL.createObjectURL(wav);

          setAudioBlob(wav);
          setAudioUrl(url);
          setStatus("ready");
        } catch (err) {
          console.error("decode error", err);
          setErrorMessage(
            "Couldn't process the recording. Please try again."
          );
          setStatus("error");
        }
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err) {
      console.error("mic error", err);
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied. Please enable it in your browser settings."
          : "Couldn't access the microphone. Make sure one is connected and try again.";
      setErrorMessage(msg);
      setStatus("error");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const isReady = status === "ready";
  const hasError = status === "error";

  return (
    <div className="space-y-4">
      {/* Script selector */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
          Pick a script
        </div>
        <div className="flex flex-wrap gap-2">
          {RECORDING_SCRIPTS.map((s) => {
            const active = s.id === scriptId;
            const disabled = isRecording || isProcessing;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setScriptId(s.id);
                  // If we had a recording for a different script, drop it
                  if (audioBlob) resetRecording();
                }}
                className={`px-3 py-1.5 rounded-full border text-xs transition-all duration-150 ${
                  active
                    ? "bg-accent border-ring text-foreground"
                    : "bg-muted/40 border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="font-semibold">{s.label}</span>
                <span className="opacity-60 ml-1.5">— {s.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Script text display */}
      <div className="rounded-lg border-2 border-border bg-muted/30 p-5">
        <p className="text-base leading-relaxed text-foreground text-center">
          {script.text}
        </p>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-3 uppercase tracking-wider">
          ~{script.estimatedSeconds}s when read naturally
        </p>
      </div>

      {/* Record control */}
      <div className="flex flex-col items-center gap-3 py-2">
        {/* Big button */}
        {!isRecording && !isProcessing && (
          <button
            type="button"
            onClick={isReady ? resetRecording : startRecording}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 shadow-lg active:scale-95 ${
              isReady
                ? "bg-muted hover:bg-muted/80 text-muted-foreground"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            aria-label={isReady ? "Re-record" : "Start recording"}
          >
            {isReady ? (
              <RotateCcw className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        )}

        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg active:scale-95 animate-pulse"
            aria-label="Stop recording"
          >
            <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
            <Square className="h-8 w-8 relative z-10" fill="currentColor" />
          </button>
        )}

        {isProcessing && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Status line */}
        <div className="text-center space-y-0.5 min-h-[2.5rem]">
          {status === "idle" && (
            <p className="text-sm text-muted-foreground">
              Press the red button and read the script aloud
            </p>
          )}
          {status === "requesting-mic" && (
            <p className="text-sm text-muted-foreground">
              Requesting microphone permission…
            </p>
          )}
          {isRecording && (
            <>
              <p className="text-lg font-mono tabular-nums text-red-400">
                {formatClock(elapsedMs)}
              </p>
              <p className="text-xs text-muted-foreground">
                Recording — click the square to stop
              </p>
            </>
          )}
          {isProcessing && (
            <p className="text-sm text-muted-foreground">Processing…</p>
          )}
          {isReady && (
            <p className="text-sm text-green-400">
              Recording ready ({formatClock(elapsedMs)}) — click to re-record
            </p>
          )}
          {hasError && (
            <div className="flex items-center gap-1.5 text-sm text-destructive justify-center">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMessage || "Recording failed"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview player */}
      {isReady && audioUrl && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
            Preview
          </div>
          <audio
            src={audioUrl}
            controls
            className="w-full h-10 rounded-md"
          />
        </div>
      )}

      {/* Retry button on error */}
      {hasError && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={resetRecording}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
