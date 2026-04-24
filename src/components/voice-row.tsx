"use client";

import { motion } from "framer-motion";
import { User, UserRound, Heart } from "lucide-react";
import { VoicePreviewPlayer } from "./voice-preview-player";
import { VoiceAvatar } from "./voice-avatar";
import { COUNTRIES } from "@/lib/voice-names";
import { useFavoritesStore } from "@/lib/favorites-store";
import type { EnrichedVoice } from "./voice-card";

interface VoiceRowProps {
  voice: EnrichedVoice;
  isSelected: boolean;
  onSelect: (voiceId: string) => void;
  index?: number;
  /** Slim layout for narrow panels (hides language + age columns). */
  compact?: boolean;
}

/**
 * List-row voice card (ElevenLabs "My Voices" style) with a unique gradient
 * avatar, springy enter animation, and subtle hover lift.
 */
export function VoiceRow({ voice, isSelected, onSelect, index = 0, compact = false }: VoiceRowProps) {
  const country = voice.countryCode
    ? COUNTRIES.find((c) => c.code === voice.countryCode)
    : null;
  const isFavorite = useFavoritesStore((s) => s.isFavorite(voice.name));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const gridCols = compact
    ? "grid-cols-[1fr_auto_auto]"
    : "grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(90px,0.7fr)_auto_auto_auto]";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: Math.min(index * 0.015, 0.25),
      }}
      whileHover={{ backgroundColor: "var(--accent)", transition: { duration: 0.15 } }}
      onClick={() => onSelect(voice.id)}
      className={`
        group grid cursor-pointer items-center gap-3 ${compact ? "px-3 py-2.5" : "px-4 py-3"} border-b border-border/50
        ${gridCols}
        ${isSelected ? "bg-accent/60" : ""}
      `}
    >
      {/* Avatar + Name + Tagline */}
      <div className="flex items-center gap-3 min-w-0">
        <VoiceAvatar id={voice.id} initials={voice.avatarInitials || "??"} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <motion.span
              className="text-sm font-medium text-foreground truncate"
              whileHover={{ x: 2 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              {voice.displayName || voice.name}
            </motion.span>
            {voice.gender === "male" ? (
              <User className="h-3 w-3 text-blue-400/60 flex-shrink-0" />
            ) : (
              <UserRound className="h-3 w-3 text-pink-400/60 flex-shrink-0" />
            )}
          </div>
          {voice.tagline && (
            <span className="block text-xs text-muted-foreground truncate mt-0.5">
              {voice.tagline}
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <>
          {/* Language + country flag */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            {country && (
              <span className="flex-shrink-0 text-base leading-none" title={country.name}>
                {country.flag}
              </span>
            )}
            <span className="truncate">{voice.language || "English"}</span>
          </div>

          {/* Age bucket */}
          <div className="text-xs text-muted-foreground capitalize hidden sm:block">
            {voice.ageBucket || ""}
          </div>
        </>
      )}

      {/* Play button — sample preview */}
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        {voice.previewUrl && (
          <VoicePreviewPlayer src={voice.previewUrl} compact iconOnly />
        )}
      </div>

      {/* Favorite toggle (heart) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(voice.name);
        }}
        className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          isFavorite
            ? "text-rose-400 hover:text-rose-500"
            : "text-muted-foreground/40 hover:text-rose-400 opacity-0 group-hover:opacity-100"
        } ${isFavorite ? "opacity-100" : ""}`}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} />
      </button>

      {!compact && <div className="w-2 flex-shrink-0" />}
    </motion.div>
  );
}
