/**
 * Expression tags supported by Fish Speech S2 Pro. Modeled on ElevenLabs v3's
 * audio tag palette so the editor UX feels familiar.
 *
 * Fish Speech actually supports 15,000+ tags; these are the most
 * commonly-used ones, grouped by category for a clean picker.
 */

export interface ExpressionTag {
  /** The tag string to insert (without surrounding brackets added by UI) */
  tag: string;
  /** Short display label shown in the chip */
  label: string;
  /** Emoji or single-word hint for the category column */
  icon: string;
}

export interface ExpressionCategory {
  id: string;
  label: string;
  icon: string;
  tags: ExpressionTag[];
}

export const EXPRESSION_CATEGORIES: ExpressionCategory[] = [
  {
    id: "emotion",
    label: "Emotion",
    icon: "🎭",
    tags: [
      { tag: "happy", label: "Happy", icon: "😊" },
      { tag: "sad", label: "Sad", icon: "😢" },
      { tag: "angry", label: "Angry", icon: "😠" },
      { tag: "excited", label: "Excited", icon: "🤩" },
      { tag: "surprised", label: "Surprised", icon: "😲" },
      { tag: "nervous", label: "Nervous", icon: "😬" },
      { tag: "serious", label: "Serious", icon: "😐" },
      { tag: "calm", label: "Calm", icon: "😌" },
      { tag: "cheerful", label: "Cheerful", icon: "😄" },
      { tag: "sarcastic", label: "Sarcastic", icon: "😏" },
      { tag: "confused", label: "Confused", icon: "😕" },
      { tag: "scared", label: "Scared", icon: "😨" },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: "🎤",
    tags: [
      { tag: "whispers", label: "Whisper", icon: "🤫" },
      { tag: "shouts", label: "Shout", icon: "📢" },
      { tag: "slowly", label: "Slowly", icon: "🐢" },
      { tag: "quickly", label: "Quickly", icon: "⚡" },
      { tag: "softly", label: "Softly", icon: "🪶" },
      { tag: "loudly", label: "Loudly", icon: "🔊" },
      { tag: "singing", label: "Singing", icon: "🎵" },
      { tag: "dramatic", label: "Dramatic", icon: "🎭" },
    ],
  },
  {
    id: "sound",
    label: "Reactions",
    icon: "✨",
    tags: [
      { tag: "laughs", label: "Laughs", icon: "😂" },
      { tag: "giggles", label: "Giggles", icon: "🤭" },
      { tag: "sighs", label: "Sighs", icon: "😮‍💨" },
      { tag: "gasps", label: "Gasps", icon: "😱" },
      { tag: "coughs", label: "Coughs", icon: "🤧" },
      { tag: "clears throat", label: "Clears throat", icon: "🫡" },
      { tag: "exhales", label: "Exhales", icon: "💨" },
      { tag: "chuckles", label: "Chuckles", icon: "😅" },
      { tag: "groans", label: "Groans", icon: "😤" },
      { tag: "hums", label: "Hums", icon: "🎶" },
    ],
  },
  {
    id: "pace",
    label: "Pace",
    icon: "⏱️",
    tags: [
      { tag: "pause", label: "Pause", icon: "⏸️" },
      { tag: "long pause", label: "Long pause", icon: "⏹️" },
      { tag: "breath", label: "Breath", icon: "🌬️" },
    ],
  },
];

/**
 * Insert a tag at the current cursor position of a textarea. The tag is
 * wrapped in brackets and followed by a space so text flows naturally.
 * Returns the new full value and the new cursor position.
 */
export function insertTagAtCursor(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  tag: string
): { value: string; cursor: number } {
  const token = `[${tag}] `;
  const before = current.slice(0, selectionStart);
  const after = current.slice(selectionEnd);
  return {
    value: before + token + after,
    cursor: selectionStart + token.length,
  };
}
