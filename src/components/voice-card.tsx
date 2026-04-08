"use client";

import { motion } from "framer-motion";
import { User, UserRound } from "lucide-react";
import { VoicePreviewPlayer } from "./voice-preview-player";
import { LANGUAGE_COLORS, LANGUAGE_AVATAR_BG, COUNTRIES } from "@/lib/voice-names";

export interface EnrichedVoice {
  id: string;
  name: string;
  displayName?: string;
  language?: string;
  gender?: string;
  languageCode?: string;
  avatarInitials?: string;
  tagline?: string;
  previewUrl?: string;
  is_backend_ref?: boolean;
  country?: string;
  countryCode?: string;
  ageBucket?: "young" | "adult" | "older";
  age?: number | null;
  source?: "fish-speech-builtin" | "vctk";
}

interface VoiceCardProps {
  voice: EnrichedVoice;
  isSelected: boolean;
  onSelect: (voiceId: string) => void;
  index?: number;
}

export function VoiceCard({
  voice,
  isSelected,
  onSelect,
  index = 0,
}: VoiceCardProps) {
  const lang = (voice.language || "english").toLowerCase();
  const colors = LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.english;
  const avatarBg = LANGUAGE_AVATAR_BG[lang] || LANGUAGE_AVATAR_BG.english;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(voice.id)}
      className={`
        group relative cursor-pointer rounded-xl border p-3 transition-all duration-200
        ${
          isSelected
            ? `border-primary/30 bg-accent ring-1 ${colors.ring}`
            : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
        }
      `}
    >
      {/* Avatar + Info */}
      <div className="flex items-start gap-2.5 mb-2.5">
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
              <User className="h-3 w-3 text-blue-400/50 flex-shrink-0" />
            ) : (
              <UserRound className="h-3 w-3 text-pink-400/50 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={`inline-flex text-[9px] font-medium px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
            >
              {voice.language || lang}
            </span>
            {voice.countryCode &&
              (() => {
                const c = COUNTRIES.find((x) => x.code === voice.countryCode);
                if (!c) return null;
                return (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground"
                    title={c.name}
                  >
                    <span>{c.flag}</span>
                    <span className="uppercase">{c.code}</span>
                  </span>
                );
              })()}
            {voice.ageBucket && (
              <span className="inline-flex text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground capitalize">
                {voice.ageBucket}
              </span>
            )}
          </div>
          {voice.tagline && (
            <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
              {voice.tagline}
            </span>
          )}
        </div>
      </div>

      {/* Audio preview */}
      {voice.previewUrl && (
        <VoicePreviewPlayer src={voice.previewUrl} compact />
      )}
    </motion.div>
  );
}
