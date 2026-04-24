import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Per-device favorite voices. Backed by localStorage so each browser
 * (each device) has its own favorites — nothing leaves the client.
 */
interface FavoritesStore {
  /** Array of voice reference_id values (e.g. "el-gigi", "telugu-female-3"). */
  ids: string[];
  /** Returns true if `voiceId` is currently favorited. */
  isFavorite: (voiceId: string) => boolean;
  /** Toggles favorite state. Returns the new state. */
  toggle: (voiceId: string) => boolean;
  /** Clears all favorites. */
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      ids: [],
      isFavorite: (voiceId) => get().ids.includes(voiceId),
      toggle: (voiceId) => {
        const current = get().ids;
        const isFav = current.includes(voiceId);
        const next = isFav
          ? current.filter((id) => id !== voiceId)
          : [...current, voiceId];
        set({ ids: next });
        return !isFav;
      },
      clear: () => set({ ids: [] }),
    }),
    {
      name: "fish-speech-favorites",
      storage: createJSONStorage(() => localStorage),
      // Only persist ids, not the functions
      partialize: (state) => ({ ids: state.ids }),
    }
  )
);
