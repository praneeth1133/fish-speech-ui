"use client";

/**
 * Character → voice assignment dialog.
 *
 * Opens automatically when `characters` in the TTS store becomes non-null
 * (which happens after `identifyCharacters()` returns). Lists each character
 * alongside a dropdown of all available voices. When the user clicks
 * "Generate Audio", every segment is queued with its assigned voice under a
 * shared batch_id, and the queue-provider will auto-concat them into a
 * single history entry when the whole batch completes.
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
import { Users, Sparkles, Loader2, X } from "lucide-react";

interface BackendVoice {
  id: string;
  name: string;
  displayName?: string;
  language?: string;
  gender?: string;
  country?: string;
  is_backend_ref?: boolean;
}

export function CharacterAssignment() {
  const characters = useTTSSettingsStore((s) => s.characters);
  const segments = useTTSSettingsStore((s) => s.segments);
  const assignments = useTTSSettingsStore((s) => s.characterAssignments);
  const setCharacterVoice = useTTSSettingsStore((s) => s.setCharacterVoice);
  const clearCharacters = useTTSSettingsStore((s) => s.clearCharacters);
  const generateMultiVoice = useTTSSettingsStore((s) => s.generateMultiVoice);

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
        const list: BackendVoice[] = (data.voices || []).filter(
          (v: BackendVoice) => v.is_backend_ref
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

  // Segments grouped per character for a quick preview count
  const segmentCountByCharacter = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!segments) return counts;
    for (const s of segments) {
      counts[s.character] = (counts[s.character] || 0) + 1;
    }
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assign Voices to Characters
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            AI found {characters.length} character
            {characters.length === 1 ? "" : "s"} in your script. Pick a voice
            for each one, then generate. Segments will be queued in order and
            auto-combined into a single audio file when complete.
          </p>

          {loadingVoices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {characters.map((char) => {
                const assignment = assignments[char.name] || {
                  voice_id: null,
                  voice_name: "Default",
                };
                return (
                  <div
                    key={char.name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {char.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {char.name}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {segmentCountByCharacter[char.name] || 0} line
                          {segmentCountByCharacter[char.name] === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      {char.description && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {char.description}
                        </p>
                      )}
                    </div>
                    <select
                      className="min-w-[180px] h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={assignment.voice_id || "default"}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "default") {
                          setCharacterVoice(char.name, null, "Default");
                        } else {
                          const voice = voices.find((vv) => vv.name === v);
                          setCharacterVoice(
                            char.name,
                            v,
                            voice?.displayName || v
                          );
                        }
                      }}
                    >
                      <option value="default">Default Voice</option>
                      {voices.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.displayName || v.name}
                          {v.country ? ` — ${v.country}` : ""}
                          {v.gender ? ` (${v.gender})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {segments?.length || 0} segments total
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={clearCharacters}
                disabled={submitting}
              >
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
