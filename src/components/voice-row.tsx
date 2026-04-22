"use client";

import { motion } from "framer-motion";
import { User, UserRound } from "lucide-react";
import { VoicePreviewPlayer } from "./voice-preview-player";
import { LANGUAGE_AVATAR_BG, COUNTRIES } from "@/lib/voice-names";
import type { EnrichedVoice } from "./voice-card";

interface VoiceRowProps {
  voice: EnrichedVoice;
  isSelected: boolean;
  onSelect: (voiceId: string) => void;
  index?: number;
}

/**
 * List-row voice card (ElevenLabs "My Voices" style).
 * Columns: avatar · name + tagline · language · age · play · — keeps all the
 * functionality of the grid card.
 */
export function VoiceRow({ voice, isSelected, onSelect, index = 0 }: VoiceRowProps) {
  const lang = (voice.language || "english").toLowerCase();
  const avatarBg = LANGUAGE_AVATAR_BG[lang] || LANGUAGE_AVATAR_BG.english;
  const country = voice.countryCode
    ? COUNTRIES.find((c) => c.code === voice.countryCode)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.01, 0.2) }}
      onClick={() => onSelect(voice.id)}
      className={`
        group grid cursor-pointer items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors
        grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(90px,0.7fr)_auto_auto]
        ${isSelected ? "bg-accent/60" : "hover:bg-accent/30"}
      `}
    >
      {/* Avatar + Name + Tagline */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-primary-foreground text-[10px] font-bold`}
        >
          {voice.avatarInitials || "??"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-foreground truncate">
              {voice.displayName || voice.name}
            </span>
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

      {/* Play button — sample preview */}
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        {voice.previewUrl && (
          <VoicePreviewPlayer src={voice.previewUrl} compact iconOnly />
        )}
      </div>

      {/* Spacer for menu column alignment */}
      <div className="w-6 flex-shrink-0" />
    </motion.div>
  );
}
