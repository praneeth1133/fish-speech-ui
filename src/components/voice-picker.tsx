"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VoiceCard, type EnrichedVoice } from "./voice-card";
import { LANGUAGES } from "@/lib/voice-names";

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
    return voices.filter((v) => {
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
    });
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

      {/* Voice grid */}
      <div className="grid grid-cols-2 gap-2">
        {showDefaultVoice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onSelectVoice("default")}
            className={`
              cursor-pointer rounded-xl border p-3 transition-all duration-200
              ${
                selectedVoice === "default"
                  ? "border-primary/30 bg-accent ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
              }
            `}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Default</p>
                <p className="text-[10px] text-muted-foreground">No voice cloning</p>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {filteredVoices.map((voice, i) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              isSelected={selectedVoice === voice.id}
              onSelect={onSelectVoice}
              index={i}
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
