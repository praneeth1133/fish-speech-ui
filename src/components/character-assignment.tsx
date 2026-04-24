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

import { useEffect, useMemo, useState } from "react";
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
import { Users, Sparkles, Loader2, X, Check, Volume2 } from "lucide-react";
import { motion } from "framer-motion";

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

                    {/* Horizontally scrollable voice chip strip — strictly
                        contained so it never widens its parent dialog. */}
                    <div className="relative w-full">
                      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
                        <VoiceChip
                          selected={assignment.voice_id === null}
                          onSelect={() => setCharacterVoice(char.name, null, "Default")}
                          displayName="Default"
                          tagline="No cloning"
                          avatarInitials="DF"
                          voiceId={null}
                          previewUrl={null}
                        />
                        {voices.map((v) => (
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
                          />
                        ))}
                      </div>
                    </div>
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
}

function VoiceChip({
  selected,
  onSelect,
  displayName,
  tagline,
  avatarInitials,
  voiceId,
  previewUrl,
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
