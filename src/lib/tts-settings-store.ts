import { create } from "zustand";
import { useQueueStore } from "./queue-store";
import { toast } from "sonner";
import type { EnrichedVoice } from "@/components/voice-card";

/**
 * Derive a short slug from the source text or character list. Used as the
 * default download name for merged multi-voice output so users don't get
 * `fish-speech-multi-abc123.wav` but something like
 * `little-red-riding-hood.wav` based on the first line.
 */
function deriveStoryTitle(
  text: string,
  characters: ScriptCharacter[] | null
): string {
  // Prefer the first meaningful line of the script
  const firstLine = text.split(/\n|\./).map((s) => s.trim()).find((s) => s.length > 6);
  if (firstLine) {
    const words = firstLine.split(/\s+/).slice(0, 7).join(" ");
    const slug = words.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug.length > 0) return slug.slice(0, 50);
  }
  // Fallback: join character names
  if (characters && characters.length > 0) {
    return characters
      .map((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
      .filter(Boolean)
      .join("-")
      .slice(0, 50);
  }
  return "multi-voice";
}

export interface ScriptCharacter {
  name: string;
  description: string;
}

export interface ScriptSegment {
  character: string;
  text: string;
}

export interface CharacterVoiceAssignment {
  /** null means use the default voice */
  voice_id: string | null;
  voice_name: string;
}

/**
 * Which TTS engine the user has selected for the main Text-to-Speech page.
 * - "fish-speech": Fish Speech S2-Pro (default) — general multilingual TTS with
 *   voice cloning. Talks to /api/tts → backend /v1/tts.
 * - "indic-parler": Indic Parler-TTS (Telugu) — description-based Telugu voices.
 *   Talks to /api/v1/telugu/tts and only accepts Telugu voices.
 */
export type EngineId = "fish-speech" | "indic-parler";

export const ENGINE_LABELS: Record<EngineId, string> = {
  "fish-speech": "Fish Speech S2 Pro",
  "indic-parler": "Indic Parler-TTS (Telugu)",
};

interface TTSSettingsStore {
  text: string;
  setText: (t: string) => void;
  /** Active TTS engine for everything this store drives. Persisted via
   * localStorage in the provider so user selection survives reloads. */
  engine: EngineId;
  setEngine: (e: EngineId) => void;
  selectedVoice: string;
  selectedVoiceData: EnrichedVoice | null;
  setSelectedVoice: (id: string) => void;
  setSelectedVoiceData: (v: EnrichedVoice | null) => void;
  format: string;
  setFormat: (f: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  topP: number;
  setTopP: (v: number) => void;
  repetitionPenalty: number;
  setRepetitionPenalty: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  chunkLength: number;
  setChunkLength: (v: number) => void;
  isGenerating: boolean;
  isAnnotating: boolean;
  isIdentifying: boolean;

  /** Parsed script characters, null until `identifyCharacters` is run */
  characters: ScriptCharacter[] | null;
  /** Ordered segments with character attribution */
  segments: ScriptSegment[] | null;
  /** Character name -> assigned voice */
  characterAssignments: Record<string, CharacterVoiceAssignment>;
  /** When true, the final merged audio has each character's volume normalized
   * to a common RMS level. ON by default to avoid the "one voice louder than
   * the rest" problem across multi-voice generations. */
  levelCharacterVolumes: boolean;
  setLevelCharacterVolumes: (v: boolean) => void;

  generate: () => Promise<void>;
  generateExpressions: () => Promise<void>;
  identifyCharacters: () => Promise<void>;
  clearCharacters: () => void;
  setCharacterVoice: (
    character: string,
    voice_id: string | null,
    voice_name: string
  ) => void;
  generateMultiVoice: () => Promise<void>;
}

// Hydrate engine from localStorage on mount so it survives page reloads.
function readStoredEngine(): EngineId {
  if (typeof localStorage === "undefined") return "fish-speech";
  const v = localStorage.getItem("tts-engine");
  return v === "indic-parler" ? "indic-parler" : "fish-speech";
}

export const useTTSSettingsStore = create<TTSSettingsStore>((set, get) => ({
  text: "",
  setText: (t) => set({ text: t }),
  engine: readStoredEngine(),
  setEngine: (e) => {
    set({ engine: e });
    try {
      localStorage.setItem("tts-engine", e);
    } catch {
      /* storage disabled — fine */
    }
    // Switching engines invalidates the current voice unless it's compatible
    // (Telugu voices are `te-*`; Fish Speech covers everything else).
    const st = get();
    if (st.selectedVoiceData) {
      const isTeluguVoice =
        st.selectedVoiceData.name?.startsWith("te-") ||
        (st.selectedVoiceData.language || "").toLowerCase() === "telugu";
      const wantsTelugu = e === "indic-parler";
      if (isTeluguVoice !== wantsTelugu) {
        // Drop the voice so the user is forced to pick a compatible one.
        set({ selectedVoice: "default", selectedVoiceData: null });
      }
    }
  },
  selectedVoice: "default",
  selectedVoiceData: null,
  setSelectedVoice: (id) => set({ selectedVoice: id }),
  setSelectedVoiceData: (v) => set({ selectedVoiceData: v }),
  format: "wav",
  setFormat: (f) => set({ format: f }),
  temperature: 0.8,
  setTemperature: (v) => set({ temperature: v }),
  topP: 0.8,
  setTopP: (v) => set({ topP: v }),
  repetitionPenalty: 1.1,
  setRepetitionPenalty: (v) => set({ repetitionPenalty: v }),
  maxTokens: 1024,
  setMaxTokens: (v) => set({ maxTokens: v }),
  chunkLength: 200,
  setChunkLength: (v) => set({ chunkLength: v }),
  isGenerating: false,
  isAnnotating: false,
  isIdentifying: false,

  characters: null,
  segments: null,
  characterAssignments: {},
  levelCharacterVolumes: true,
  setLevelCharacterVolumes: (v) => set({ levelCharacterVolumes: v }),

  generateExpressions: async () => {
    const state = get();
    if (!state.text.trim() || state.isAnnotating) return;

    set({ isAnnotating: true });
    try {
      const res = await fetch("/api/generate-expressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: state.text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { annotatedText } = await res.json();
      set({ text: annotatedText });
      toast.success("Expressions added", {
        description: "Review the tags, then generate speech.",
      });
    } catch (e) {
      toast.error("Failed to generate expressions", {
        description: e instanceof Error ? e.message : "An error occurred",
      });
    } finally {
      set({ isAnnotating: false });
    }
  },

  identifyCharacters: async () => {
    const state = get();
    if (!state.text.trim() || state.isIdentifying) return;

    set({ isIdentifying: true });
    try {
      const res = await fetch("/api/identify-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: state.text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { characters, segments } = (await res.json()) as {
        characters: ScriptCharacter[];
        segments: ScriptSegment[];
      };

      // Initialize assignments to default voice for each character
      const assignments: Record<string, CharacterVoiceAssignment> = {};
      for (const c of characters) {
        assignments[c.name] = { voice_id: null, voice_name: "Default" };
      }

      set({
        characters,
        segments,
        characterAssignments: assignments,
      });

      toast.success(`Found ${characters.length} character${characters.length === 1 ? "" : "s"}`, {
        description: `Assign a voice to each and generate.`,
      });
    } catch (e) {
      toast.error("Failed to identify characters", {
        description: e instanceof Error ? e.message : "An error occurred",
      });
    } finally {
      set({ isIdentifying: false });
    }
  },

  clearCharacters: () => {
    set({ characters: null, segments: null, characterAssignments: {} });
  },

  setCharacterVoice: (character, voice_id, voice_name) => {
    set((s) => ({
      characterAssignments: {
        ...s.characterAssignments,
        [character]: { voice_id, voice_name },
      },
    }));
  },

  generateMultiVoice: async () => {
    const state = get();
    if (!state.segments || state.segments.length === 0) return;

    const batch_id = crypto.randomUUID();
    const total = state.segments.length;

    // Derive a batch title from the first several words of the source text so
    // the merged download gets a human-readable name (e.g., "little-red-riding-hood").
    const batch_title = deriveStoryTitle(state.text, state.characters);

    for (let i = 0; i < state.segments.length; i++) {
      const seg = state.segments[i];
      const assignment = state.characterAssignments[seg.character] || {
        voice_id: null,
        voice_name: "Default",
      };

      useQueueStore.getState().addJob({
        text: seg.text,
        voice_id: assignment.voice_id || undefined,
        voice_name: assignment.voice_name,
        format: state.format,
        engine: state.engine,
        temperature: state.temperature,
        top_p: state.topP,
        repetition_penalty: state.repetitionPenalty,
        max_new_tokens: state.maxTokens,
        chunk_length: state.chunkLength,
        batch_id,
        batch_order: i,
        batch_size: total,
        character: seg.character,
        batch_title,
        batch_normalize: state.levelCharacterVolumes,
      });
    }

    toast.success(`Queued ${total} segment${total === 1 ? "" : "s"}`, {
      description:
        "Segments will generate one-by-one and auto-combine when done.",
    });

    // Clear script + character state; leave queue alone
    set({
      text: "",
      characters: null,
      segments: null,
      characterAssignments: {},
    });
  },

  generate: async () => {
    const state = get();
    const fullText = state.text.trim();
    if (!fullText) return;

    set({ isGenerating: true });
    try {
      let voiceId: string | undefined;
      let voiceName = "Default";
      const voice = state.selectedVoiceData;

      if (state.selectedVoice !== "default" && voice) {
        voiceId = voice.is_backend_ref
          ? voice.name
          : voice.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
        voiceName = voice.displayName || voice.name;
      }

      // Only split when a single voice would clearly exceed Vercel's
      // serverless budget. Fish Speech runs at roughly real-time on a
      // consumer GPU, and Vercel Hobby with Fluid Compute allows up to
      // 300 s per invocation. Two things matter here:
      //
      //   1. Expression tags like [neutral] / [excited] / [dramatic pause]
      //      inflate raw character count significantly but Fish Speech
      //      strips them before synthesis — so a 1000-char tagged story
      //      often becomes ~600-700 chars of actual speech (~45 s of audio).
      //   2. The Fish Speech backend chunks input internally by chunk_length
      //      (default 200), so we don't need to chunk ourselves for
      //      quality — only to keep each HTTP round-trip short enough to
      //      complete inside the Vercel function window.
      //
      // 1500 chars is our practical ceiling: ~90 s of generation at
      // real-time, safe margin under the 300 s cap, and it keeps typical
      // short stories, dialogues, and single-minute monologues as one
      // seamless job.
      const MAX_SINGLE_REQUEST_CHARS = 1500;
      const chunks =
        fullText.length > MAX_SINGLE_REQUEST_CHARS
          ? chunkTextBySentence(fullText, MAX_SINGLE_REQUEST_CHARS)
          : [fullText];

      if (chunks.length === 1) {
        useQueueStore.getState().addJob({
          text: chunks[0],
          format: state.format,
          engine: state.engine,
          voice_id: voiceId,
          voice_name: voiceName,
          temperature: state.temperature,
          top_p: state.topP,
          repetition_penalty: state.repetitionPenalty,
          max_new_tokens: state.maxTokens,
          chunk_length: state.chunkLength,
        });
        toast.success("Added to queue", {
          description: `"${chunks[0].slice(0, 50)}${chunks[0].length > 50 ? "..." : ""}" with ${voiceName}`,
        });
      } else {
        // Long text: queue each chunk as part of a single batch that the
        // queue-provider will auto-merge into one history entry.
        const batch_id = crypto.randomUUID();
        const batch_title = deriveStoryTitle(fullText, null);
        chunks.forEach((chunk, i) => {
          useQueueStore.getState().addJob({
            text: chunk,
            format: state.format,
            engine: state.engine,
            voice_id: voiceId,
            voice_name: voiceName,
            temperature: state.temperature,
            top_p: state.topP,
            repetition_penalty: state.repetitionPenalty,
            max_new_tokens: state.maxTokens,
            chunk_length: state.chunkLength,
            batch_id,
            batch_order: i,
            batch_size: chunks.length,
            batch_title,
            batch_normalize: false, // same voice for every chunk — no leveling needed
          });
        });
        toast.success(`Split into ${chunks.length} chunks`, {
          description:
            "Long text is generated chunk-by-chunk, then auto-combined into one audio file.",
        });
      }
      set({ text: "" });
    } catch (e) {
      toast.error("Failed to queue", {
        description: e instanceof Error ? e.message : "An error occurred",
      });
    } finally {
      set({ isGenerating: false });
    }
  },
}));

/**
 * Split a chunk of text into pieces, each no larger than `maxChars`, at
 * sentence boundaries when possible. Keeps bracketed expression tags
 * ([EXCITED], [PAUSE]) attached to the sentence they precede so the
 * model never loses context for a tag at a chunk boundary.
 */
function chunkTextBySentence(text: string, maxChars: number): string[] {
  // Split on sentence enders while keeping the terminator attached
  const parts = text
    .split(/([.!?])\s+/)
    .reduce<string[]>((acc, token, i) => {
      // Re-merge sentence + its terminator produced by the capture group
      if (i % 2 === 0) {
        acc.push(token);
      } else {
        const last = acc.pop() || "";
        acc.push((last + token).trim());
      }
      return acc;
    }, [])
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const sentence of parts) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + " " + sentence).length <= maxChars) {
      current = current + " " + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);

  // Emergency split: any single sentence still over the limit gets sliced
  // on whitespace so we never produce a chunk larger than maxChars.
  const safe: string[] = [];
  for (const c of chunks) {
    if (c.length <= maxChars) {
      safe.push(c);
      continue;
    }
    const words = c.split(/\s+/);
    let buf = "";
    for (const w of words) {
      if ((buf + " " + w).trim().length > maxChars && buf) {
        safe.push(buf.trim());
        buf = w;
      } else {
        buf = buf ? `${buf} ${w}` : w;
      }
    }
    if (buf) safe.push(buf.trim());
  }
  return safe;
}
