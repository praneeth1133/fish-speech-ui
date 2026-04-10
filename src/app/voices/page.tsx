"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Library,
  Search,
  X,
  Globe,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, COUNTRIES, AGE_BUCKETS } from "@/lib/voice-names";

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
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recording, setRecording] = useState<VoiceRecorderState>({
    wavBlob: null,
    referenceText: "",
    durationSeconds: 0,
  });
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

  const handleCreate = async () => {
    if (!name.trim() || !recording.wavBlob) return;
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description);
      formData.append("reference_text", recording.referenceText);
      formData.append(
        "audio",
        new File([recording.wavBlob], "recording.wav", { type: "audio/wav" })
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
        description: `"${name.trim()}" is ready to use.`,
      });
      setIsOpen(false);
      setName("");
      setDescription("");
      setRecording({ wavBlob: null, referenceText: "", durationSeconds: 0 });
      fetchVoices();
    } catch (err) {
      toast.error("Failed to create voice", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsCreating(false);
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Voice Library</h2>
          <p className="text-sm text-muted-foreground">
            {backendVoices.length} pre-loaded voices across {LANGUAGES.length} languages
          </p>
        </div>
        <Dialog
          open={isOpen}
          onOpenChange={(next) => {
            setIsOpen(next);
            if (!next) {
              // Reset form on close
              setName("");
              setDescription("");
              setRecording({
                wavBlob: null,
                referenceText: "",
                durationSeconds: 0,
              });
            }
          }}
        >
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Record New Voice
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Warm & friendly"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <VoiceRecorder onChange={setRecording} />

              <Button
                onClick={handleCreate}
                disabled={!name.trim() || !recording.wavBlob || isCreating}
                className="w-full"
                size="lg"
              >
                {isCreating ? "Saving voice…" : "Save Voice"}
              </Button>
              {!recording.wavBlob && name.trim() && (
                <p className="text-[11px] text-muted-foreground text-center -mt-2">
                  Record a clip to enable Save
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Custom voices section */}
          {dbVoices.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground/50 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Custom Voices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dbVoices.map((voice) => {
                  const refId = voice.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
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
                            <p className="text-sm font-semibold text-foreground">{voice.name}</p>
                            {voice.description && (
                              <p className="text-xs text-foreground/40">{voice.description}</p>
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
              Pre-loaded Voices
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
                    {lang === "all" ? "All" : lang.charAt(0).toUpperCase() + lang.slice(1)}
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
                  <span className="ml-1 text-[10px] opacity-60">{countryCounts.all || 0}</span>
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
                    <span className="ml-1 text-[10px] opacity-60">{countryCounts[c.code] || 0}</span>
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
                      toast.info(`${voice.displayName || voice.name}`, {
                        description: "Go to Text to Speech to use this voice",
                        icon: "🎤",
                      });
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
