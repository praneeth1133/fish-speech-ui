import { create } from "zustand";
import { useQueueStore } from "./queue-store";
import { toast } from "sonner";
import type { EnrichedVoice } from "@/components/voice-card";

interface TTSSettingsStore {
  text: string;
  setText: (t: string) => void;
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
  generate: () => Promise<void>;
  generateExpressions: () => Promise<void>;
}

export const useTTSSettingsStore = create<TTSSettingsStore>((set, get) => ({
  text: "",
  setText: (t) => set({ text: t }),
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

      await useQueueStore.getState().addJob({
        text: state.text.trim(),
        format: state.format,
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
