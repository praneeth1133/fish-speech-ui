"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VoiceCard, type EnrichedVoice } from "@/components/voice-card";
import { VoiceRow } from "@/components/voice-row";
import {
  VoiceRecorder,
  type VoiceRecorderState,
} from "@/components/voice-recorder";
import {
  Plus,
  Trash2,
  Mic,
  Upload,
  Library,
  Search,
  X,
  Globe,
  Sparkles,
  Clock,
  Flame,
  Languages,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, COUNTRIES, AGE_BUCKETS, VOICE_NAME_MAP } from "@/lib/voice-names";
import { audioBufferToWav } from "@/lib/wav-encoder";
import { listHistory } from "@/lib/idb";
import { useFavoritesStore } from "@/lib/favorites-store";

interface DBVoice {
  id: string;
  name: string;
  description: string;
  reference_audio_path: string | null;
  reference_text: string;
  created_at: string;
  is_backend_ref?: boolean;
  displayName?: string;
  language?: string;
  gender?: string;
  avatarInitials?: string;
  tagline?: string;
  previewUrl?: string;
  country?: string;
  countryCode?: string;
  ageBucket?: "kid" | "young" | "adult" | "older";
  age?: number | null;
  source?: "fish-speech-builtin" | "vctk";
  /** File mtime (epoch seconds) of the reference on the backend */
  mtime?: number;
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<DBVoice[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [history, setHistory] = useState<Array<{ voice_id: string | null }>>([]);

  // Record dialog state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [recordName, setRecordName] = useState("");
  const [recordDescription, setRecordDescription] = useState("");
  const [recording, setRecording] = useState<VoiceRecorderState>({
    wavBlob: null,
    referenceText: "",
    durationSeconds: 0,
  });

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Telugu (Indic Parler-TTS) voice-creation dialog state.  Parler-TTS doesn't
  // clone audio — instead we pick a built-in speaker ID and describe the
  // voice in natural language, which the model conditions on.
  const [isTeluguOpen, setIsTeluguOpen] = useState(false);
  const [teluguName, setTeluguName] = useState("");
  const [teluguSpeaker, setTeluguSpeaker] = useState<string>("Prakash");
  const [teluguDescription, setTeluguDescription] = useState<string>("");
  const [teluguGender, setTeluguGender] = useState<"male" | "female">("male");
  const [teluguAge, setTeluguAge] = useState<"kid" | "young" | "adult" | "older">("adult");

  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedAge, setSelectedAge] = useState("all");

