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
    if (!state.text.trim()) return;

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

      useQueueStore.getState().addJob({
        text: state.text.trim(),
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
        description: `"${state.text.trim().slice(0, 50)}${state.text.trim().length > 50 ? "..." : ""}" with ${voiceName}`,
      });
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
