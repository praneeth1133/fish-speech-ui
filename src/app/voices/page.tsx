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
} from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, COUNTRIES, AGE_BUCKETS, VOICE_NAME_MAP } from "@/lib/voice-names";

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
  ageBucket?: "young" | "adult" | "older";
  age?: number | null;
  source?: "fish-speech-builtin" | "vctk";
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<DBVoice[]>([]);
  const [references, setReferences] = useState<string[]>([]);

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

  // Shared submit logic
  const submitVoice = async (
    name: string,
    description: string,
    referenceText: string,
    audioBlob: Blob,
    audioFileName: string
  ) => {
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description);
      formData.append("reference_text", referenceText);
      formData.append(
        "audio",
        new File([audioBlob], audioFileName, {
          type: audioBlob.type || "audio/wav",
        })
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

  // Identify "new" voices = voices NOT in the hardcoded VOICE_NAME_MAP
  // These are custom or recently added via record/upload
  const newVoices = useMemo(() => {
    return backendVoices
      .filter((v) => {
        const refName = v.name;
        return !(refName in VOICE_NAME_MAP);
      })
      .slice(0, 10);
  }, [backendVoices]);

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
          {/* New Voices section — shows latest custom voices not in the hardcoded map */}
          {newVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                New Voices
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {newVoices.length}
                </Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {newVoices.map((voice, i) => (
                  <VoiceCard
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

            {/* Voice grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {filteredBackendVoices.map((voice, i) => (
                  <VoiceCard
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
