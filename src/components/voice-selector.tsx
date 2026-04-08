"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { VoicePicker } from "./voice-picker";
import { useTTSSettingsStore } from "@/lib/tts-settings-store";
import { LANGUAGE_AVATAR_BG } from "@/lib/voice-names";
import type { EnrichedVoice } from "./voice-card";

export function VoiceSelector() {
  const [open, setOpen] = useState(false);
  const selectedVoice = useTTSSettingsStore((s) => s.selectedVoice);
  const selectedVoiceData = useTTSSettingsStore((s) => s.selectedVoiceData);
  const setSelectedVoice = useTTSSettingsStore((s) => s.setSelectedVoice);
  const setSelectedVoiceData = useTTSSettingsStore((s) => s.setSelectedVoiceData);

  // Fetch voice data when selection changes
  useEffect(() => {
    if (selectedVoice === "default") {
      setSelectedVoiceData(null);
      return;
    }
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        const v = (data.voices || []).find(
          (v: EnrichedVoice) => v.id === selectedVoice
        );
        if (v) setSelectedVoiceData(v);
      })
      .catch(() => {});
  }, [selectedVoice, setSelectedVoiceData]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedVoice(id);
      // Fetch data for the selected voice
      fetch("/api/voices")
        .then((r) => r.json())
        .then((data) => {
          const v = (data.voices || []).find(
            (v: EnrichedVoice) => v.id === id
          );
          if (v) setSelectedVoiceData(v);
        })
        .catch(() => {});
      setOpen(false);
    },
    [setSelectedVoice, setSelectedVoiceData]
  );

  const voice = selectedVoiceData;
  const lang = (voice?.language || "english").toLowerCase();
  const avatarBg = LANGUAGE_AVATAR_BG[lang] || "bg-muted";

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Voice
      </Label>

      <Sheet open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border
                     bg-muted/30 hover:bg-muted/60 transition-colors group text-left"
        >
          <div
            className={`w-9 h-9 rounded-full ${
              voice ? avatarBg : "bg-muted"
            } flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0`}
          >
            {voice?.avatarInitials || "DF"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {voice?.displayName || "Default Voice"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {voice?.tagline || "No voice cloning"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
        </button>

        <SheetContent
          side="right"
          className="w-[440px] sm:max-w-[440px] p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3">
            <SheetTitle>Voice Library</SheetTitle>
            <SheetDescription>
              Choose a voice for your generation
            </SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-5 overflow-y-auto flex-1">
            <VoicePicker
              selectedVoice={selectedVoice}
              onSelectVoice={handleSelect}
              showDefaultVoice={true}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
