"use client";

/**
 * Character → voice assignment dialog.
 *
 * Opens automatically when `characters` in the TTS store becomes non-null
 * (which happens after `identifyCharacters()` returns). For each character,
 * the user sees a rich scrollable row of voice chips — each chip carries the
 * voice's unique gradient avatar, a name, and a play button that instantly
 * previews the reference sample (no TTS generation — the /sample endpoint
 * returns the static WAV on disk in ~0.2s).
 *
 * A toggle at the bottom controls RMS volume leveling across characters
 * (default ON) so the merged output doesn't have one voice dramatically
 * louder than the rest.
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { useTTSSettingsStore } from "@/lib/tts-settings-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { VoiceAvatar } from "@/components/voice-avatar";
import { VoicePreviewPlayer } from "@/components/voice-preview-player";
import { Users, Sparkles, Loader2, X, Check, Volume2, Heart, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useFavoritesStore } from "@/lib/favorites-store";

interface BackendVoice {
  id: string;
  name: string;
  displayName?: string;
  language?: string;
  gender?: string;
  country?: string;
  tagline?: string;
  avatarInitials?: string;
  previewUrl?: string;
  is_backend_ref?: boolean;
  mtime?: number;
}

export function CharacterAssignment() {
  const characters = useTTSSettingsStore((s) => s.characters);
  const segments = useTTSSettingsStore((s) => s.segments);
  const assignments = useTTSSettingsStore((s) => s.characterAssignments);
  const setCharacterVoice = useTTSSettingsStore((s) => s.setCharacterVoice);
  const clearCharacters = useTTSSettingsStore((s) => s.clearCharacters);
  const generateMultiVoice = useTTSSettingsStore((s) => s.generateMultiVoice);
  const levelVolumes = useTTSSettingsStore((s) => s.levelCharacterVolumes);
  const setLevelVolumes = useTTSSettingsStore((s) => s.setLevelCharacterVolumes);

  const [voices, setVoices] = useState<BackendVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const favoriteIds = useFavoritesStore((s) => s.ids);

  // Sort voices with favorites pinned to the front, then by newest-first,
  // and filter by the voice search query so every voice is discoverable.
  const sortedVoices = useMemo(() => {
    const favSet = new Set(favoriteIds);
    const q = voiceSearch.trim().toLowerCase();
    const base = q
      ? voices.filter((v) => {
          return (
            (v.displayName || v.name).toLowerCase().includes(q) ||
            (v.name || "").toLowerCase().includes(q) ||
            (v.tagline || "").toLowerCase().includes(q) ||
            (v.country || "").toLowerCase().includes(q) ||
            (v.language || "").toLowerCase().includes(q) ||
            (v.gender || "").toLowerCase().includes(q)
          );
        })
      : voices;
    return [...base].sort((a, b) => {
      const aFav = favSet.has(a.name) ? 0 : 1;
      const bFav = favSet.has(b.name) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (b.mtime || 0) - (a.mtime || 0);
    });
  }, [voices, favoriteIds, voiceSearch]);

  const open = characters !== null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingVoices(true);
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: BackendVoice[] = (data.voices || [])
          .filter((v: BackendVoice) => v.is_backend_ref)
          .sort(
            (a: BackendVoice, b: BackendVoice) =>
              (b.mtime || 0) - (a.mtime || 0)
          );
        setVoices(list);
      })
      .catch(() => {
        if (!cancelled) setVoices([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const segmentCountByCharacter = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!segments) return counts;
    for (const s of segments) counts[s.character] = (counts[s.character] || 0) + 1;
    return counts;
  }, [segments]);

  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      await generateMultiVoice();
    } finally {
      setSubmitting(false);
    }
  };

  if (!characters) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearCharacters();
      }}
    >
      <DialogContent className="sm:max-w-3xl w-[min(92vw,48rem)] h-[min(90vh,720px)] p-0 flex flex-col overflow-hidden">
        {/* Sticky header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assign Voices to Characters
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            AI found {characters.length} character
            {characters.length === 1 ? "" : "s"} in your script. Pick a voice
            for each — tap play on any chip to hear its sample.
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Global voice search — filters every character's chip strip */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              placeholder={`Search ${voices.length} voices by name, country, language, gender...`}
              className="pl-9 h-9 text-sm"
            />
            {voiceSearch && (
              <button
                type="button"
                onClick={() => setVoiceSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {voiceSearch && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {sortedVoices.length} match{sortedVoices.length === 1 ? "" : "es"}
              </p>
            )}
          </div>

          {loadingVoices ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {characters.map((char) => {
                const assignment = assignments[char.name] || {
                  voice_id: null,
                  voice_name: "Default",
                };
                return (
                  <div
                    key={char.name}
                    className="rounded-xl border border-border bg-card/60 p-3 space-y-3"
                  >
                    {/* Character header */}
                    <div className="flex items-center gap-3">
                      <VoiceAvatar
                        id={`char-${char.name}`}
                        initials={char.name.slice(0, 2).toUpperCase()}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {char.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {segmentCountByCharacter[char.name] || 0} line
                            {segmentCountByCharacter[char.name] === 1 ? "" : "s"}
                          </Badge>
                          {assignment.voice_id && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                              <Check className="h-2.5 w-2.5 mr-0.5" />
                              {assignment.voice_name}
                            </Badge>
                          )}
                        </div>
                        {char.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {char.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Horizontally scrollable voice chip strip with explicit
                        scroll buttons so the full library is discoverable. */}
                    <ScrollableChipStrip
                      totalChips={sortedVoices.length + 1}
                    >
                      <VoiceChip
                        selected={assignment.voice_id === null}
                        onSelect={() => setCharacterVoice(char.name, null, "Default")}
                        displayName="Default"
                        tagline="No cloning"
                        avatarInitials="DF"
                        voiceId={null}
                        previewUrl={null}
                      />
                      {sortedVoices.map((v) => (
                        <VoiceChip
                          key={v.id}
                          selected={assignment.voice_id === v.name}
                          onSelect={() =>
                            setCharacterVoice(
                              char.name,
                              v.name,
                              v.displayName || v.name
                            )
                          }
                          displayName={v.displayName || v.name}
                          tagline={v.tagline || v.gender || ""}
                          avatarInitials={v.avatarInitials || v.name.slice(0, 2).toUpperCase()}
                          voiceId={v.name}
                          previewUrl={v.previewUrl || `/api/voice-preview/${v.name}`}
                          isFavorite={favoriteIds.includes(v.name)}
                        />
                      ))}
                    </ScrollableChipStrip>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky footer (always visible) — toggle + actions */}
        <div className="border-t border-border bg-card/95 backdrop-blur px-5 py-3 space-y-3 shrink-0">
          {/* Volume leveling toggle */}
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <Volume2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <Label className="text-sm font-medium block">
                  Level volumes across characters
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Normalizes each segment to a common loudness so no one voice is louder.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={levelVolumes}
              onClick={() => setLevelVolumes(!levelVolumes)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                levelVolumes ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  levelVolumes ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {segments?.length || 0} segments total
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={clearCharacters} disabled={submitting}>
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                Generate Multi-Voice Audio
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VoiceChipProps {
  selected: boolean;
  onSelect: () => void;
  displayName: string;
  tagline: string;
  avatarInitials: string;
  voiceId: string | null;
  previewUrl: string | null;
  isFavorite?: boolean;
}

function VoiceChip({
  selected,
  onSelect,
  displayName,
  tagline,
  avatarInitials,
  voiceId,
  previewUrl,
  isFavorite = false,
}: VoiceChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`relative flex-shrink-0 w-36 snap-start rounded-lg border p-2.5 text-left transition-colors ${
        selected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
      }`}
    >
      {isFavorite && (
        <Heart
          className="absolute top-1.5 right-1.5 h-3 w-3 text-rose-400"
          fill="currentColor"
        />
      )}
      <div className="flex items-center gap-2 mb-2">
        <VoiceAvatar
          id={voiceId || "default"}
          initials={avatarInitials}
          size="sm"
          animated={false}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate">{displayName}</p>
          {tagline && (
            <p className="text-[9px] text-muted-foreground truncate">{tagline}</p>
          )}
        </div>
        {selected && (
          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        )}
      </div>
      {previewUrl && (
        <div onClick={(e) => e.stopPropagation()}>
          <VoicePreviewPlayer src={previewUrl} compact iconOnly />
        </div>
      )}
    </motion.button>
  );
}

/**
 * Renders children inside a horizontally-scrollable strip with overlay
 * arrow buttons so the user can page through all available voices even on
 * a trackpad that doesn't do horizontal scroll well.
 */
function ScrollableChipStrip({
  children,
  totalChips,
}: {
  children: React.ReactNode;
  totalChips: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="relative w-full group/strip">
      <div
        ref={scrollRef}
        className="flex items-stretch gap-2 overflow-x-auto pb-2 -mx-1 px-8 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {children}
      </div>
      {/* Left chevron */}
      <button
        type="button"
        onClick={() => scrollBy(-320)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm opacity-0 group-hover/strip:opacity-100 transition-opacity hover:bg-accent"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {/* Right chevron */}
      <button
        type="button"
        onClick={() => scrollBy(320)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm opacity-0 group-hover/strip:opacity-100 transition-opacity hover:bg-accent"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {/* Total-count hint on the right */}
      {totalChips > 6 && (
        <span className="absolute right-1 -bottom-0.5 text-[9px] text-muted-foreground/60 pointer-events-none">
          {totalChips} voices
        </span>
      )}
    </div>
  );
}