  const fetchVoices = useCallback(async () => {
    const res = await fetch("/api/voices");
    const data = await res.json();
    setVoices(data.voices || []);
    setReferences(data.references || []);
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  // Load recent generation history once for the "Most Used" section.
  useEffect(() => {
    listHistory(500)
      .then((items) => setHistory(items.map((h) => ({ voice_id: h.voice_id }))))
      .catch(() => setHistory([]));
  }, []);

  // Convert any audio blob to WAV so the Fish Speech backend can always read it.
  // The backend uses torchaudio which may not support webm/mp3/ogg depending on
  // the ffmpeg build. WAV always works.
  const ensureWav = async (blob: Blob): Promise<Blob> => {
    // If it's already a WAV, skip conversion
    if (blob.type === "audio/wav" || blob.type === "audio/wave") return blob;
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      await ctx.close();
      return audioBufferToWav(decoded);
    } catch (err) {
      console.warn("WAV conversion failed, sending original:", err);
      return blob; // fallback: send as-is and hope the backend handles it
    }
  };

  // Shared submit logic
  const submitVoice = async (
    name: string,
    description: string,
    referenceText: string,
    audioBlob: Blob,
    _audioFileName: string
  ) => {
    setIsCreating(true);
    try {
      // Always convert to WAV for backend compatibility
      const wavBlob = await ensureWav(audioBlob);
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description);
      formData.append("reference_text", referenceText);
      formData.append(
        "audio",
        new File([wavBlob], "voice.wav", { type: "audio/wav" })
      );
      const res = await fetch("/api/voices", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success("Voice created", {
        description: `"${name.trim()}" is ready to use in the voice picker.`,
      });
      // Refresh voice list immediately
      await fetchVoices();
      return true;
    } catch (err) {
      toast.error("Failed to create voice", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleRecordCreate = async () => {
    if (!recordName.trim() || !recording.wavBlob) return;
    const ok = await submitVoice(
      recordName,
      recordDescription,
      recording.referenceText,
      recording.wavBlob,
      "recording.wav"
    );
    if (ok) {
      setIsRecordOpen(false);
      setRecordName("");
      setRecordDescription("");
      setRecording({ wavBlob: null, referenceText: "", durationSeconds: 0 });
    }
  };

  // Speaker catalogue exposed in the Telugu dialog. Native Telugu speakers
  // (Prakash / Lalitha / Kiran) are at the top and flagged Recommended; the
  // two cross-lingual options cover deep/elder character voices.
  const TELUGU_SPEAKERS: Array<{
    id: string;
    label: string;
    recommended: boolean;
    defaultGender: "male" | "female";
    defaultAge: "kid" | "young" | "adult" | "older";
    defaultDescription: string;
  }> = [
    {
      id: "Prakash",
      label: "Prakash — native Telugu, male adult",
      recommended: true,
      defaultGender: "male",
      defaultAge: "adult",
      defaultDescription:
        "Prakash speaks clearly at a moderate pace, with a close studio recording and no background noise.",
    },
    {
      id: "Lalitha",
      label: "Lalitha — native Telugu, female adult",
      recommended: true,
      defaultGender: "female",
      defaultAge: "adult",
      defaultDescription:
        "Lalitha speaks in a graceful, clear, and measured voice, with close studio quality.",
    },
    {
      id: "Kiran",
      label: "Kiran — native Telugu, male young",
      recommended: true,
      defaultGender: "male",
      defaultAge: "young",
      defaultDescription:
        "Kiran speaks clearly and evenly at moderate pace, youthful and neutral, clean studio recording.",
    },
    {
      id: "Jaideep",
      label: "Jaideep — cross-lingual, deep male",
      recommended: false,
      defaultGender: "male",
      defaultAge: "adult",
      defaultDescription:
        "The speaker has a very deep, resonant, gritty voice, speaking slowly and menacingly.",
    },
    {
      id: "Rahul",
      label: "Rahul — cross-lingual, gravitas elder",
      recommended: false,
      defaultGender: "male",
      defaultAge: "older",
      defaultDescription:
        "The speaker has a deep, weighty, slightly rough voice, speaking very slowly with gravitas.",
    },
  ];

  const handleTeluguSpeakerChange = (speakerId: string) => {
    setTeluguSpeaker(speakerId);
    const match = TELUGU_SPEAKERS.find((s) => s.id === speakerId);
    if (match) {
      // Only auto-fill description if the user hasn't started typing their own.
      if (!teluguDescription.trim() ||
          TELUGU_SPEAKERS.some((s) => s.defaultDescription === teluguDescription)) {
        setTeluguDescription(match.defaultDescription);
      }
      setTeluguGender(match.defaultGender);
      setTeluguAge(match.defaultAge);
    }
  };

  const handleTeluguCreate = async () => {
    if (!teluguName.trim() || !teluguDescription.trim()) return;
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", teluguName.trim());
      formData.append("engine", "indic-parler");
      formData.append("speaker_id", teluguSpeaker);
      formData.append("description", teluguDescription.trim());
      formData.append("language", "telugu");
      formData.append("gender", teluguGender);
      formData.append("age_bucket", teluguAge);
      const res = await fetch("/api/voices", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success("Telugu voice created", {
        description: `"${teluguName.trim()}" is ready. Click play to generate a preview.`,
      });
      await fetchVoices();
      setIsTeluguOpen(false);
      setTeluguName("");
      setTeluguSpeaker("Prakash");
      setTeluguDescription("");
      setTeluguGender("male");
      setTeluguAge("adult");
    } catch (err) {
      toast.error("Failed to create Telugu voice", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadCreate = async () => {
    if (!uploadName.trim() || !uploadFile || !uploadText.trim()) return;
    const ok = await submitVoice(
      uploadName,
      uploadDescription,
      uploadText,
      uploadFile,
      uploadFile.name
    );
    if (ok) {
      setIsUploadOpen(false);
      setUploadName("");
      setUploadDescription("");
      setUploadText("");
      setUploadFile(null);
    }
  };

  const handleDelete = async (id: string, refId?: string) => {
    try {
      await fetch("/api/voices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reference_id: refId }),
      });
      toast.success("Voice deleted");
      fetchVoices();
    } catch {
      toast.error("Failed to delete voice");
    }
  };

  // Separate DB voices and backend voices
  const dbVoices = voices.filter((v) => !v.is_backend_ref);
  const backendVoices = voices.filter((v) => v.is_backend_ref);

  // "New Voices" = 10 most recently added/updated references (by file mtime
  // on the backend). Sort descending so the newest is first.
  const newVoices = useMemo(() => {
    return [...backendVoices]
      .sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
      .slice(0, 10);
  }, [backendVoices]);

  // "Favorites" = voices marked with the heart icon, persisted per-device.
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const favoriteVoices = useMemo(() => {
    if (!favoriteIds.length) return [];
    const byName = new Map(backendVoices.map((v) => [v.name, v]));
    return favoriteIds
      .map((id) => byName.get(id))
      .filter((v): v is DBVoice => !!v);
  }, [backendVoices, favoriteIds]);

  // "Most Used" = top 10 voices by generation count (from history in IndexedDB).
  const mostUsedVoices = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const h of history) {
      const vid = h?.voice_id;
      if (vid) counts[vid] = (counts[vid] || 0) + 1;
    }
    return backendVoices
      .map((v) => ({ voice: v, count: counts[v.name] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((x) => x.voice);
  }, [backendVoices, history]);

  // Filter backend voices
  const filteredBackendVoices = backendVoices.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (v.displayName || v.name).toLowerCase().includes(q) ||
      (v.language || "").toLowerCase().includes(q) ||
      (v.country || "").toLowerCase().includes(q) ||
      (v.tagline || "").toLowerCase().includes(q);
    const matchesLanguage =
      selectedLanguage === "all" ||
      (v.language || "").toLowerCase() === selectedLanguage;
    const matchesGender =
      selectedGender === "all" || v.gender === selectedGender;
    const matchesCountry =
      selectedCountry === "all" || v.countryCode === selectedCountry;
    const matchesAge =
      selectedAge === "all" || v.ageBucket === selectedAge;
    return matchesSearch && matchesLanguage && matchesGender && matchesCountry && matchesAge;
  });

  const langCounts: Record<string, number> = { all: backendVoices.length };
  backendVoices.forEach((v) => {
    const l = (v.language || "").toLowerCase();
    langCounts[l] = (langCounts[l] || 0) + 1;
  });

  // Count per country — only show countries that actually have voices
  const countryCounts: Record<string, number> = { all: backendVoices.length };
  backendVoices.forEach((v) => {
    if (v.countryCode) countryCounts[v.countryCode] = (countryCounts[v.countryCode] || 0) + 1;
  });
  const visibleCountries = COUNTRIES.filter((c) => (countryCounts[c.code] || 0) > 0);

  const ageCounts: Record<string, number> = { all: backendVoices.length };
  backendVoices.forEach((v) => {
    if (v.ageBucket) ageCounts[v.ageBucket] = (ageCounts[v.ageBucket] || 0) + 1;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Voice Library</h2>
          <p className="text-sm text-muted-foreground">
            {backendVoices.length} voices available
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Upload Voice dialog */}
          <Dialog
            open={isUploadOpen}
            onOpenChange={(next) => {
              setIsUploadOpen(next);
              if (!next) {
                setUploadName("");
                setUploadDescription("");
                setUploadText("");
                setUploadFile(null);
              }
            }}
          >
            <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
              <Upload className="h-4 w-4" />
              Upload Voice
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload Voice Sample</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Voice Name</Label>
                    <Input
                      placeholder="e.g. Sarah"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      placeholder="Warm & professional"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Audio File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:border-primary/30 transition-colors">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                      className="hidden"
                      id="voice-upload"
                    />
                    <label
                      htmlFor="voice-upload"
                      className="cursor-pointer space-y-2"
                    >
                      <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {uploadFile
                          ? uploadFile.name
                          : "Click to upload audio (WAV, MP3, etc.)"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">
                        10–30 seconds of clear speech works best
                      </p>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Reference Text{" "}
                    <span className="text-muted-foreground font-normal">
                      — the exact words spoken in the audio
                    </span>
                  </Label>
                  <Textarea
                    placeholder="Type exactly what is spoken in the audio file..."
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <Button
                  onClick={handleUploadCreate}
                  disabled={
                    !uploadName.trim() ||
                    !uploadFile ||
                    !uploadText.trim() ||
                    isCreating
                  }
                  className="w-full"
                  size="lg"
                >
                  {isCreating ? "Saving voice…" : "Save Voice"}
                </Button>
                {(!uploadFile || !uploadText.trim()) && uploadName.trim() && (
                  <p className="text-[11px] text-muted-foreground text-center -mt-2">
                    Upload audio + add reference text to enable Save
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Telugu Voice dialog (Indic Parler-TTS — no audio cloning) */}
          <Dialog
            open={isTeluguOpen}
            onOpenChange={(next) => {
              setIsTeluguOpen(next);
              if (!next) {
                setTeluguName("");
                setTeluguSpeaker("Prakash");
                setTeluguDescription("");
                setTeluguGender("male");
                setTeluguAge("adult");
              } else if (!teluguDescription) {
                // First open — prefill description from the default speaker.
                const defaultSpeaker = TELUGU_SPEAKERS.find((s) => s.id === "Prakash");
                if (defaultSpeaker) setTeluguDescription(defaultSpeaker.defaultDescription);
              }
            }}
          >
            <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
              <Languages className="h-4 w-4" />
              Telugu Voice
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Telugu Voice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">
                  Telugu uses AI4Bharat&apos;s Indic Parler-TTS — it doesn&apos;t clone audio.
                  Pick a built-in speaker and describe the delivery (pace, emotion, tone).
                </p>

                <div className="space-y-2">
                  <Label>Voice Name</Label>
                  <Input
                    placeholder="e.g. Arjun (Narrator)"
                    value={teluguName}
                    onChange={(e) => setTeluguName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Speaker</Label>
                  <select
                    value={teluguSpeaker}
                    onChange={(e) => handleTeluguSpeakerChange(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    {TELUGU_SPEAKERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}{s.recommended ? " · Recommended" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Voice Description{" "}
                    <span className="text-muted-foreground font-normal">
                      — pacing, emotion, recording quality
                    </span>
                  </Label>
                  <Textarea
                    placeholder="e.g. Prakash speaks calmly and clearly at a moderate pace, with close studio recording."
                    value={teluguDescription}
                    onChange={(e) => setTeluguDescription(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <select
                      value={teluguGender}
                      onChange={(e) => setTeluguGender(e.target.value as "male" | "female")}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <select
                      value={teluguAge}
                      onChange={(e) => setTeluguAge(e.target.value as typeof teluguAge)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="kid">Kid</option>
                      <option value="young">Young</option>
                      <option value="adult">Adult</option>
                      <option value="older">Older</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleTeluguCreate}
                  disabled={!teluguName.trim() || !teluguDescription.trim() || isCreating}
                  className="w-full"
                  size="lg"
                >
                  {isCreating ? "Saving voice…" : "Save Telugu Voice"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center -mt-2">
                  Preview will be generated the first time you play it (~30s on first load).
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Record Voice dialog */}
          <Dialog
            open={isRecordOpen}
            onOpenChange={(next) => {
              setIsRecordOpen(next);
              if (!next) {
                setRecordName("");
                setRecordDescription("");
                setRecording({
                  wavBlob: null,
                  referenceText: "",
                  durationSeconds: 0,
                });
              }
            }}
          >
            <DialogTrigger render={<Button className="gap-2" />}>
              <Mic className="h-4 w-4" />
              Record Voice
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Your Voice</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Voice Name</Label>
                    <Input
                      placeholder="My Voice"
                      value={recordName}
                      onChange={(e) => setRecordName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      placeholder="Warm & friendly"
                      value={recordDescription}
                      onChange={(e) => setRecordDescription(e.target.value)}
                    />
                  </div>
                </div>

                <VoiceRecorder onChange={setRecording} />

                <Button
                  onClick={handleRecordCreate}
                  disabled={
                    !recordName.trim() || !recording.wavBlob || isCreating
                  }
                  className="w-full"
                  size="lg"
                >
                  {isCreating ? "Saving voice…" : "Save Voice"}
                </Button>
                {!recording.wavBlob && recordName.trim() && (
                  <p className="text-[11px] text-muted-foreground text-center -mt-2">
                    Record a clip to enable Save
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Favorites (per-device, localStorage) */}
          {favoriteVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-400" fill="currentColor" />
                Favorites
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {favoriteVoices.length}
                </Badge>
              </h3>
              <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                {favoriteVoices.map((voice, i) => (
                  <VoiceRow
                    key={`fav-${voice.id}`}
                    voice={voice as EnrichedVoice}
                    isSelected={false}
                    onSelect={() => {
                      toast.info(`${voice.displayName || voice.name}`, {
                        description: "Go to Text to Speech to use this voice",
                        icon: "❤️",
                      });
                    }}
                    index={i}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Most Used section — top voices by generation count from local history */}
          {mostUsedVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                Most Used
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {mostUsedVoices.length}
                </Badge>
              </h3>
              <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                {mostUsedVoices.map((voice, i) => (
                  <VoiceRow
                    key={`mu-${voice.id}`}
                    voice={voice as EnrichedVoice}
                    isSelected={false}
                    onSelect={() => {
                      toast.info(`${voice.displayName || voice.name}`, {
                        description: "Go to Text to Speech to use this voice",
                        icon: "🎤",
                      });
                    }}
                    index={i}
                  />
                ))}
              </div>
            </section>
          )}

          {/* New Voices section — latest backend references by mtime */}
          {newVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                New Voices
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {newVoices.length}
                </Badge>
              </h3>
              <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                {newVoices.map((voice, i) => (
                  <VoiceRow
                    key={voice.id}
                    voice={voice as EnrichedVoice}
                    isSelected={false}
                    onSelect={() => {
                      toast.info(
                        `${voice.displayName || voice.name}`,
                        {
                          description:
                            "Go to Text to Speech to use this voice",
                          icon: "🎤",
                        }
                      );
                    }}
                    index={i}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Custom voices section (dbVoices — voices not registered as backend refs) */}
          {dbVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Custom Voices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dbVoices.map((voice) => {
                  const refId = voice.name
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]/g, "-");
                  return (
                    <motion.div
                      key={voice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative rounded-xl border border-border bg-card p-4 hover:bg-accent transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Mic className="h-4 w-4 text-foreground/60" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {voice.name}
                            </p>
                            {voice.description && (
                              <p className="text-xs text-foreground/40">
                                {voice.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-foreground/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => handleDelete(voice.id, refId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {references.includes(refId) && (
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          Registered
                        </Badge>
                      )}
                      {voice.reference_text && (
                        <p className="text-[11px] text-foreground/30 mt-2 line-clamp-2">
                          &ldquo;{voice.reference_text}&rdquo;
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pre-loaded voices section */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-foreground/50 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              All Voices
            </h3>

            {/* Search + Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search voices..."
                  className="pl-9 bg-muted/50 border-border text-foreground placeholder:text-foreground/30 h-9 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Language + Gender row */}
              <div className="flex items-center gap-1 flex-wrap">
                {["all", ...LANGUAGES].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedLanguage === lang
                        ? "bg-accent text-foreground"
                        : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                    }`}
                  >
                    {lang === "all"
                      ? "All"
                      : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    <span className="ml-1 text-[10px] opacity-60">
                      {langCounts[lang] || 0}
                    </span>
                  </button>
                ))}

                <span className="w-px h-4 bg-muted mx-1" />

                {(["all", "male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGender(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedGender === g
                        ? "bg-accent text-foreground"
                        : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                    }`}
                  >
                    {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}

                <span className="w-px h-4 bg-muted mx-1" />

                {/* Age buckets */}
                <button
                  type="button"
                  onClick={() => setSelectedAge("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    selectedAge === "all"
                      ? "bg-accent text-foreground"
                      : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                  }`}
                >
                  Any Age
                </button>
                {AGE_BUCKETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAge(a.id)}
                    title={a.hint}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedAge === a.id
                        ? "bg-accent text-foreground"
                        : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                    }`}
                  >
                    {a.label}
                    <span className="ml-1 text-[10px] opacity-60">
                      {ageCounts[a.id] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Country row */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedCountry("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    selectedCountry === "all"
                      ? "bg-accent text-foreground"
                      : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                  }`}
                >
                  🌐 All Countries
                  <span className="ml-1 text-[10px] opacity-60">
                    {countryCounts.all || 0}
                  </span>
                </button>
                {visibleCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setSelectedCountry(c.code)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedCountry === c.code
                        ? "bg-accent text-foreground"
                        : "bg-muted/50 text-foreground/40 hover:bg-accent hover:text-foreground/60"
                    }`}
                  >
                    <span className="mr-1">{c.flag}</span>
                    {c.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      {countryCounts[c.code] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice list (ElevenLabs-style rows) */}
            <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
              <AnimatePresence mode="popLayout">
                {filteredBackendVoices.map((voice, i) => (
                  <VoiceRow
                    key={voice.id}
                    voice={voice as EnrichedVoice}
                    isSelected={false}
                    onSelect={() => {
                      toast.info(
                        `${voice.displayName || voice.name}`,
                        {
                          description:
                            "Go to Text to Speech to use this voice",
                          icon: "🎤",
                        }
                      );
                    }}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>

            {filteredBackendVoices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-foreground/30">
                <Search className="h-8 w-8 mb-2" />
                <p className="text-sm">No voices match your filters</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
