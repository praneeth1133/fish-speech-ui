"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Globe2,
  Sparkles,
  Upload,
  Loader2,
  Download,
  Play,
  Pause,
  Trash2,
  Copy,
  Mic,
  Brush,
} from "lucide-react";
import { toast } from "sonner";
import { makeDownloadName } from "@/lib/download-name";

// Curated set of common languages; the model supports 600+ so "Auto" is fine
// when the user doesn't want to pick. Users can type any BCP-47 name in the
// input — we pass it through to the backend.
const LANGUAGES = [
  "Auto",
  "English",
  "Hindi",
  "Telugu",
  "Tamil",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Japanese",
  "Chinese",
  "Korean",
  "Arabic",
  "Turkish",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Dutch",
  "Polish",
  "Swedish",
  "Greek",
];

export default function OmniVoicePage() {
  const [text, setText] = useState(
    "Hello from OmniVoice — a text-to-speech model that speaks over 600 languages."
  );
  const [mode, setMode] = useState<"clone" | "design">("clone");
  const [language, setLanguage] = useState("Auto");
  const [instruct, setInstruct] = useState(
    "A warm, natural female voice speaking at a conversational pace."
  );
  const [refAudio, setRefAudio] = useState<File | null>(null);
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);
  const [refText, setRefText] = useState("");
  const [numStep, setNumStep] = useState(32);
  const [guidanceScale, setGuidanceScale] = useState(2.0);
  const [speed, setSpeed] = useState(1.0);
  const [denoise, setDenoise] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string>("");
  const [resultFilename, setResultFilename] = useState("omnivoice.wav");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Revoke object URLs on unmount / replace
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
    };
  }, [resultUrl, refAudioUrl]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
    setRefAudio(f);
    setRefAudioUrl(URL.createObjectURL(f));
  };

  const generate = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text");
      return;
    }
    if (mode === "clone" && !refAudio) {
      toast.error("Voice Clone mode needs a reference audio file");
      return;
    }
    setIsGenerating(true);
    setResultUrl(null);
    try {
      // Convert reference audio to base64 so we can send JSON (simpler than
      // multipart + easier to proxy to the Gradio API on the server).
      let refAudioB64: string | undefined;
      if (mode === "clone" && refAudio) {
        refAudioB64 = await fileToDataUrl(refAudio);
      }

      const res = await fetch("/api/omnivoice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          mode,
          ref_audio_b64: refAudioB64,
          ref_text: refText,
          instruct: mode === "design" ? instruct : "",
          num_step: numStep,
          guidance_scale: guidanceScale,
          speed,
          denoise,
          preprocess_prompt: true,
          postprocess_output: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultText(text);
      setResultFilename(makeDownloadName(text, "wav"));
      toast.success("Audio generated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) a.pause();
    else a.play().catch(() => {});
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultFilename;
    a.click();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      toast.success("Text copied to clipboard");
    } catch {
      toast.error("Clipboard blocked");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            OmniVoice
          </h2>
          <p className="text-sm text-muted-foreground">
            Multilingual TTS with voice cloning — 600+ languages. Uses the
            k2-fsa/OmniVoice HF Space (or your own endpoint).
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          External API · Pay-as-you-go
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Text area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Text</Label>
              <span className="text-[11px] text-muted-foreground">
                {text.length} chars
              </span>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type anything in any of 600+ languages..."
              className="min-h-[120px] resize-y"
            />
          </div>

          {/* Language picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or type a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                600+ supported — "Auto" detects from your text
              </p>
            </div>

            {/* Mode picker — clone vs design */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Voice mode</Label>
              <div className="flex gap-2">
                <ModeButton
                  active={mode === "clone"}
                  onClick={() => setMode("clone")}
                  icon={<Mic className="h-3.5 w-3.5" />}
                  label="Clone"
                  hint="Upload reference"
                />
                <ModeButton
                  active={mode === "design"}
                  onClick={() => setMode("design")}
                  icon={<Brush className="h-3.5 w-3.5" />}
                  label="Design"
                  hint="Describe voice"
                />
              </div>
            </div>
          </div>

          {/* Mode-specific inputs */}
          {mode === "clone" ? (
            <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
              <Label className="text-sm font-medium">Reference audio</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleUpload}
                  className="hidden"
                  id="ref-audio-upload"
                />
                <label
                  htmlFor="ref-audio-upload"
                  className="flex-1 flex items-center gap-3 rounded-md border border-dashed border-border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">
                    {refAudio?.name || "Click to upload (3–10s clip works best)"}
                  </span>
                </label>
                {refAudio && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
                      setRefAudio(null);
                      setRefAudioUrl(null);
                    }}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {refAudioUrl && (
                <audio controls src={refAudioUrl} className="w-full" />
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Reference transcript (optional, improves accuracy)
                </Label>
                <Input
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                  placeholder="What the reference clip actually says..."
                  className="text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-card/40 p-4">
              <Label className="text-sm font-medium">Voice description</Label>
              <Textarea
                value={instruct}
                onChange={(e) => setInstruct(e.target.value)}
                placeholder="A deep, raspy male voice speaking slowly and menacingly..."
                className="min-h-[80px] resize-y text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Describe the voice in natural language — gender, age, pace, tone, accent.
              </p>
            </div>
          )}

          {/* Advanced settings */}
          <details className="rounded-lg border border-border bg-card/40">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium select-none">
              Advanced settings
            </summary>
            <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SliderRow
                label="Sampling steps"
                value={numStep}
                min={4}
                max={64}
                step={1}
                onChange={setNumStep}
                hint="More = higher quality, slower"
              />
              <SliderRow
                label="Guidance scale"
                value={guidanceScale}
                min={0.5}
                max={5.0}
                step={0.1}
                onChange={setGuidanceScale}
                hint="How closely to follow the prompt"
              />
              <SliderRow
                label="Speed"
                value={speed}
                min={0.5}
                max={2.0}
                step={0.05}
                onChange={setSpeed}
                hint="Playback speed multiplier"
              />
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="denoise"
                  checked={denoise}
                  onChange={(e) => setDenoise(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="denoise" className="text-sm cursor-pointer">
                  Denoise output
                </Label>
              </div>
            </div>
          </details>

          {/* Generate button */}
          <div className="sticky bottom-4">
            <Button
              size="lg"
              className="w-full gap-2 shadow-lg"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Audio
                </>
              )}
            </Button>
          </div>

          {/* Result player */}
          {resultUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  Result
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Copy text"
                    onClick={handleCopyText}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Download"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <audio
                  ref={audioRef}
                  src={resultUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {resultText}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Helper — base64 data URL of a file. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </div>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
