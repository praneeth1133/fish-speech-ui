"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
  Library,
  Users,
  Wand2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { makeDownloadName } from "@/lib/download-name";
import { VoiceAvatar } from "@/components/voice-avatar";
import { OMNIVOICE_PRESETS, type OmniVoicePreset } from "@/lib/omnivoice-presets";
import { concatAudioBlobs } from "@/lib/wav-concat";
import { OmniVoiceCostMeter, recordGeneration } from "@/components/omnivoice-cost-meter";
import { OmniVoiceSampleButton } from "@/components/omnivoice-sample-button";

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

// Character-mode types (local to this page — OmniVoice doesn't use the
// Fish-Speech tts-settings-store, which is tied to the local GPU backend).
interface ScriptCharacter {
  name: string;
  description: string;
}
interface ScriptSegment {
  character: string;
  text: string;
}
type CharacterAssignments = Record<string, OmniVoicePreset | null>;

// Shape returned by /api/voices — only the fields we consume here.
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

/**
 * Wrap a Fish Speech reference voice in the OmniVoicePreset shape so the
 * rest of the page doesn't need to branch on voice source. The resulting
 * preset carries fishSpeechVoiceId, which the API route uses to route the
 * generation through OmniVoice's _clone_fn with the Fish Speech reference
 * WAV attached.
 */
function backendVoiceToPreset(v: BackendVoice): OmniVoicePreset {
  const genderKey = (v.gender || "").toLowerCase();
  const inferredGender =
    genderKey.startsWith("m")
      ? "Male / 男"
      : genderKey.startsWith("f")
        ? "Female / 女"
        : undefined;
  const countryBits = [v.country, v.language].filter(Boolean).join(" · ");
  return {
    id: `fs:${v.name}`,
    name: v.displayName || v.name,
    tagline: v.tagline || countryBits || "Fish Speech voice",
    initials:
      v.avatarInitials ||
      (v.displayName || v.name).slice(0, 2).toUpperCase(),
    gender: inferredGender,
    fishSpeechVoiceId: v.name,
    source: "fish-speech",
    language: v.language,
    country: v.country,
    previewUrl: v.previewUrl || `/api/voice-preview/${encodeURIComponent(v.name)}`,
  };
}

