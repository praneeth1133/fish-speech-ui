/**
 * Expression tags supported by Fish Speech S2 Pro.
 *
 * Fish Speech supports 15,000+ tags; these are the most useful ones,
 * organized by category for a clean picker UI. The tags cover emotions,
 * delivery styles, reactions, pacing, volume/energy, accents, character
 * archetypes, and speaking styles.
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
  // ─── Positive / High Energy ───
  {
    id: "positive",
    label: "Positive",
    icon: "😊",
    tags: [
      { tag: "HAPPY", label: "Happy", icon: "😊" },
      { tag: "JOYFUL", label: "Joyful", icon: "🥳" },
      { tag: "EXCITED", label: "Excited", icon: "🤩" },
      { tag: "CHEERFUL", label: "Cheerful", icon: "😄" },
      { tag: "CONFIDENT", label: "Confident", icon: "💪" },
      { tag: "PLAYFULLY", label: "Playfully", icon: "😜" },
    ],
  },
  // ─── Calm / Soft ───
  {
    id: "calm",
    label: "Calm",
    icon: "😌",
    tags: [
      { tag: "CALM", label: "Calm", icon: "😌" },
      { tag: "SERENE", label: "Serene", icon: "🧘" },
      { tag: "CARING", label: "Caring", icon: "🤗" },
      { tag: "ROMANTIC", label: "Romantic", icon: "💕" },
      { tag: "GENTLE", label: "Gentle", icon: "🌸" },
      { tag: "HUSHED TONE", label: "Hushed", icon: "🤫" },
    ],
  },
  // ─── Sad / Melancholic ───
  {
    id: "sad",
    label: "Sad",
    icon: "😢",
    tags: [
      { tag: "SAD", label: "Sad", icon: "😢" },
      { tag: "MELANCHOLIC", label: "Melancholic", icon: "🥀" },
      { tag: "HEARTBROKEN", label: "Heartbroken", icon: "💔" },
      { tag: "LONELY", label: "Lonely", icon: "😞" },
      { tag: "WISTFUL", label: "Wistful", icon: "🌅" },
      { tag: "RESIGNED TONE", label: "Resigned", icon: "😔" },
    ],
  },
  // ─── Anger / Irritation ───
  {
    id: "anger",
    label: "Anger",
    icon: "😠",
    tags: [
      { tag: "ANGRY", label: "Angry", icon: "😠" },
      { tag: "IRRITATED", label: "Irritated", icon: "😤" },
      { tag: "FRUSTRATED", label: "Frustrated", icon: "😖" },
      { tag: "RAGEFUL", label: "Rageful", icon: "🤬" },
      { tag: "THROUGH GRITTED TEETH", label: "Gritted teeth", icon: "😬" },
    ],
  },
  // ─── Suspense / Thought ───
  {
    id: "suspense",
    label: "Suspense",
    icon: "🤔",
    tags: [
      { tag: "SKEPTICAL", label: "Skeptical", icon: "🤨" },
      { tag: "ANXIOUS", label: "Anxious", icon: "😰" },
      { tag: "CONFUSED", label: "Confused", icon: "😕" },
      { tag: "CURIOUS", label: "Curious", icon: "🧐" },
      { tag: "PENSIVE", label: "Pensive", icon: "🤔" },
      { tag: "DEADPAN", label: "Deadpan", icon: "😐" },
    ],
  },
  // ─── Volume & Energy ───
  {
    id: "volume",
    label: "Volume",
    icon: "🔊",
    tags: [
      { tag: "WHISPERING", label: "Whispering", icon: "🤫" },
      { tag: "SOFT", label: "Soft", icon: "🪶" },
      { tag: "LOUD", label: "Loud", icon: "🔊" },
      { tag: "INTENSE", label: "Intense", icon: "🔥" },
      { tag: "ENERGETIC", label: "Energetic", icon: "⚡" },
      { tag: "LETHARGIC", label: "Lethargic", icon: "😴" },
    ],
  },
  // ─── Reactions ───
  {
    id: "reactions",
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
  // ─── Pacing & Pauses ───
  {
    id: "pace",
    label: "Pace",
    icon: "⏱️",
    tags: [
      { tag: "short pause", label: "Short pause", icon: "⏸️" },
      { tag: "medium pause", label: "Medium pause", icon: "⏯️" },
      { tag: "long pause", label: "Long pause", icon: "⏹️" },
      { tag: "breath", label: "Breath", icon: "🌬️" },
      { tag: "slowly", label: "Slowly", icon: "🐢" },
      { tag: "quickly", label: "Quickly", icon: "⚡" },
    ],
  },
  // ─── Accents ───
  {
    id: "accent",
    label: "Accents",
    icon: "🌍",
    tags: [
      { tag: "American accent", label: "American", icon: "🇺🇸" },
      { tag: "British accent", label: "British", icon: "🇬🇧" },
      { tag: "Australian accent", label: "Australian", icon: "🇦🇺" },
      { tag: "Indian English", label: "Indian", icon: "🇮🇳" },
      { tag: "French accent", label: "French", icon: "🇫🇷" },
      { tag: "German accent", label: "German", icon: "🇩🇪" },
    ],
  },
  // ─── Character & Style ───
  {
    id: "character",
    label: "Character",
    icon: "🎬",
    tags: [
      { tag: "pirate voice", label: "Pirate", icon: "🏴‍☠️" },
      { tag: "knight voice", label: "Knight", icon: "⚔️" },
      { tag: "robotic tone", label: "Robotic", icon: "🤖" },
      { tag: "sci-fi AI voice", label: "Sci-Fi AI", icon: "🛸" },
      { tag: "childlike tone", label: "Childlike", icon: "👶" },
      { tag: "narrator", label: "Narrator", icon: "📖" },
      { tag: "conversational tone", label: "Conversational", icon: "💬" },
      { tag: "news reporter", label: "News reporter", icon: "📺" },
      { tag: "sarcastic", label: "Sarcastic", icon: "😏" },
    ],
  },
];

/**
 * Flat list of all tag strings, used by the AI expression generator prompt
 * to constrain Claude to only these tags.
 */
export const ALL_TAG_STRINGS: string[] = EXPRESSION_CATEGORIES.flatMap((c) =>
  c.tags.map((t) => t.tag)
);

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
