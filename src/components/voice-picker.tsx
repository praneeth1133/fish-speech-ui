"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type EnrichedVoice } from "./voice-card";
import { VoiceRow } from "./voice-row";
import { LANGUAGES } from "@/lib/voice-names";
import { useFavoritesStore } from "@/lib/favorites-store";
import { Heart } from "lucide-react";

const GENDER_OPTIONS = ["all", "male", "female"] as const;

interface VoicePickerProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  showDefaultVoice?: boolean;
}

export function VoicePicker({
  selectedVoice,
  onSelectVoice,
  showDefaultVoice = true,
}: VoicePickerProps) {
  const [voices, setVoices] = useState<EnrichedVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voices");
      const data = await res.json();
      setVoices(data.voices || []);
    } catch {
      console.warn("Failed to fetch voices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const filteredVoices = useMemo(() => {
    return voices
      .filter((v) => {
        if (!v.is_backend_ref) return false;
        const matchesSearch =
          !search ||
          (v.displayName || v.name).toLowerCase().includes(search.toLowerCase()) ||
          (v.language || "").toLowerCase().includes(search.toLowerCase());
        const matchesLanguage =
          selectedLanguage === "all" ||
          (v.language || "").toLowerCase() === selectedLanguage;
        const matchesGender =
          selectedGender === "all" || v.gender === selectedGender;
        return matchesSearch && matchesLanguage && matchesGender;
      })
      // Newest (most recently added) voices first
      .sort((a, b) => ((b as EnrichedVoice & { mtime?: number }).mtime || 0)
        - ((a as EnrichedVoice & { mtime?: number }).mtime || 0));
  }, [voices, search, selectedLanguage, selectedGender]);

  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    voices.forEach((v) => {
      if (!v.is_backend_ref) return;
      counts.all = (counts.all || 0) + 1;
      const lang = (v.language || "").toLowerCase();
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return counts;
  }, [voices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-5 w-5" />
          </motion.div>
          <span className="text-sm">Loading voices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices..."
          className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/50 focus:border-ring h-9 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Language filters */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        <FilterPill
          label="All"
          count={languageCounts.all}
          isActive={selectedLanguage === "all"}
          onClick={() => setSelectedLanguage("all")}
        />
        {LANGUAGES.map((lang) => (
          <FilterPill
            key={lang}
            label={lang.charAt(0).toUpperCase() + lang.slice(1)}
            count={languageCounts[lang] || 0}
            isActive={selectedLanguage === lang}
            onClick={() => setSelectedLanguage(lang)}
          />
        ))}
      </div>

      {/* Gender filter */}
      <div className="flex items-center gap-1">
        {GENDER_OPTIONS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setSelectedGender(g)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              selectedGender === g
                ? "bg-accent text-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground/80"
            }`}
          >
            {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground/50 ml-2">
          {filteredVoices.length} voice{filteredVoices.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Favorites strip — per-device localStorage favorites */}
      <FavoritesStrip
        voices={voices}
        selectedVoice={selectedVoice}
        onSelectVoice={onSelectVoice}
      />

      {/* Voice list (matches the main Voice Library layout) */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
        {showDefaultVoice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ backgroundColor: "var(--accent)", transition: { duration: 0.15 } }}
            onClick={() => onSelectVoice("default")}
            className={`
              grid cursor-pointer items-center gap-3 px-3 py-2.5 border-b border-border/50
              grid-cols-[1fr_auto]
              ${selectedVoice === "default" ? "bg-accent/60" : ""}
            `}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Default</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">No voice cloning</p>
              </div>
            </div>
            <div className="w-7" />
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {filteredVoices.map((voice, i) => (
            <VoiceRow
              key={voice.id}
              voice={voice}
              isSelected={selectedVoice === voice.id}
              onSelect={onSelectVoice}
              index={i}
              compact
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredVoices.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-muted-foreground"
        >
          <Search className="h-8 w-8 mb-2" />
          <p className="text-sm">No voices match your filters</p>
        </motion.div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
        isActive
          ? "bg-accent text-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground/80"
      }`}
    >
      {label}
      <span className={`text-[9px] ${isActive ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
        {count}
      </span>
    </button>
  );
}

/**
 * Favorites strip — small dedicated section at the top of the picker
 * showing the user's favorited voices (from localStorage). Hidden when
 * there are no favorites. Uses the same compact VoiceRow layout so the UX
 * is consistent with the main list below.
 */
function FavoritesStrip({
  voices,
  selectedVoice,
  onSelectVoice,
}: {
  voices: EnrichedVoice[];
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
}) {
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const favorites = useMemo(() => {
    if (!favoriteIds.length) return [];
    const byName = new Map(voices.map((v) => [v.name, v]));
    return favoriteIds
      .map((id) => byName.get(id))
      .filter((v): v is EnrichedVoice => !!v);
  }, [voices, favoriteIds]);

  if (favorites.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
        <Heart className="h-3 w-3 text-rose-400" fill="currentColor" />
        Favorites
        <span className="text-[9px] text-muted-foreground/50">
          {favorites.length}
        </span>
      </div>
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
        {favorites.map((voice, i) => (
          <VoiceRow
            key={`pfav-${voice.id}`}
            voice={voice}
            isSelected={selectedVoice === voice.id}
            onSelect={onSelectVoice}
            index={i}
            compact
          />
        ))}
      </div>
    </div>
  );
}