export default function OmniVoicePage() {
  const [text, setText] = useState(
    "Hello from OmniVoice — a text-to-speech model that speaks over 600 languages."
  );
  const [mode, setMode] = useState<"preset" | "clone" | "design" | "characters">("preset");
  const [language, setLanguage] = useState("Auto");
  const [instruct, setInstruct] = useState(
    "A warm, natural female voice speaking at a conversational pace."
  );
  const [refAudio, setRefAudio] = useState<File | null>(null);
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);
  const [refText, setRefText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<OmniVoicePreset | null>(
    OMNIVOICE_PRESETS[0]
  );
  const [presetSearch, setPresetSearch] = useState("");
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

  // Character-mode state
  const [characters, setCharacters] = useState<ScriptCharacter[] | null>(null);
  const [segments, setSegments] = useState<ScriptSegment[] | null>(null);
  const [assignments, setAssignments] = useState<CharacterAssignments>({});
  const [identifying, setIdentifying] = useState(false);
  const [multiProgress, setMultiProgress] = useState<
    { done: number; total: number; phase: "generating" | "merging" } | null
  >(null);
  const [multiErrors, setMultiErrors] = useState<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  // Expression-generation state (AI-annotates text with [EXCITED] etc.)
  const [annotating, setAnnotating] = useState(false);

  // Fish Speech voices fetched from the local backend and bridged into
  // OmniVoice's clone endpoint. Loaded once on mount.
  const [fishSpeechPresets, setFishSpeechPresets] = useState<OmniVoicePreset[]>([]);
  const [fishSpeechLoading, setFishSpeechLoading] = useState(true);
  // Toggle between attribute presets, Fish Speech bridge, or both.
  const [voiceSource, setVoiceSource] = useState<"all" | "omnivoice" | "fish-speech">("all");

  useEffect(() => {
    let cancelled = false;
    setFishSpeechLoading(true);
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data: { voices?: BackendVoice[] }) => {
        if (cancelled) return;
        const bridged: OmniVoicePreset[] = (data.voices || [])
          .filter((v) => v.is_backend_ref && v.name)
          .map(backendVoiceToPreset);
        setFishSpeechPresets(bridged);
      })
      .catch((err) => {
        console.warn("Couldn't load Fish Speech voices:", err);
        if (!cancelled) setFishSpeechPresets([]);
      })
      .finally(() => {
        if (!cancelled) setFishSpeechLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Unified preset list exposed through the picker, with OmniVoice attribute
  // presets first (they're hand-tuned) and Fish Speech bridge voices after,
  // newest-first (by mtime on disk) so freshly added refs are easy to find.
  const allPresets = useMemo(() => {
    if (voiceSource === "omnivoice") return OMNIVOICE_PRESETS;
    if (voiceSource === "fish-speech") return fishSpeechPresets;
    return [...OMNIVOICE_PRESETS, ...fishSpeechPresets];
  }, [fishSpeechPresets, voiceSource]);

  // Revoke object URLs on unmount / replace
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
    };
  }, [resultUrl, refAudioUrl]);

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return allPresets;
    return allPresets.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.tagline.toLowerCase().includes(q) ||
        (v.gender || "").toLowerCase().includes(q) ||
        (v.age || "").toLowerCase().includes(q) ||
        (v.accent || "").toLowerCase().includes(q) ||
        (v.language || "").toLowerCase().includes(q) ||
        (v.country || "").toLowerCase().includes(q) ||
        (v.fishSpeechVoiceId || "").toLowerCase().includes(q)
    );
  }, [presetSearch, allPresets]);

  const segmentCountByCharacter = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!segments) return counts;
    for (const s of segments) counts[s.character] = (counts[s.character] || 0) + 1;
    return counts;
  }, [segments]);

  const allCharactersAssigned = useMemo(() => {
    if (!characters || characters.length === 0) return false;
    return characters.every((c) => assignments[c.name]);
  }, [characters, assignments]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
    setRefAudio(f);
    setRefAudioUrl(URL.createObjectURL(f));
  };

  // -------------------------------------------------------------------------
  // Identify characters — calls the shared /api/identify-characters endpoint
  // (uses Claude Haiku) then seeds default preset assignments so every
  // character has something picked from the start.
  // -------------------------------------------------------------------------
  const handleIdentifyCharacters = async () => {
    if (!text.trim()) {
      toast.error("Please enter a script first");
      return;
    }
    setIdentifying(true);
    setMultiErrors([]);
    try {
      const res = await fetch("/api/identify-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        characters: ScriptCharacter[];
        segments: ScriptSegment[];
      };
      setCharacters(data.characters);
      setSegments(data.segments);
      // Auto-assign presets based on character name heuristics
      const nextAssignments: CharacterAssignments = {};
      data.characters.forEach((c, i) => {
        nextAssignments[c.name] = guessPresetForCharacter(c, i);
      });
      setAssignments(nextAssignments);
      toast.success(
        `Found ${data.characters.length} character${
          data.characters.length === 1 ? "" : "s"
        } across ${data.segments.length} segments`
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Character detection failed");
    } finally {
      setIdentifying(false);
    }
  };

  const clearCharacters = () => {
    setCharacters(null);
    setSegments(null);
    setAssignments({});
    setMultiProgress(null);
    setMultiErrors([]);
  };

  // -------------------------------------------------------------------------
  // Expression generation — calls the same /api/generate-expressions route
  // the main Fish Speech page uses. OmniVoice strips unknown tags silently
  // and converts known emotion tags into an instruct-prompt hint, so the
  // standard fish-speech tag set is a safe superset for OmniVoice too.
  // -------------------------------------------------------------------------
  const handleAddExpressions = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text first");
      return;
    }
    setAnnotating(true);
    try {
      const res = await fetch("/api/generate-expressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, engine: "fish-speech" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { annotatedText } = (await res.json()) as { annotatedText: string };
      if (!annotatedText?.trim()) throw new Error("AI returned empty result");
      setText(annotatedText);
      toast.success("Expressions added", {
        description: "Review the tags, then generate audio.",
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to add expressions"
      );
    } finally {
      setAnnotating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Single-voice generation (Preset / Clone / Design modes)
  // -------------------------------------------------------------------------
  const generate = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text");
      return;
    }
    if (mode === "clone" && !refAudio) {
      toast.error("Voice Clone mode needs a reference audio file");
      return;
    }
    if (mode === "preset" && !selectedPreset) {
      toast.error("Pick a preset voice first");
      return;
    }
    setIsGenerating(true);
    setResultUrl(null);
    try {
      let refAudioB64: string | undefined;
      let apiMode: "clone" | "design" = "design";
      let presetAttrs: Partial<OmniVoicePreset> = {};
      let fishSpeechVoiceId: string | undefined;

      if (mode === "clone" && refAudio) {
        refAudioB64 = await fileToDataUrl(refAudio);
        apiMode = "clone";
      } else if (mode === "preset" && selectedPreset) {
        if (selectedPreset.fishSpeechVoiceId) {
          // Fish Speech bridge — the API route will fetch the ref WAV
          // from the local backend and feed it into OmniVoice's _clone_fn.
          apiMode = "clone";
          fishSpeechVoiceId = selectedPreset.fishSpeechVoiceId;
        } else {
          apiMode = "design";
          presetAttrs = presetToAttrs(selectedPreset);
        }
      }

      const res = await fetch("/api/omnivoice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          mode: apiMode,
          ref_audio_b64: refAudioB64,
          ref_text: refText,
          instruct: mode === "design" ? instruct : "",
          fish_speech_voice_id: fishSpeechVoiceId,
          ...presetAttrs,
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
      recordGeneration();
      toast.success("Audio generated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Multi-voice (character) generation
  //   1. For every segment: POST /api/omnivoice/tts with that character's preset
  //   2. Collect the returned wav blobs
  //   3. Merge via concatAudioBlobs (RMS-leveled by default)
  //   4. Expose as the single result player
  // -------------------------------------------------------------------------
  const generateMultiVoice = async () => {
    if (!segments || !characters) {
      toast.error("Identify characters first");
      return;
    }
    if (!allCharactersAssigned) {
      toast.error("Pick a voice for every character");
      return;
    }
    setIsGenerating(true);
    setResultUrl(null);
    setMultiErrors([]);
    setMultiProgress({ done: 0, total: segments.length, phase: "generating" });

    const errors: string[] = [];
    const blobs: Blob[] = [];

    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const preset = assignments[seg.character];
        if (!preset) {
          errors.push(`Missing voice for ${seg.character}`);
          setMultiProgress({ done: i + 1, total: segments.length, phase: "generating" });
          continue;
        }
        try {
          // Route Fish Speech bridged presets through clone + voice id; the
          // rest through design + attribute dropdowns. This is what makes
          // multi-voice scripts able to mix OmniVoice presets with Fish
          // Speech library voices in the same output.
          const perSegmentBody: Record<string, unknown> = {
            text: seg.text,
            language,
            num_step: numStep,
            guidance_scale: guidanceScale,
            speed,
            denoise,
            preprocess_prompt: true,
            postprocess_output: true,
          };
          if (preset.fishSpeechVoiceId) {
            perSegmentBody.mode = "clone";
            perSegmentBody.fish_speech_voice_id = preset.fishSpeechVoiceId;
          } else {
            perSegmentBody.mode = "design";
            Object.assign(perSegmentBody, presetToAttrs(preset));
          }
          const res = await fetch("/api/omnivoice/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(perSegmentBody),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          blobs.push(blob);
          recordGeneration();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Segment ${i + 1} (${seg.character}) failed:`, err);
          errors.push(`Segment ${i + 1} (${seg.character}): ${msg}`);
        }
        setMultiProgress({ done: i + 1, total: segments.length, phase: "generating" });
      }

      if (blobs.length === 0) {
        throw new Error(
          `Every one of ${segments.length} segments failed to generate. ` +
            `Check the browser console for details.`
        );
      }

      // Merge step — WAV decode/resample/normalize/concat. This can take a
      // couple of seconds for a 17-segment batch. Flip phase so the UI shows
      // "Merging audio…" instead of a frozen "17/17" counter.
      setMultiProgress({
        done: blobs.length,
        total: segments.length,
        phase: "merging",
      });

      let merged: Blob;
      try {
        merged = await concatAudioBlobs(blobs, {
          gapSeconds: 0.3,
          normalizeVolume: true,
          targetRms: 0.1,
        });
      } catch (mergeErr) {
        console.error("Merge failed:", mergeErr);
        throw new Error(
          `Generated ${blobs.length} clips but merging them failed: ${
            mergeErr instanceof Error ? mergeErr.message : String(mergeErr)
          }`
        );
      }

      const url = URL.createObjectURL(merged);
      setResultUrl(url);
      const fullText = segments.map((s) => s.text).join(" ");
      setResultText(fullText);
      setResultFilename(makeDownloadName(fullText, "wav"));
      setMultiErrors(errors);
      if (errors.length === 0) {
        toast.success(`Multi-voice audio ready`, {
          description: `${blobs.length} segments combined into one file`,
        });
      } else {
        toast.warning(
          `Merged ${blobs.length} segments · ${errors.length} failed — see details`
        );
      }
      // Scroll the result player into view so the user doesn't miss it when
      // the progress text disappears.
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (err) {
      console.error("Multi-voice generation error:", err);
      toast.error(err instanceof Error ? err.message : "Multi-voice generation failed");
      setMultiErrors((prev) => [
        ...prev,
        err instanceof Error ? err.message : String(err),
      ]);
    } finally {
      setIsGenerating(false);
      // Always clear the in-progress counter — even on error — so the UI
      // doesn't get stuck showing "Generating segment N / N" forever.
      setMultiProgress(null);
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

  const handleClearResult = () => {
    // Stop any in-flight playback so the audio element releases the blob URL
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultText("");
    setResultFilename("omnivoice.wav");
    setIsPlaying(false);
    setMultiErrors([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            OmniVoice
          </h2>
          <p className="text-sm text-muted-foreground">
            Multilingual TTS with voice cloning — 600+ languages. Uses the
            k2-fsa/OmniVoice HF Space (or your own endpoint).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OmniVoiceCostMeter />
          <Badge variant="outline" className="text-[10px]">
            External API · Pay-as-you-go
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Text area + AI expression annotate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-sm font-medium">
                {mode === "characters" ? "Script" : "Text"}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddExpressions}
                  disabled={annotating || !text.trim()}
                  className="h-7 gap-1.5 text-xs"
                  title="Use Claude to sprinkle expression / pause / emotion tags into your text"
                >
                  {annotating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Add Expressions
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {text.length} chars
                </span>
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (mode === "characters" && characters) {
                  // User edited the script — previous character parse is stale
                  clearCharacters();
                }
              }}
              placeholder={
                mode === "characters"
                  ? 'Paste a dialogue or script. Example:\n\nAlice: Did you hear that?\nBob: Yeah. We should probably leave.\nNarrator: The wind picked up.'
                  : "Type anything in any of 600+ languages. Use [EXCITED], [CALM], [LONG PAUSE] etc. for expression."
              }
              className="min-h-[120px] resize-y"
            />
          </div>

          {/* Language picker + mode picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v || "Auto")}>
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
                600+ supported — &ldquo;Auto&rdquo; detects from your text
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Voice mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton
                  active={mode === "preset"}
                  onClick={() => setMode("preset")}
                  icon={<Library className="h-3.5 w-3.5" />}
                  label="Preset"
                  hint="Pick a saved voice"
                />
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
                <ModeButton
                  active={mode === "characters"}
                  onClick={() => setMode("characters")}
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Characters"
                  hint="Multi-voice script"
                />
              </div>
            </div>
          </div>

          {/* Mode-specific inputs */}
          {mode === "preset" ? (
            <PresetPicker
              presets={filteredPresets}
              selected={selectedPreset}
              onSelect={setSelectedPreset}
              search={presetSearch}
              onSearch={setPresetSearch}
              source={voiceSource}
              onSourceChange={setVoiceSource}
              fishSpeechLoading={fishSpeechLoading}
              fishSpeechCount={fishSpeechPresets.length}
              omnivoiceCount={OMNIVOICE_PRESETS.length}
              totalCount={allPresets.length}
            />
          ) : mode === "clone" ? (
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
          ) : mode === "design" ? (
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
          ) : (
            <CharacterPanel
              text={text}
              characters={characters}
              segments={segments}
              assignments={assignments}
              segmentCountByCharacter={segmentCountByCharacter}
              identifying={identifying}
              onIdentify={handleIdentifyCharacters}
              onClear={clearCharacters}
              onAssign={(charName, preset) =>
                setAssignments((prev) => ({ ...prev, [charName]: preset }))
              }
              multiProgress={multiProgress}
              multiErrors={multiErrors}
              availablePresets={allPresets}
            />
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

          {/* Generate button — swaps between single-voice & multi-voice */}
          <div className="sticky bottom-4">
            <Button
              size="lg"
              className="w-full gap-2 shadow-lg"
              onClick={mode === "characters" ? generateMultiVoice : generate}
              disabled={
                isGenerating ||
                (mode === "characters" &&
                  (!characters || !segments || !allCharactersAssigned))
              }
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {multiProgress
                    ? multiProgress.phase === "merging"
                      ? "Merging audio…"
                      : `Generating ${multiProgress.done} / ${multiProgress.total}…`
                    : "Generating…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {mode === "characters"
                    ? "Generate Multi-Voice Audio"
                    : "Generate Audio"}
                </>
              )}
            </Button>
          </div>

          {/* Result player */}
          {resultUrl && (
            <motion.div
              ref={resultRef}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Clear result"
                    onClick={handleClearResult}
                  >
                    <X className="h-4 w-4" />
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
              {multiErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive space-y-0.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {multiErrors.length} segment
                    {multiErrors.length === 1 ? "" : "s"} failed
                  </div>
                  {multiErrors.slice(0, 3).map((e, i) => (
                    <p key={i} className="pl-5 truncate">
                      {e}
                    </p>
                  ))}
                  {multiErrors.length > 3 && (
                    <p className="pl-5 text-muted-foreground">
                      …and {multiErrors.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PresetPicker({
  presets,
  selected,
  onSelect,
  search,
  onSearch,
  source,
  onSourceChange,
  fishSpeechLoading,
  fishSpeechCount,
  omnivoiceCount,
  totalCount,
}: {
  presets: OmniVoicePreset[];
  selected: OmniVoicePreset | null;
  onSelect: (p: OmniVoicePreset) => void;
  search: string;
  onSearch: (s: string) => void;
  source: "all" | "omnivoice" | "fish-speech";
  onSourceChange: (s: "all" | "omnivoice" | "fish-speech") => void;
  fishSpeechLoading: boolean;
  fishSpeechCount: number;
  omnivoiceCount: number;
  totalCount: number;
}) {
  const tabs: { id: typeof source; label: string; count: number }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "omnivoice", label: "OmniVoice", count: omnivoiceCount },
    { id: "fish-speech", label: "Fish Speech", count: fishSpeechCount },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Library className="h-4 w-4" />
          Voice preset
        </Label>
        <div className="flex-1 min-w-[180px] max-w-sm">
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={`Search ${totalCount} voices...`}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Source filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSourceChange(t.id)}
            className={`h-6 px-2 rounded-md text-[11px] font-medium border transition-colors ${
              source === t.id
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent/40"
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70">· {t.count}</span>
          </button>
        ))}
        {fishSpeechLoading && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            loading Fish Speech voices…
          </span>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <VoiceAvatar id={selected.id} initials={selected.initials} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{selected.name}</p>
              <SourceBadge preset={selected} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {selected.tagline}
            </p>
            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
              {selected.fishSpeechVoiceId
                ? `Bridged via OmniVoice clone · ref: ${selected.fishSpeechVoiceId}`
                : attrSummary(selected)}
            </p>
          </div>
          <OmniVoiceSampleButton preset={selected} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {presets.map((v) => {
          const isSel = selected?.id === v.id;
          return (
            <div
              key={v.id}
              className={`relative flex items-center gap-2 rounded-md border p-2 text-left transition-colors cursor-pointer ${
                isSel
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
              }`}
              onClick={() => onSelect(v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(v);
                }
              }}
            >
              <VoiceAvatar id={v.id} initials={v.initials} size="sm" animated={false} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{v.name}</p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {v.tagline}
                </p>
              </div>
              <SourceBadge preset={v} compact />
              <OmniVoiceSampleButton preset={v} size="xs" />
            </div>
          );
        })}
        {presets.length === 0 && (
          <p className="col-span-full text-xs text-muted-foreground text-center py-6">
            No presets match your search
          </p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        OmniVoice presets use the{" "}
        <code className="text-[10px] mx-0.5 px-1 rounded bg-muted">_design_fn</code>
        endpoint; Fish Speech voices bridge through{" "}
        <code className="text-[10px] mx-0.5 px-1 rounded bg-muted">_clone_fn</code>
        with the local reference WAV.
      </p>
    </div>
  );
}

function SourceBadge({ preset, compact = false }: { preset: OmniVoicePreset; compact?: boolean }) {
  const isFish = !!preset.fishSpeechVoiceId;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
        isFish
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20"
      } ${compact ? "" : "ml-1"}`}
      title={
        isFish
          ? "Fish Speech reference voice routed through OmniVoice clone"
          : "OmniVoice attribute preset"
      }
    >
      {isFish ? "FS" : "OV"}
    </span>
  );
}

function CharacterPanel({
  text,
  characters,
  segments,
  assignments,
  segmentCountByCharacter,
  identifying,
  onIdentify,
  onClear,
  onAssign,
  multiProgress,
  multiErrors,
  availablePresets,
}: {
  text: string;
  characters: ScriptCharacter[] | null;
  segments: ScriptSegment[] | null;
  assignments: CharacterAssignments;
  segmentCountByCharacter: Record<string, number>;
  identifying: boolean;
  onIdentify: () => void;
  onClear: () => void;
  onAssign: (charName: string, preset: OmniVoicePreset) => void;
  multiProgress: { done: number; total: number; phase: "generating" | "merging" } | null;
  multiErrors: string[];
  availablePresets: OmniVoicePreset[];
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Multi-voice script
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Claude splits your script into per-character lines. Assign an
            OmniVoice preset to each character, then we synthesize and merge
            every line into one audio file.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {characters && (
            <Button variant="ghost" size="sm" onClick={onClear} disabled={identifying}>
              <X className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            variant={characters ? "outline" : "default"}
            onClick={onIdentify}
            disabled={identifying || !text.trim()}
            className="gap-1.5"
          >
            {identifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {characters ? "Re-identify" : "Identify Characters"}
          </Button>
        </div>
      </div>

      {/* No characters yet — empty state */}
      {!characters && (
        <div className="rounded-md border border-dashed border-border/70 p-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            Paste a script above, then click <strong>Identify Characters</strong>.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Works with plain dialogue (<code>Alice: …</code>), prose with
            narration, or mixed formats.
          </p>
        </div>
      )}

      {/* Characters identified */}
      {characters && segments && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <strong className="text-foreground">{characters.length}</strong>{" "}
              character{characters.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              <strong className="text-foreground">{segments.length}</strong>{" "}
              segment{segments.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-2">
            {characters.map((c) => {
              const assigned = assignments[c.name];
              const lineCount = segmentCountByCharacter[c.name] || 0;
              return (
                <CharacterRow
                  key={c.name}
                  character={c}
                  lineCount={lineCount}
                  assigned={assigned}
                  onAssign={(p) => onAssign(c.name, p)}
                  availablePresets={availablePresets}
                />
              );
            })}
          </div>

          {/* Multi-voice progress */}
          {multiProgress && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {multiProgress.phase === "merging"
                ? `Merging ${multiProgress.done} audio clips into one file…`
                : `Generating segment ${multiProgress.done} / ${multiProgress.total}`}
              {multiErrors.length > 0 &&
                ` · ${multiErrors.length} failed so far`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterRow({
  character,
  lineCount,
  assigned,
  onAssign,
  availablePresets,
}: {
  character: ScriptCharacter;
  lineCount: number;
  assigned: OmniVoicePreset | null | undefined;
  onAssign: (preset: OmniVoicePreset) => void;
  availablePresets: OmniVoicePreset[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availablePresets;
    return availablePresets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        (p.fishSpeechVoiceId || "").toLowerCase().includes(q) ||
        (p.language || "").toLowerCase().includes(q) ||
        (p.country || "").toLowerCase().includes(q)
    );
  }, [availablePresets, search]);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2">
      <div className="flex items-center gap-3">
        <VoiceAvatar
          id={`char-${character.name}`}
          initials={character.name.slice(0, 2).toUpperCase()}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{character.name}</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {lineCount} line{lineCount === 1 ? "" : "s"}
            </Badge>
            {assigned && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                <Check className="h-2.5 w-2.5 mr-0.5" />
                {assigned.name}
              </Badge>
            )}
            {assigned && <SourceBadge preset={assigned} compact />}
          </div>
          {character.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {character.description}
            </p>
          )}
        </div>
        {assigned && <OmniVoiceSampleButton preset={assigned} />}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 gap-1"
        >
          {open ? "Hide" : "Pick voice"}
        </Button>
      </div>

      {open && (
        <div className="pt-1 border-t border-border/60 space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${availablePresets.length} voices...`}
            className="h-7 text-xs"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {filtered.map((p) => {
            const isSel = assigned?.id === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex items-center gap-2 rounded-md border p-2 text-left transition-colors cursor-pointer ${
                  isSel
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
                }`}
                onClick={() => {
                  onAssign(p);
                  setOpen(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAssign(p);
                    setOpen(false);
                  }
                }}
              >
                <VoiceAvatar id={p.id} initials={p.initials} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{p.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {p.tagline}
                  </p>
                </div>
                <SourceBadge preset={p} compact />
                <OmniVoiceSampleButton preset={p} size="xs" />
                {isSel && <Check className="h-3 w-3 text-primary shrink-0" />}
              </div>
            );
          })}
            {filtered.length === 0 && (
              <p className="col-span-full text-[11px] text-muted-foreground text-center py-4">
                No voices match &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a preset into the attribute payload expected by /api/omnivoice/tts. */
function presetToAttrs(p: OmniVoicePreset) {
  return {
    gender: p.gender,
    age: p.age,
    pitch: p.pitch,
    style: p.style,
    accent: p.accent,
    dialect: p.dialect,
  };
}

/** Pretty short-form attribute summary like "Female · Young Adult · American". */
function attrSummary(p: OmniVoicePreset): string {
  return [
    p.gender?.split(" / ")[0],
    p.age?.split(" / ")[0],
    p.pitch?.split(" / ")[0],
    p.accent?.split(" / ")[0],
    p.style?.split(" / ")[0],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Base64 data URL of a file. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Heuristic: pick a reasonable default preset for a newly-identified character
 * based on their name. Falls back to cycling through the preset list so every
 * character gets a different default voice out of the box.
 */
function guessPresetForCharacter(
  c: ScriptCharacter,
  index: number
): OmniVoicePreset {
  const name = c.name.toLowerCase();
  const desc = (c.description || "").toLowerCase();
  const hay = `${name} ${desc}`;

  if (/narrator|narration/.test(hay)) {
    return findPreset("ov-us-deep-male") || OMNIVOICE_PRESETS[1];
  }
  if (/grandpa|grandfather|old man|elder/.test(hay)) {
    return findPreset("ov-us-grandpa") || OMNIVOICE_PRESETS[3];
  }
  if (/grandma|grandmother|elderly woman|old woman/.test(hay)) {
    return findPreset("ov-elderly-wise") || OMNIVOICE_PRESETS[15];
  }
  if (/child|kid|boy|girl/.test(hay)) {
    if (/girl/.test(hay)) return findPreset("ov-child-girl") || OMNIVOICE_PRESETS[11];
    return findPreset("ov-child-boy") || OMNIVOICE_PRESETS[12];
  }
  if (/villain|evil|menacing|dark/.test(hay)) {
    return findPreset("ov-villain") || OMNIVOICE_PRESETS[14];
  }
  if (/british|uk|english/.test(hay)) {
    if (/woman|female|lady|girl/.test(hay)) {
      return findPreset("ov-uk-classy-female") || OMNIVOICE_PRESETS[4];
    }
    return findPreset("ov-uk-deep-male") || OMNIVOICE_PRESETS[5];
  }
  if (/indian/.test(hay)) {
    return (
      (/woman|female|lady/.test(hay)
        ? findPreset("ov-in-female-narrator")
        : findPreset("ov-in-male-young")) || OMNIVOICE_PRESETS[7]
    );
  }
  if (/whisper/.test(hay)) {
    return findPreset("ov-whisper-female") || OMNIVOICE_PRESETS[13];
  }

  // Cycle defaults: alternate male / female for distinctness across rows
  const cycle = index % 2 === 0
    ? ["ov-us-warm-female", "ov-uk-classy-female", "ov-au-female", "ov-teen-bright"]
    : ["ov-us-deep-male", "ov-uk-deep-male", "ov-ca-male", "ov-in-male-young"];
  const id = cycle[Math.floor(index / 2) % cycle.length];
  return findPreset(id) || OMNIVOICE_PRESETS[index % OMNIVOICE_PRESETS.length];
}

function findPreset(id: string): OmniVoicePreset | undefined {
  return OMNIVOICE_PRESETS.find((p) => p.id === id);
}
