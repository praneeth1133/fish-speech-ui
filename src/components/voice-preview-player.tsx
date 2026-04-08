"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Square } from "lucide-react";
import { motion } from "framer-motion";

// Global singleton: only one preview plays at a time
let currentlyPlaying: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

interface VoicePreviewPlayerProps {
  src: string;
  compact?: boolean;
}

export function VoicePreviewPlayer({ src, compact }: VoicePreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const stopPlaying = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      if (currentlyPlaying === audio) {
        currentlyPlaying = null;
        currentStopCallback = null;
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      // Cleanup on unmount
      if (currentlyPlaying === audio) {
        audio.pause();
        currentlyPlaying = null;
        currentStopCallback = null;
      }
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (currentlyPlaying === audio) {
        currentlyPlaying = null;
        currentStopCallback = null;
      }
    } else {
      // Stop any currently playing preview
      if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
        currentlyPlaying.currentTime = 0;
        currentStopCallback?.();
      }
      currentlyPlaying = audio;
      currentStopCallback = stopPlaying;
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="flex items-center gap-2 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className={`flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ${
          compact ? "h-7 w-7" : "h-8 w-8"
        } ${
          isPlaying
            ? "bg-primary/20 text-foreground shadow-lg shadow-primary/10"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        {isPlaying ? (
          <Pause className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        ) : (
          <Play className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} ml-0.5`} />
        )}
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Progress bar */}
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-foreground/30 to-foreground/50"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </div>

        {!compact && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums flex-shrink-0">
            {formatTime(duration)}
          </span>
        )}
      </div>
    </div>
  );
}
