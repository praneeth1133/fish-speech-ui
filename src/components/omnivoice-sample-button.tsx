"use client";

/**
 * Play / stop button for an OmniVoice preset sample.
 *
 * The first click generates a ~6-second sample phrase through the normal
 * TTS route using that preset's attribute dropdowns, caches the WAV blob
 * in IndexedDB (keyed by preset id), and plays it. Every subsequent click
 * plays from cache — zero cost, zero latency.
 */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { getCachedSample, setCachedSample, SAMPLE_PHRASE } from "@/lib/omnivoice-sample-cache";
import { recordGeneration } from "@/components/omnivoice-cost-meter";
import type { OmniVoicePreset } from "@/lib/omnivoice-presets";
import { toast } from "sonner";

interface Props {
  preset: OmniVoicePreset;
  size?: "xs" | "sm";
}

// In-memory URL cache so repeated mounts don't recreate object URLs.
const urlCache = new Map<string, string>();

export function OmniVoiceSampleButton({ preset, size = "sm" }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "playing">("idle");
  const [url, setUrl] = useState<string | null>(() => urlCache.get(preset.id) || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // On mount, check IndexedDB for an existing sample. This lets the button
  // skip straight to "ready" without regeneration on revisits.
  useEffect(() => {
    let cancelled = false;
    if (urlCache.has(preset.id)) {
      setUrl(urlCache.get(preset.id)!);
      setState("ready");
      return;
    }
    (async () => {
      const cached = await getCachedSample(preset.id);
      if (!cached || cancelled) return;
      const objUrl = URL.createObjectURL(cached);
      urlCache.set(preset.id, objUrl);
      setUrl(objUrl);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [preset.id]);

  const generate = async (): Promise<Blob | null> => {
    setState("loading");
    try {
      const res = await fetch("/api/omnivoice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: SAMPLE_PHRASE,
          language: "Auto",
          mode: "design",
          gender: preset.gender,
          age: preset.age,
          pitch: preset.pitch,
          style: preset.style,
          accent: preset.accent,
          dialect: preset.dialect,
          num_step: 16, // fewer steps = faster sample
          guidance_scale: 2.0,
          speed: 1.0,
          denoise: true,
          preprocess_prompt: true,
          postprocess_output: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      await setCachedSample(preset.id, blob);
      recordGeneration();
      const objUrl = URL.createObjectURL(blob);
      urlCache.set(preset.id, objUrl);
      setUrl(objUrl);
      setState("ready");
      return blob;
    } catch (err) {
      console.error("Sample generation failed:", err);
      toast.error(
        `Couldn't preview "${preset.name}": ${
          err instanceof Error ? err.message : "unknown error"
        }`
      );
      setState("idle");
      return null;
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (state === "loading") return;

    if (state === "playing") {
      audioRef.current?.pause();
      return;
    }

    let playUrl = url;
    if (!playUrl) {
      await generate();
      playUrl = urlCache.get(preset.id) || null;
      if (!playUrl) return;
    }

    // Play the audio
    if (!audioRef.current) {
      audioRef.current = new Audio(playUrl);
      audioRef.current.addEventListener("ended", () => setState("ready"));
      audioRef.current.addEventListener("pause", () => setState((s) => (s === "playing" ? "ready" : s)));
    } else {
      audioRef.current.src = playUrl;
    }
    try {
      await audioRef.current.play();
      setState("playing");
    } catch {
      setState("ready");
    }
  };

  const dim = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const iconDim = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex ${dim} items-center justify-center rounded-full border border-border/70 bg-card/80 backdrop-blur hover:bg-primary/10 hover:border-primary/40 transition-colors shadow-sm`}
      title={
        state === "idle"
          ? `Generate + play sample (uses ~2s of GPU time)`
          : state === "loading"
            ? "Generating sample..."
            : state === "playing"
              ? "Pause"
              : "Play sample"
      }
    >
      {state === "loading" ? (
        <Loader2 className={`${iconDim} animate-spin text-muted-foreground`} />
      ) : state === "playing" ? (
        <Pause className={`${iconDim} text-primary`} />
      ) : (
        <Play className={`${iconDim} text-foreground ml-0.5`} />
      )}
    </button>
  );
}
