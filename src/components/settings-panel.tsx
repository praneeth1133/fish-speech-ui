"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, SlidersHorizontal, X, Languages } from "lucide-react";
import { VoiceSelector } from "./voice-selector";
import { QueuePanel } from "./queue-panel";
import { useTTSSettingsStore, type EngineId } from "@/lib/tts-settings-store";
import { useState } from "react";

function SettingSlider({
  label,
  sublabel,
  value,
  min,
  max,
  step,
  onChange,
  description,
  formatValue,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  description?: string;
  formatValue?: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm text-muted-foreground">{label}</Label>
          {sublabel && (
            <span className="text-[10px] text-muted-foreground/50">({sublabel})</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {formatValue ? formatValue(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      {description && (
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function SettingsContent() {
  const engine = useTTSSettingsStore((s) => s.engine);
  const setEngine = useTTSSettingsStore((s) => s.setEngine);
  const temperature = useTTSSettingsStore((s) => s.temperature);
  const setTemperature = useTTSSettingsStore((s) => s.setTemperature);
  const topP = useTTSSettingsStore((s) => s.topP);
  const setTopP = useTTSSettingsStore((s) => s.setTopP);
  const repetitionPenalty = useTTSSettingsStore((s) => s.repetitionPenalty);
  const setRepetitionPenalty = useTTSSettingsStore((s) => s.setRepetitionPenalty);
  const maxTokens = useTTSSettingsStore((s) => s.maxTokens);
  const setMaxTokens = useTTSSettingsStore((s) => s.setMaxTokens);
  const chunkLength = useTTSSettingsStore((s) => s.chunkLength);
  const setChunkLength = useTTSSettingsStore((s) => s.setChunkLength);
  const format = useTTSSettingsStore((s) => s.format);
  const setFormat = useTTSSettingsStore((s) => s.setFormat);

  return (
    <div className="p-4 space-y-5">
      <VoiceSelector />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Model
        </Label>
        <Select
          value={engine}
          onValueChange={(v) => {
            if (v === "fish-speech" || v === "indic-parler") {
              setEngine(v as EngineId);
            }
          }}
        >
          <SelectTrigger className="h-auto py-2.5 bg-muted/50 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fish-speech">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Fish Speech S2 Pro</span>
                  <span className="text-[10px] text-muted-foreground">
                    Multilingual · voice cloning · 173+ voices
                  </span>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="indic-parler">
              <div className="flex items-center gap-2">
                <Languages className="h-3.5 w-3.5 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Indic Parler-TTS</span>
                  <span className="text-[10px] text-muted-foreground">
                    Telugu only · description-based voices
                  </span>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground/70">
          {engine === "indic-parler"
            ? "Voice list is filtered to Telugu voices only. Output routes through /api/v1/telugu/tts."
            : "Voice list shows all reference voices. Output routes through /api/tts."}
        </p>
      </div>

      <Separator className="bg-border" />

      <SettingSlider
        label="Stability"
        sublabel="Temperature"
        value={temperature}
        min={0.1}
        max={1.0}
        step={0.05}
        onChange={setTemperature}
        description="Lower = more stable & consistent. Higher = more expressive."
      />

      <SettingSlider
        label="Similarity"
        sublabel="Top P"
        value={topP}
        min={0.1}
        max={1.0}
        step={0.05}
        onChange={setTopP}
        description="Higher values make output closer to the reference voice."
      />

      <SettingSlider
        label="Style Exaggeration"
        sublabel="Repetition Penalty"
        value={repetitionPenalty}
        min={0.9}
        max={2.0}
        step={0.05}
        onChange={setRepetitionPenalty}
        description="Reduces repeated sounds and patterns in output."
      />

      <Separator className="bg-border" />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Output Format
        </Label>
        <Select value={format} onValueChange={(v) => { if (v) setFormat(v); }}>
          <SelectTrigger className="h-9 bg-muted/50 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wav">WAV (Best Quality)</SelectItem>
            <SelectItem value="mp3">MP3 (Compressed)</SelectItem>
            <SelectItem value="opus">Opus (Efficient)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-border" />

      <SettingSlider
        label="Max Tokens"
        value={maxTokens}
        min={256}
        max={4096}
        step={128}
        onChange={setMaxTokens}
        formatValue={(v) => v.toString()}
        description="Maximum audio length in tokens."
      />

      <SettingSlider
        label="Chunk Length"
        value={chunkLength}
        min={100}
        max={1000}
        step={50}
        onChange={setChunkLength}
        formatValue={(v) => v.toString()}
        description="Text chunk size for processing."
      />

      <div className="h-4" />
    </div>
  );
}

export function SettingsPanel() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden lg:flex w-80 flex-shrink-0 border-l border-border flex-col h-full bg-card">
        <Tabs defaultValue="settings" className="flex flex-col h-full">
          <div className="px-4 pt-4 flex-shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="settings" className="flex-1 overflow-y-auto scrollbar-thin">
            <SettingsContent />
          </TabsContent>
          <TabsContent value="history" className="flex-1 overflow-y-auto scrollbar-thin">
            <QueuePanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile: floating button + bottom sheet */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-32 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full
                   bg-primary text-primary-foreground shadow-lg shadow-primary/25
                   hover:bg-primary/90 active:scale-95 transition-all"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="text-sm font-medium">Settings</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile bottom sheet */}
      <div
        className={`lg:hidden fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border
                    rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out
                    ${mobileOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 rounded-full bg-muted-foreground/30 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
            <h3 className="text-base font-semibold text-foreground mt-2">Settings</h3>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent mt-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 56px)" }}>
          <SettingsContent />
        </div>
      </div>
    </>
  );
}
